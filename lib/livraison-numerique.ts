// Livraison automatique des produits numériques — point de passage unique.
//
// - Les droits (jetons de téléchargement, accès formation, clés de licence) ne sont
//   créés que pour une commande PAYÉE, c'est-à-dire confirmée côté serveur par
//   NotchPay (webhook signé + relecture de la transaction, voir lib/paiement-commande.ts).
// - Idempotent : une ligne LivraisonDigitale par commande (contrainte unique), un droit
//   par produit et par commande ; un verrou court empêche deux exécutions simultanées
//   (webhook, page de retour, réconciliation, bouton marchand).
// - Journal : statut, tentatives, dernière erreur (jamais de jeton ni de secret).
// - L'e-mail n'est qu'une notification : s'il échoue, les accès restent sur la page
//   de confirmation (lien signé) et dans « Mon compte » ; la réconciliation et le
//   bouton marchand « Renvoyer le lien » le retentent.
// - Remboursement / annulation : revoquerAccesCommande coupe tout.
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { PAIEMENT, finAcces, metaDigital } from "./commandes";
import { notifierMarchand } from "./notifications-marchand";
import { envoyerConfirmationCommande, envoyerMiseAJourProduit, envoyerOffreNouvelleVersion, emailReel } from "./email";
import { lienBoutique } from "./origine-site";
import { accorderPlaceCommande, revoquerInscriptionsCommande } from "./live/service";
import { cleApprenant } from "./formation/regles";

type Tx = Prisma.TransactionClient;

/** Jeton de téléchargement / d'accès : 256 bits aléatoires. */
export const nouveauJeton = () => crypto.randomBytes(32).toString("hex");

// ─── Clé d'accès à la page de confirmation ───────────────────────────────────
// L'identifiant d'une commande n'est pas un secret (cuid, ~40 bits aléatoires, visible
// du marchand, des livreurs, des journaux). La page qui affiche les accès exige donc
// en plus une clé HMAC de 128 bits liée à la commande, présente dans l'URL de retour
// NotchPay, l'e-mail et « Mon compte ».
function secretAcces(): string {
  const s = [process.env.AXSO_CLE_CHIFFREMENT, process.env.AUTH_SECRET, process.env.NEXTAUTH_SECRET].map((v) => v?.trim()).find(Boolean);
  if (!s) throw new Error("AUTH_SECRET manquant : impossible de signer les liens d'accès");
  return s;
}

export function cleAccesCommande(commandeId: string): string {
  return crypto.createHmac("sha256", secretAcces()).update(`acces-commande:${commandeId}`).digest("hex").slice(0, 32);
}

/** `k` peut arriver suivi d'un « ?reference=… » mal recollé par la passerelle : seuls les 32 premiers caractères comptent. */
export function cleAccesValide(commandeId: string, k: string | null | undefined): boolean {
  const recu = Buffer.from(String(k ?? "").slice(0, 32));
  const attendu = Buffer.from(cleAccesCommande(commandeId));
  return recu.length === attendu.length && crypto.timingSafeEqual(recu, attendu);
}

export async function lienAccesCommande(slug: string, commandeId: string): Promise<string> {
  return lienBoutique(slug, `/confirmation/${commandeId}?k=${cleAccesCommande(commandeId)}`);
}

// ─── Contrôle d'un jeton de téléchargement ───────────────────────────────────

export type Refus = { status: 403 | 404; error: string };

/** Décide si un jeton peut servir un fichier. Pur : testé dans tests/livraison-numerique.test.ts. */
export function controlerJeton(p: {
  dl: { expireAt: Date | null; revoqueAt?: Date | null; nbTelechargements?: number } | null;
  commande: { paiementStatut: string; statut: string } | null;
  limite?: number | null;
  maintenant?: Date;
}): Refus | null {
  const now = p.maintenant ?? new Date();
  if (!p.dl || !p.commande) return { status: 404, error: "Lien invalide" };
  if (p.commande.paiementStatut !== PAIEMENT.PAYE || p.commande.statut === "annulee") return { status: 403, error: "Achat non payé, annulé ou remboursé" };
  if (p.dl.revoqueAt) return { status: 403, error: "Lien révoqué" };
  if (p.dl.expireAt && p.dl.expireAt <= now) return { status: 403, error: "Lien expiré ou révoqué" };
  if (p.limite && (p.dl.nbTelechargements ?? 0) >= p.limite) return { status: 403, error: "Limite de téléchargements atteinte" };
  return null;
}

/** Compte un téléchargement, atomiquement sous la limite : false si elle vient d'être atteinte. */
export async function compterTelechargement(token: string, limite?: number | null): Promise<boolean> {
  const { count } = await prisma.telechargement.updateMany({
    where: { token, revoqueAt: null, ...(limite ? { nbTelechargements: { lt: limite } } : {}) },
    data: { nbTelechargements: { increment: 1 }, telecharge: true, dernierTelechargementAt: new Date() },
  });
  return count > 0;
}

/** Fichier stocké chez Vercel Blob : servi en flux par le serveur. Toute autre adresse n'est jamais lue côté serveur (SSRF). */
export function estFichierBlob(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}

// ─── Révocation ──────────────────────────────────────────────────────────────

/** Coupe tous les accès numériques d'une commande (remboursement, annulation). Idempotent. */
export async function revoquerAccesCommande(tx: Tx, commandeId: string) {
  const maintenant = new Date();
  await tx.telechargement.updateMany({ where: { commandeId, revoqueAt: null }, data: { revoqueAt: maintenant } });
  await tx.cleLicence.updateMany({ where: { commandeId, statut: "vendue" }, data: { statut: "revoquee" } });
  await tx.livraisonDigitale.updateMany({ where: { commandeId }, data: { statut: "revoquee" } });
  // Live Academy / bootcamps : place coupée et rendue, attestation coupée.
  await revoquerInscriptionsCommande(tx, commandeId);
  // Formations : la page d'accès exige déjà une commande payée ; on marque aussi l'accès révoqué
  // et on coupe le certificat, sauf si l'apprenant garde un autre achat payé de la même formation.
  const acces = await tx.accesFormation.findMany({ where: { commandeId, revoqueAt: null }, select: { produitId: true, clientEmail: true } });
  await tx.accesFormation.updateMany({ where: { commandeId, revoqueAt: null }, data: { revoqueAt: maintenant } });
  for (const a of acces) {
    if (!a.clientEmail.trim()) {
      await tx.certificat.updateMany({ where: { produitId: a.produitId, apprenant: cleApprenant({ ...a, commandeId }), revoqueAt: null }, data: { revoqueAt: maintenant, revoqueMotif: "Achat remboursé ou annulé", revoquePar: "remboursement" } });
      continue;
    }
    const autre = await tx.accesFormation.findFirst({ where: { produitId: a.produitId, clientEmail: a.clientEmail, revoqueAt: null, commandeId: { not: commandeId } }, select: { commandeId: true } });
    const autrePaye = autre && (await tx.commande.findFirst({ where: { id: autre.commandeId, paiementStatut: PAIEMENT.PAYE, statut: { not: "annulee" } }, select: { id: true } }));
    if (!autrePaye) await tx.certificat.updateMany({ where: { produitId: a.produitId, apprenant: a.clientEmail.trim(), revoqueAt: null }, data: { revoqueAt: maintenant, revoqueMotif: "Achat remboursé ou annulé", revoquePar: "remboursement" } });
  }
}

// ─── Livraison ───────────────────────────────────────────────────────────────

type ProduitLivrable = {
  id: string;
  nom: string;
  type: string;
  fichierUrl: string | null;
  instructionsTelechargement: string | null;
  produitFichier: { _count: { fichiers: number } } | null;
  licenceProduit: { id: string; dureeJours: number | null } | null;
  formation: { id: string } | null;
};

const SELECT_LIVRABLE = {
  id: true, nom: true, type: true, fichierUrl: true, instructionsTelechargement: true,
  produitFichier: { select: { _count: { select: { fichiers: true } } } },
  licenceProduit: { select: { id: true, dureeJours: true } },
  formation: { select: { id: true } },
} as const;

/** Droit d'un produit pour une commande, créé une seule fois. "manque" : rien à livrer (fichier absent, clés épuisées). */
async function livrerProduit(commande: { id: string; tenantId: string; clientEmail: string | null; clientNom?: string | null }, p: ProduitLivrable): Promise<"ok" | "manque" | "ignore"> {
  const dejaJeton = () => prisma.telechargement.findFirst({ where: { commandeId: commande.id, produitId: p.id }, select: { id: true } });

  if (p.type === "digital" || p.type === "fichier") {
    const aUnFichier = p.type === "digital" ? !!p.fichierUrl : (p.produitFichier?._count.fichiers ?? 0) > 0;
    if (!aUnFichier) return "manque";
    if (await dejaJeton()) return "ok";
    // Accès à vie (décision métier) ; seule une durée choisie par le marchand sur le produit le limite.
    const expireAt = finAcces(metaDigital(p.instructionsTelechargement).expirationAcces);
    await prisma.telechargement.create({ data: { produitId: p.id, commandeId: commande.id, token: nouveauJeton(), expireAt } });
    return "ok";
  }

  if (p.type === "formation") {
    if (await prisma.accesFormation.findFirst({ where: { commandeId: commande.id, produitId: p.id }, select: { id: true } })) return "ok";
    await prisma.accesFormation.create({ data: { produitId: p.id, commandeId: commande.id, token: nouveauJeton(), clientEmail: commande.clientEmail ?? "" } });
    return "ok";
  }

  if (p.type === "licence" && p.licenceProduit) {
    const deja = () => prisma.cleLicence.count({ where: { commandeId: commande.id, licenceProduitId: p.licenceProduit!.id } });
    if (await deja()) return "ok";
    const expireAt = p.licenceProduit.dureeJours ? new Date(Date.now() + p.licenceProduit.dureeJours * 86_400_000) : null;
    // Prise conditionnelle : deux achats simultanés ne reçoivent jamais la même clé.
    for (let essai = 0; essai < 5; essai++) {
      const cle = await prisma.cleLicence.findFirst({ where: { licenceProduitId: p.licenceProduit.id, statut: "disponible" }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (!cle) return "manque";
      const { count } = await prisma.cleLicence.updateMany({
        where: { id: cle.id, statut: "disponible" },
        data: { statut: "vendue", commandeId: commande.id, acheteurEmail: commande.clientEmail, expireAt },
      });
      if (count) {
        await alerterClesRestantes(commande.tenantId, p).catch(() => {});
        return "ok";
      }
    }
    return (await deja()) ? "ok" : "manque";
  }

  // Événement live / bootcamp : une place, prise atomiquement ; "manque" si complet (le marchand est prévenu).
  if (p.type === "evenement" || p.type === "bootcamp") return accorderPlaceCommande(commande, p.id);

  return "ignore";
}

const SEUIL_CLES = 5;

/** Réserve de clés qui s'épuise : prévenu à 5 clés restantes, puis à 0 (chaque vente en prend une). */
async function alerterClesRestantes(tenantId: string, p: ProduitLivrable) {
  const reste = await prisma.cleLicence.count({ where: { licenceProduitId: p.licenceProduit!.id, statut: "disponible" } });
  if (reste !== SEUIL_CLES && reste !== 0) return;
  await notifierMarchand({
    tenantId, type: "stock_faible", lien: `/dashboard/produits/${p.id}`,
    titre: reste ? `Plus que ${reste} clés de licence : ${p.nom}` : `Plus aucune clé de licence : ${p.nom}`,
    message: reste
      ? `Il ne reste que ${reste} clés disponibles pour « ${p.nom} ». Ajoute des clés avant la rupture.`
      : `« ${p.nom} » n'a plus de clé disponible : le prochain acheteur ne recevra rien. Ajoute des clés maintenant.`,
  });
}

async function produitsALivrer(produitIds: string[]): Promise<ProduitLivrable[]> {
  const produits = await prisma.produit.findMany({ where: { id: { in: produitIds } }, select: SELECT_LIVRABLE });
  const bundles = await prisma.bundleProduit.findMany({
    where: { produitId: { in: produits.filter((p) => p.type === "bundle").map((p) => p.id) } },
    select: { elements: { select: { produitInclus: { select: SELECT_LIVRABLE } } } },
  });
  // Un bundle livre chacun de ses produits inclus, sous leur propre identifiant.
  const inclus = bundles.flatMap((b) => b.elements.map((e) => e.produitInclus));
  return [...new Map([...produits, ...inclus].filter((p) => p.type !== "bundle").map((p) => [p.id, p])).values()];
}

const VERROU_MS = 2 * 60_000;
const court = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export type BilanLivraison =
  | { ok: false; raison: "introuvable" | "non_payee" | "sans_digital" | "en_cours" }
  | { ok: true; statut: string; emailStatut: string; manques: string[] };

/**
 * Livre (ou reprend la livraison d') une commande digitale payée, puis envoie le lien par e-mail
 * s'il ne l'a pas encore été (ou toujours, avec `renvoyerEmail`). Rejouable sans risque.
 */
export async function livrerCommandeDigitale(commandeId: string, opts: { renvoyerEmail?: boolean } = {}): Promise<BilanLivraison> {
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    select: {
      id: true, tenantId: true, numero: true, clientNom: true, clientEmail: true, montantTotal: true, devise: true,
      paiementStatut: true, statut: true,
      tenant: { select: { slug: true, nomBoutique: true } },
      lignes: { select: { nom: true, quantite: true, prix: true, produitId: true } },
    },
  });
  if (!commande) return { ok: false, raison: "introuvable" };
  // Jamais de droit sans paiement confirmé côté serveur.
  if (commande.paiementStatut !== PAIEMENT.PAYE || commande.statut === "annulee") return { ok: false, raison: "non_payee" };

  const produits = await produitsALivrer(commande.lignes.map((l) => l.produitId));
  if (!produits.some((p) => ["digital", "fichier", "formation", "licence", "evenement", "bootcamp"].includes(p.type))) return { ok: false, raison: "sans_digital" };

  await prisma.livraisonDigitale.upsert({ where: { commandeId }, create: { commandeId, tenantId: commande.tenantId }, update: {} });
  const pris = await prisma.livraisonDigitale.updateMany({
    where: { commandeId, statut: { not: "revoquee" }, OR: [{ verrouAt: null }, { verrouAt: { lt: new Date(Date.now() - VERROU_MS) } }] },
    data: { verrouAt: new Date(), tentatives: { increment: 1 } },
  });
  if (!pris.count) return { ok: false, raison: "en_cours" };

  try {
    const manques: string[] = [];
    const erreurs: string[] = [];
    let livres = 0;
    for (const p of produits) {
      try {
        const r = await livrerProduit(commande, p);
        if (r === "ok") livres++;
        else if (r === "manque") manques.push(p.nom);
      } catch (e) {
        erreurs.push(`${p.nom} : ${court(e)}`);
        console.error("[livraison-numerique] échec produit", { commandeId, produitId: p.id, erreur: court(e) });
      }
    }
    const statut = !manques.length && !erreurs.length ? "livree" : livres ? "partielle" : "echec";
    const erreur = [...erreurs, ...manques.map((n) => `${n} : rien à livrer (fichier absent ou clés épuisées)`)].join(" · ") || null;

    if (statut === "livree") {
      await prisma.commande.updateMany({
        where: { id: commandeId, statut: { notIn: ["annulee", "livree"] } },
        data: { statut: "livree", livraisonStatut: "livree", livreeAt: new Date() },
      });
    }
    const avant = await prisma.livraisonDigitale.findUniqueOrThrow({ where: { commandeId } });
    await prisma.livraisonDigitale.update({
      where: { commandeId },
      data: { statut, derniereErreur: erreur, livreeAt: statut === "livree" ? avant.livreeAt ?? new Date() : avant.livreeAt },
    });
    if (statut !== "livree" && avant.tentatives <= 1) {
      await notifierMarchand({
        tenantId: commande.tenantId, commandeId, type: "stock_faible",
        titre: `Livraison numérique incomplète #${commande.numero}`,
        message: `${commande.clientNom} a payé mais n'a pas tout reçu : ${erreur}. Corrige le produit puis clique « Renvoyer le lien » sur la commande.`,
        lien: `/dashboard/commandes/${commandeId}`,
      }).catch(() => {});
    }

    // E-mail : seulement quand il y a quelque chose à ouvrir, et une seule fois sauf demande explicite.
    let emailStatut = avant.emailStatut;
    if (livres > 0 && (opts.renvoyerEmail || avant.emailStatut !== "envoye")) {
      let erreurEmail: string | null = null;
      if (!emailReel(commande.clientEmail)) emailStatut = "sans_email";
      else {
        const ok = await envoyerConfirmationCommande({
          email: commande.clientEmail,
          nom: commande.clientNom,
          numeroCommande: commande.numero,
          montantTotal: commande.montantTotal,
          devise: commande.devise,
          produits: commande.lignes.map((l) => ({ nom: l.nom, quantite: l.quantite, prix: l.prix })),
          boutique: commande.tenant.nomBoutique,
          lienAcces: await lienAccesCommande(commande.tenant.slug, commandeId),
        }).catch((e) => { erreurEmail = court(e); return false; });
        emailStatut = ok ? "envoye" : "echec";
        if (!ok) erreurEmail ??= "E-mail non envoyé (Resend absent ou envoi refusé)";
      }
      await prisma.livraisonDigitale.update({
        where: { commandeId },
        data: {
          emailStatut,
          ...(emailStatut === "sans_email" ? {} : { emailTentatives: { increment: 1 } }),
          ...(emailStatut === "envoye" ? { emailEnvoyeAt: new Date() } : {}),
          ...(erreurEmail ? { derniereErreur: [erreur, erreurEmail].filter(Boolean).join(" · ") } : {}),
        },
      });
    }
    return { ok: true, statut, emailStatut, manques };
  } finally {
    await prisma.livraisonDigitale.update({ where: { commandeId }, data: { verrouAt: null } }).catch(() => {});
  }
}

/** Livraisons à reprendre (réconciliation) : incomplètes ou e-mail en échec, récentes, peu tentées. */
export async function reprendreLivraisons(limite = 50): Promise<number> {
  const aReprendre = await prisma.livraisonDigitale.findMany({
    where: {
      updatedAt: { gte: new Date(Date.now() - 14 * 86_400_000) },
      OR: [
        { statut: { in: ["en_cours", "partielle", "echec"] }, tentatives: { lt: 10 } },
        { emailStatut: "echec", emailTentatives: { lt: 5 } },
      ],
    },
    select: { commandeId: true }, orderBy: { updatedAt: "asc" }, take: limite,
  });
  for (const l of aReprendre) await livrerCommandeDigitale(l.commandeId).catch((e) => console.error("[livraison-numerique] reprise", l.commandeId, court(e)));
  return aReprendre.length;
}

// ─── Mise à jour d'un fichier ────────────────────────────────────────────────

/**
 * Acheteurs dont l'accès au produit est en cours (payé, non révoqué, non expiré), une entrée
 * par adresse e-mail : la commande la plus récente donne le lien. Les packs comptent (le jeton
 * porte le produit inclus).
 */
export async function acheteursDuProduit(tenantId: string, produitId: string) {
  const maintenant = new Date();
  const jetons = await prisma.telechargement.findMany({
    where: { produitId, produit: { tenantId }, revoqueAt: null, OR: [{ expireAt: null }, { expireAt: { gt: maintenant } }] },
    select: { commandeId: true },
  });
  const commandes = await prisma.commande.findMany({
    where: { id: { in: [...new Set(jetons.map((j) => j.commandeId))] }, tenantId, paiementStatut: PAIEMENT.PAYE, statut: { not: "annulee" } },
    select: { id: true, clientNom: true, clientEmail: true },
    orderBy: { createdAt: "desc" },
  });
  const parEmail = new Map<string, (typeof commandes)[number] & { clientEmail: string }>();
  for (const c of commandes) {
    if (!emailReel(c.clientEmail)) continue;
    const cle = c.clientEmail.trim().toLowerCase();
    if (!parEmail.has(cle)) parEmail.set(cle, { ...c, clientEmail: c.clientEmail });
  }
  return [...parEmail.values()];
}

/** Prévient chaque acheteur que le fichier a changé, avec son lien d'accès. Rend le nombre d'e-mails acceptés. */
export async function prevenirAcheteursMiseAJour(tenantId: string, produitId: string): Promise<number> {
  const [acheteurs, produit] = await Promise.all([
    acheteursDuProduit(tenantId, produitId),
    prisma.produit.findFirst({ where: { id: produitId, tenantId }, select: { nom: true, tenant: { select: { slug: true, nomBoutique: true } } } }),
  ]);
  if (!produit) return 0;
  let envoyes = 0;
  // ponytail: envoi un par un dans la même fonction ; passer par l'API batch de Resend au-delà de quelques centaines d'acheteurs.
  for (const a of acheteurs) {
    const ok = await envoyerMiseAJourProduit({
      email: a.clientEmail, nom: a.clientNom, produit: produit.nom, boutique: produit.tenant.nomBoutique,
      lienAcces: await lienAccesCommande(produit.tenant.slug, a.id),
    }).catch(() => false);
    if (ok) envoyes++;
  }
  return envoyes;
}

// ─── Nouvelle version payante ────────────────────────────────────────────────

/**
 * Offre aux acheteurs de la version précédente : UN code promo réservé à la nouvelle version
 * (produitIds), utilisable autant de fois qu'il y a d'acheteurs, valable `jours` jours ; puis un
 * e-mail à chacun avec le code et le lien du produit. Rend le code et le nombre d'acheteurs ;
 * l'envoi lui-même (`envoyer`) se fait après la réponse.
 */
export async function preparerOffreNouvelleVersion(tenantId: string, produitId: string, pourcentage: number, jours: number) {
  const v2 = await prisma.produit.findFirst({ where: { id: produitId, tenantId }, select: { id: true, nom: true, actif: true, versionPrecedenteId: true, tenant: { select: { slug: true, nomBoutique: true } } } });
  if (!v2?.versionPrecedenteId) return { ok: false as const, error: "Ce produit n'est pas une nouvelle version d'un autre produit." };
  if (!v2.actif) return { ok: false as const, error: "Publie d'abord la nouvelle version : les acheteurs doivent pouvoir l'acheter." };
  const v1 = await prisma.produit.findFirst({ where: { id: v2.versionPrecedenteId, tenantId }, select: { nom: true } });
  const acheteurs = await acheteursDuProduit(tenantId, v2.versionPrecedenteId);
  if (!v1 || !acheteurs.length) return { ok: false as const, error: "La version précédente n'a aucun acheteur joignable par e-mail." };
  const code = `MAJ${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const dateExpiration = new Date(Date.now() + jours * 86_400_000);
  await prisma.codePromo.create({ data: { tenantId, code, type: "pourcentage", valeur: pourcentage, produitIds: [v2.id], maxUtilisations: acheteurs.length, dateExpiration } });
  const lienProduit = await lienBoutique(v2.tenant.slug, `/produits/${v2.id}`);
  const envoyer = async () => {
    for (const a of acheteurs) {
      await envoyerOffreNouvelleVersion({
        email: a.clientEmail, nom: a.clientNom, ancien: v1.nom, nouveau: v2.nom, boutique: v2.tenant.nomBoutique,
        code, pourcentage, dateExpiration, lienProduit,
      }).catch(() => false);
    }
  };
  return { ok: true as const, code, acheteurs: acheteurs.length, dateExpiration, envoyer };
}
