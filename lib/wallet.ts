// Wallet AXSO — logique métier
// Flux : paiement confirmé (NotchPay) → crédit wallet immédiat (montant net, commission déduite)
//        retrait    → débit wallet → virement NotchPay (Transfers)

import { prisma } from "./prisma";
import { versXAF } from "./devise-convert";
import { tauxDuJour } from "./taux-change";
import { expirationApresPaiement } from "./abonnement";
import { verifierTransfertNotchPay, hasNotchPay } from "./notchpay";
import { pousserAdmins } from "./push";
import { envoyerAlerteRetrait } from "./email";
import { notifierMarchand } from "./notifications-marchand";
import { partVendeur } from "./pricing";
import { normaliserTelephone } from "./devise-convert";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TypeTransaction = "CREDIT" | "COMMISSION" | "RETRAIT" | "REMBOURSEMENT" | "FRAIS" | "BONUS";

export interface CreditWalletParams {
  tenantId: string;
  montantBrut: number;
  tauxCommission: number;
  devise: string;
  description: string;
  commandeId?: string;
  reference?: string;
  // Frais de traitement NotchPay réels sur cette transaction (jamais déduits du
  // vendeur — uniquement de la commission Axso, qui est la seule chose qui les couvre).
  fraisPasserelle?: number;
  // Part du montant payé qui n'a jamais été majorée de la commission (frais de livraison) : reversée en entier au vendeur.
  montantHorsCommission?: number;
}

export interface RetraitParams {
  tenantId: string;
  montant: number;
  devise: string;
  methode: "mobile_money" | "virement_bancaire";
  destinataire: string;
  operateur?: string;
  notes?: string;
}

// ─── Obtenir ou créer le wallet d'un marchand ─────────────────────────────────

export async function getOrCreateWallet(tenantId: string, devise = "XAF") {
  return prisma.wallet.upsert({
    where: { tenantId },
    create: { tenantId, devise },
    update: {},
  });
}

// ─── Portefeuille plateforme (revenu Axso) ────────────────────────────────────
// Aucune commission n'existait nulle part sous forme d'argent retirable — elle
// n'était qu'une ligne d'audit négative sur le wallet du marchand. On la fait
// atterrir ici : un tenant "système" interne qui réutilise l'infra wallet déjà
// durcie (débit atomique, remboursement automatique) plutôt qu'un système parallèle.

export const PLATFORM_TENANT_SLUG = "axso-platform-interne";

async function getOrCreatePlatformTenantId(tx: any): Promise<string> {
  const tenant = await tx.tenant.upsert({
    where: { slug: PLATFORM_TENANT_SLUG },
    create: {
      slug: PLATFORM_TENANT_SLUG,
      nomBoutique: "Axso Platform",
      categorie: "interne",
      pays: "CM",
      devise: "XAF",
      whatsapp: "",
      email: "platform@axso.internal",
      statut: "systeme",
      commissionRate: 0,
    },
    update: {},
  });
  return tenant.id;
}

export async function getPlatformTenantId(): Promise<string> {
  return getOrCreatePlatformTenantId(prisma);
}

// Le portefeuille plateforme est tenu en XAF : chaque montant d'une boutique
// (NGN, GHS, XOF…) y est converti, jamais additionné tel quel.
const enXAF = (montant: number, devise: string, description: string, taux: Record<string, number>) => devise === "XAF"
  ? { montant, devise, description }
  : { montant: versXAF(montant, devise, taux), devise: "XAF", description: `${description} (${montant} ${devise})` };

async function crediterPlateformeTx(tx: any, taux: Record<string, number>, montantDevise: number, deviseOrigine: string, descriptionOrigine: string, reference?: string) {
  if (montantDevise <= 0) return;
  const { montant, devise, description } = enXAF(montantDevise, deviseOrigine, descriptionOrigine, taux);
  const tenantId = await getOrCreatePlatformTenantId(tx);
  const wallet = await tx.wallet.upsert({
    where: { tenantId },
    create: { tenantId, devise, solde: montant, totalRecu: montant },
    update: { solde: { increment: montant }, totalRecu: { increment: montant } },
  });
  await tx.walletTransaction.create({
    data: { walletId: wallet.id, type: "CREDIT", montant, devise, description, reference, statut: "completed" },
  });
}

async function logFraisPasserelleTx(tx: any, taux: Record<string, number>, fraisDevise: number, deviseOrigine: string, descriptionOrigine: string, reference?: string) {
  if (fraisDevise <= 0) return;
  const { montant: frais, devise, description } = enXAF(fraisDevise, deviseOrigine, descriptionOrigine, taux);
  const platformTenantId = await getOrCreatePlatformTenantId(tx);
  const wallet = await tx.wallet.upsert({ where: { tenantId: platformTenantId }, create: { tenantId: platformTenantId, devise }, update: {} });
  // Ligne purement informative : le wallet n'a jamais été crédité du montant brut,
  // donc ce n'est pas un débit réel — juste la trace de ce que NotchPay a prélevé,
  // pour que l'admin voie exactement où passe l'écart entre "commission attendue" et "solde réel".
  await tx.walletTransaction.create({
    data: { walletId: wallet.id, type: "FRAIS", montant: -frais, devise, description, reference, statut: "completed" },
  });
}

// Abonnement payé : activation du palier + revenu Axso (net des frais NotchPay
// réels) dans UNE transaction, la boutique verrouillée. Un webhook rejoué ou reçu
// deux fois en même temps ne prolonge ni ne crédite deux fois : la référence
// NotchPay déjà inscrite au portefeuille plateforme vaut « déjà traité ».
// Renvoie false si ce paiement avait déjà été appliqué.
export async function activerAbonnementPaye(p: { tenantId: string; plan: string; jours: number; montant: number; frais: number; devise: string; reference: string }): Promise<boolean> {
  const net = Math.max(0, p.montant - p.frais);
  const taux = await tauxDuJour(); // hors transaction : aucun appel réseau pendant qu'elle est ouverte
  return prisma.$transaction(async (tx) => {
    const [tenant] = await tx.$queryRaw<{ nomBoutique: string; planType: string; planExpiresAt: Date | null }[]>`SELECT "nomBoutique", "planType", "planExpiresAt" FROM "Tenant" WHERE "id" = ${p.tenantId} FOR UPDATE`;
    if (!tenant) return false;
    const platformTenantId = await getOrCreatePlatformTenantId(tx);
    const deja = await tx.walletTransaction.findFirst({ where: { reference: p.reference, wallet: { tenantId: platformTenantId } }, select: { id: true } });
    if (deja) return false;

    await tx.tenant.update({
      where: { id: p.tenantId },
      data: { planType: p.plan, planExpiresAt: expirationApresPaiement(tenant, p.plan, p.jours), planPendingRef: null },
    });
    const description = `Abonnement ${p.plan} — ${tenant.nomBoutique}`;
    if (net > 0) await crediterPlateformeTx(tx, taux, net, p.devise, description, p.reference);
    await logFraisPasserelleTx(tx, taux, p.frais, p.devise, `Frais NotchPay · ${p.reference}`, p.reference);
    return true;
  });
}

// ─── Récompenser un marchand ───────────────────────────────────────────────────
// Bonus versé par Axso depuis son propre wallet plateforme — débite réellement
// la plateforme (même débit atomique conditionnel que initierRetrait) pour ne
// jamais promettre plus d'argent que ce qu'Axso a réellement en caisse.
export async function crediterBonusWallet(tenantId: string, montant: number, devise: string, raison: string) {
  const taux = await tauxDuJour(); // hors transaction : aucun appel réseau pendant qu'elle est ouverte
  await prisma.$transaction(async (tx) => {
    const platformTenantId = await getOrCreatePlatformTenantId(tx);
    const debitXAF = enXAF(montant, devise, `Bonus marchand · ${raison}`, taux);
    const debit = await tx.wallet.updateMany({
      where: { tenantId: platformTenantId, solde: { gte: debitXAF.montant } },
      data: { solde: { decrement: debitXAF.montant }, totalRetire: { increment: debitXAF.montant } },
    });
    if (debit.count === 0) throw new Error("Solde plateforme insuffisant pour ce bonus");

    const platformWallet = await tx.wallet.findUnique({ where: { tenantId: platformTenantId } });
    await tx.walletTransaction.create({
      data: { walletId: platformWallet!.id, type: "RETRAIT", montant: -debitXAF.montant, devise: debitXAF.devise, description: debitXAF.description, statut: "completed" },
    });

    const wallet = await tx.wallet.upsert({
      where: { tenantId },
      create: { tenantId, devise, solde: montant, totalRecu: montant },
      update: { solde: { increment: montant }, totalRecu: { increment: montant } },
    });
    await tx.walletTransaction.create({
      data: { walletId: wallet.id, type: "BONUS", montant, devise, description: `Bonus Axso · ${raison}`, statut: "completed" },
    });
  });
}

// ─── Créditer le wallet après confirmation d'un paiement ─────────────────────
// Point d'entrée unique — calcule la commission, crédite le net, log la commission.

export async function crediterWallet(
  params: CreditWalletParams
): Promise<{ montantNet: number; montantCommission: number }> {
  const { tenantId, montantBrut, tauxCommission, devise, description, commandeId, reference, fraisPasserelle } = params;

  // montantBrut = ce que le client a payé : produits majorés de la commission côté storefront
  // (prix vendeur × (1 + tauxCommission)) + livraison non majorée. On extrait le net du vendeur
  // par division sur la seule part majorée : le vendeur reçoit exactement son prix et sa livraison.
  // FCFA et autres monnaies sans centimes : arrondi à l'unité.
  const { montantNet, montantCommission } = partVendeur(montantBrut, params.montantHorsCommission ?? 0, tauxCommission, devise);

  const taux = await tauxDuJour(); // hors transaction : aucun appel réseau pendant qu'elle est ouverte
  const credite = await prisma.$transaction(async (tx) => {
    // Une commande n'est créditée qu'une fois, même si sa finalisation est rejouée
    // (webhook, page de retour, réconciliation) : verrou sur la commande, puis contrôle.
    if (commandeId) {
      await tx.$queryRaw`SELECT id FROM "Commande" WHERE id = ${commandeId} FOR UPDATE`;
      if (await tx.walletTransaction.findFirst({ where: { commandeId, type: "CREDIT" }, select: { id: true } })) return false;
    }
    const wallet = await tx.wallet.upsert({
      where: { tenantId },
      create: {
        tenantId,
        devise,
        solde: montantNet,
        totalRecu: montantBrut,
        totalCommission: montantCommission,
      },
      update: {
        solde: { increment: montantNet },
        totalRecu: { increment: montantBrut },
        totalCommission: { increment: montantCommission },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "CREDIT",
        montant: montantNet,
        devise,
        description,
        reference,
        commandeId,
        statut: "completed",
      },
    });

    if (montantCommission > 0) {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "COMMISSION",
          montant: -montantCommission,
          devise,
          description: `Commission Axso${reference ? ` · ${reference}` : ""}`,
          reference,
          commandeId,
          statut: "completed",
        },
      });
    }

    if (commandeId && montantCommission > 0) {
      await tx.commission.upsert({
        where: { commandeId },
        create: {
          commandeId,
          tenantId,
          montantCommande: montantBrut,
          montantCommission,
          montantMarchand: montantNet,
          taux: tauxCommission,
          devise,
          statut: "captured",
          capturedAt: new Date(),
        },
        update: { statut: "captured", capturedAt: new Date() },
      });
    }

    // La commission n'est plus qu'une ligne d'audit — elle doit aussi devenir
    // de l'argent réel, retirable par Axso. Créditée dans la MÊME transaction
    // pour ne jamais pouvoir diverger du crédit marchand. NotchPay prélève lui
    // aussi son propre frais de traitement sur ce que le client a payé — ce
    // frais ne touche JAMAIS le vendeur (déjà crédité de son plein prix
    // ci-dessus), il est absorbé par la commission Axso, jamais en dessous de 0.
    if (montantCommission > 0) {
      const platformTenantId = await getOrCreatePlatformTenantId(tx);
      if (tenantId !== platformTenantId) {
        const frais = Math.min(Math.max(0, fraisPasserelle ?? 0), montantCommission);
        const commissionNette = montantCommission - frais;
        if (commissionNette > 0) {
          await crediterPlateformeTx(tx, taux, commissionNette, devise, `Commission sur vente${reference ? ` · ${reference}` : ""}`, reference);
        }
        await logFraisPasserelleTx(tx, taux, frais, devise, `Frais NotchPay${reference ? ` · ${reference}` : ""}`, reference);
      }
    }
    return true;
  });

  return credite ? { montantNet, montantCommission } : { montantNet: 0, montantCommission: 0 };
}

// ─── Reprendre une vente en ligne remboursée ──────────────────────────────────
// Modèle Shopify/Stripe : le marchand rend ce qui lui avait été crédité pour cette
// commande (son solde peut passer en négatif — les retraits sont alors bloqués et
// la dette se résorbe sur ses ventes suivantes), Axso rend sa commission. NotchPay
// ne rend pas ses frais : Axso les absorbe. Idempotent par commande.
export async function reprendreVenteRemboursee(p: { tenantId: string; commandeId: string; numero: string; reference?: string }) {
  const taux = await tauxDuJour(); // hors transaction : aucun appel réseau pendant qu'elle est ouverte
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { tenantId: p.tenantId } });
    if (!wallet) return;
    const deja = await tx.walletTransaction.findFirst({ where: { walletId: wallet.id, commandeId: p.commandeId, type: "REMBOURSEMENT" } });
    if (deja) return;

    const credits = await tx.walletTransaction.findMany({ where: { walletId: wallet.id, commandeId: p.commandeId, type: "CREDIT" } });
    const net = Math.round(credits.reduce((s, c) => s + c.montant, 0) * 100) / 100;
    const commission = await tx.commission.findUnique({ where: { commandeId: p.commandeId } });
    if (net > 0) {
      // totalRecu avait été augmenté du montant payé par le client (brut), pas du net.
      await tx.wallet.update({ where: { id: wallet.id }, data: { solde: { decrement: net }, totalRecu: { decrement: commission?.montantCommande ?? net } } });
      await tx.walletTransaction.create({
        data: { walletId: wallet.id, type: "REMBOURSEMENT", montant: -net, devise: wallet.devise, description: `Remboursement client #${p.numero}`, reference: p.reference, commandeId: p.commandeId, statut: "completed" },
      });
    }

    if (commission && commission.statut !== "remboursee") {
      await tx.commission.update({ where: { commandeId: p.commandeId }, data: { statut: "remboursee" } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { totalCommission: { decrement: commission.montantCommission } } });
      const { montant, devise, description } = enXAF(commission.montantCommission, commission.devise, `Commission rendue · remboursement #${p.numero}`, taux);
      const platformTenantId = await getOrCreatePlatformTenantId(tx);
      const plateforme = await tx.wallet.upsert({ where: { tenantId: platformTenantId }, create: { tenantId: platformTenantId, devise }, update: {} });
      await tx.wallet.update({ where: { id: plateforme.id }, data: { solde: { decrement: montant }, totalRecu: { decrement: montant } } });
      await tx.walletTransaction.create({
        data: { walletId: plateforme.id, type: "REMBOURSEMENT", montant: -montant, devise, description, reference: p.reference, commandeId: p.commandeId, statut: "completed" },
      });
    }
  });
}

// ─── Initier un retrait ───────────────────────────────────────────────────────
// Sécurité : le débit du solde et sa vérification sont une SEULE opération atomique
// (updateMany conditionnel) pour éliminer toute race condition entre deux retraits
// concurrents qui passeraient tous les deux un contrôle de solde fait séparément.
//
// Circuit unique depuis le 20/10/2026 : MANUEL. NotchPay n'accepte les transferts par API que
// depuis des IP déclarées, et Vercel n'a pas d'IP fixe (refus « IP address not allowed »). Chaque
// retrait reste « en_attente » sans référence : Axso est prévenu (cloche + push du Command Center,
// e-mail à EMAIL_RETRAITS), fait le transfert dans le tableau de bord NotchPay, puis le marque payé
// ou refusé dans Admin › Finances. Les retraits plus anciens suivis par NotchPay (référence) restent
// mis à jour par le webhook et synchroniserRetraits.

// Lie la ligne RETRAIT du wallet à son retrait (et sert de référence marchande NotchPay).
const refRetrait = (retraitId: string) => `AXSO-${retraitId}`;

// Numéro mobile camerounais au format attendu par NotchPay, ou null.
export function telCameroun(saisie: string): string | null {
  const d = saisie.replace(/\D/g, "").replace(/^(00)?237/, "");
  return /^6\d{8}$/.test(d) ? `+237${d}` : null;
}

/** Opérateur d'un numéro camerounais (+2376…) d'après son préfixe : MTN 67 / 650-654, Orange 69 / 655-659.
 *  ponytail: préfixes sûrs seulement ; 68x et 62x (partagés ou récents) → null, versement à la main. */
export function operateurCameroun(tel: string | null): "mtn" | "orange" | null {
  const d = tel?.replace(/\D/g, "").replace(/^237/, "") ?? "";
  if (/^67/.test(d) || /^65[0-4]/.test(d)) return "mtn";
  if (/^69/.test(d) || /^65[5-9]/.test(d)) return "orange";
  return null;
}

export async function initierRetrait(params: RetraitParams) {
  const { tenantId, methode, operateur, notes } = params;
  // Mobile Money : numéro au format international, indicatif du pays de la boutique (6XX… au Cameroun → +2376XX…).
  let destinataire = params.destinataire.trim();
  if (methode === "mobile_money") {
    const { pays } = (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { pays: true } })) ?? {};
    const tel = normaliserTelephone(destinataire, pays);
    if (!tel) throw new Error("Numéro Mobile Money invalide : vérifie-le, avec l'indicatif de ton pays s'il est à l'étranger.");
    destinataire = tel;
  }
  const montant = Math.round(Number(params.montant) * 100) / 100;

  const MINIMUM = 1000;
  if (!Number.isFinite(montant) || montant < MINIMUM) throw new Error(`Montant minimum de retrait : ${MINIMUM} ${params.devise}`);

  const { retrait, nomBoutique } = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { tenantId }, include: { tenant: { select: { nomBoutique: true } } } });
    if (!wallet) throw new Error("Wallet introuvable");

    // Débit conditionnel atomique — échoue (count 0) si le solde a changé entre
    // temps (retrait concurrent) et ne descend jamais sous 0.
    const debit = await tx.wallet.updateMany({
      where: { tenantId, solde: { gte: montant } },
      data: { solde: { decrement: montant }, totalRetire: { increment: montant } },
    });
    if (debit.count === 0) throw new Error("Solde insuffisant");

    // Le retrait se fait dans la devise du wallet, pas dans celle passée par l'appelant.
    const r = await tx.retrait.create({
      data: { walletId: wallet.id, tenantId, montant, devise: wallet.devise, methode, destinataire, operateur, notes, statut: "en_attente" },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "RETRAIT",
        montant: -montant,
        devise: wallet.devise,
        description: `Retrait ${methode === "mobile_money" ? `Mobile Money (${operateur ?? ""})` : "Virement bancaire"} → ${destinataire}`,
        reference: refRetrait(r.id),
        statut: "en_cours",
      },
    });

    return { retrait: r, nomBoutique: wallet.tenant.nomBoutique };
  });

  // Jamais bloquant : le retrait est enregistré même si l'alerte échoue (il reste visible dans Finances).
  await signalerRetraitAValider(retrait.id).catch((e) => console.error("[wallet/retrait] alerte admin", retrait.id, e?.message));
  return retrait;
}

/** Destinataire des alertes « retrait à valider ». */
export const EMAIL_RETRAITS = "axedigital00@gmail.com";

/** Canal NotchPay à choisir pour ce retrait, ou null s'il se paie hors NotchPay (Wave, banque, autre pays). */
export function canalNotchPay(r: { methode: string; operateur: string | null; devise: string; destinataire: string }): string | null {
  const op = (r.operateur ?? "").toLowerCase();
  return r.methode === "mobile_money" && r.devise === "XAF" && (op === "mtn" || op === "orange") && telCameroun(r.destinataire) ? `cm.${op}` : null;
}

/**
 * Prévient Axso qu'un retrait attend son transfert : push du Command Center + e-mail détaillé
 * (tout ce qu'il faut pour faire le transfert à l'identique dans NotchPay et vérifier le marchand).
 */
export async function signalerRetraitAValider(retraitId: string) {
  const r = await prisma.retrait.findUniqueOrThrow({ where: { id: retraitId } });
  const [tenant, wallet, dejaPayes] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: r.tenantId },
      select: { nomBoutique: true, slug: true, email: true, whatsapp: true, proprietaires: { where: { role: "owner" }, take: 1, select: { user: { select: { name: true, email: true } } } } },
    }),
    prisma.wallet.findUnique({ where: { id: r.walletId }, select: { solde: true } }),
    prisma.retrait.count({ where: { tenantId: r.tenantId, destinataire: r.destinataire, statut: "complete" } }),
  ]);
  const montant = `${r.montant.toLocaleString("fr-FR")} ${r.devise}`;
  const boutique = tenant?.nomBoutique ?? r.tenantId;
  await Promise.allSettled([
    pousserAdmins({ titre: "💸 Retrait à valider", message: `${boutique} · ${montant} → ${r.operateur ?? r.methode}`, lien: "/admin/finances", type: "retrait_a_valider" }),
    envoyerAlerteRetrait({
      a: EMAIL_RETRAITS,
      retraitId: r.id, reference: refRetrait(r.id), creeLe: r.createdAt,
      montant: r.montant, devise: r.devise, methode: r.methode, operateur: r.operateur, destinataire: r.destinataire,
      canal: canalNotchPay(r), notes: r.notes,
      boutique, slug: tenant?.slug ?? "", proprietaire: tenant?.proprietaires[0]?.user ?? null,
      emailBoutique: tenant?.email ?? null, whatsappBoutique: tenant?.whatsapp ?? null,
      soldeApres: wallet?.solde ?? null, premierRetraitVersCeNumero: dejaPayes === 0,
    }).then((ok) => { if (!ok) throw new Error("e-mail non envoyé"); }),
  ]).then((res) => res.forEach((x) => x.status === "rejected" && console.error("[wallet/retrait] alerte", retraitId, x.reason?.message)));
}

// ─── Appliquer l'état d'un transfert à son retrait ────────────────────────────
// Point de passage unique : réponse de NotchPay à l'initiation, webhook,
// re-vérification au chargement du wallet et clôture manuelle par l'admin.
// Un retrait déjà clos (complete / echoue) ne bouge plus.
const STATUTS_ECHEC = ["failed", "canceled", "cancelled", "reversed", "rejected", "expired"];

export async function appliquerStatutTransfert(retraitId: string, status?: string, reference?: string) {
  if (status && STATUTS_ECHEC.includes(status)) return rembourserRetraitEchoue(retraitId);

  const complet = status === "complete";
  const maj = await prisma.retrait.updateMany({
    where: { id: retraitId, statut: { in: ["en_attente", "traitement"] } },
    data: { statut: complet ? "complete" : "traitement", ...(reference ? { reference } : {}) },
  });
  if (complet && maj.count > 0) {
    await prisma.walletTransaction.updateMany({
      where: { type: "RETRAIT", reference: refRetrait(retraitId), statut: "en_cours" },
      data: { statut: "completed" },
    });
  }
}

// Clôture d'un retrait du circuit manuel (jamais un retrait suivi par NotchPay).
export async function cloturerRetraitManuel(retraitId: string, paye: boolean) {
  const retrait = await prisma.retrait.findUnique({ where: { id: retraitId } });
  if (!retrait) throw new Error("Retrait introuvable");
  if (retrait.reference) throw new Error("Ce retrait est suivi automatiquement par NotchPay");
  if (retrait.statut !== "en_attente") throw new Error("Ce retrait est déjà traité");
  await appliquerStatutTransfert(retraitId, paye ? "complete" : "failed");
  const montant = `${retrait.montant.toLocaleString("fr-FR")} ${retrait.devise}`;
  await notifierMarchand({
    tenantId: retrait.tenantId, type: paye ? "retrait_paye" : "retrait_refuse", lien: "/dashboard/wallet",
    titre: paye ? `Retrait de ${montant} envoyé` : `Retrait de ${montant} refusé`,
    message: paye ? `Axso a envoyé ${montant} à ${retrait.destinataire}.` : `Le retrait vers ${retrait.destinataire} n'a pas pu être fait : ${montant} ont été remis sur votre solde.`,
  });
}

// ─── Rembourser un retrait qui a échoué ───────────────────────────────────────
// Idempotent même sous concurrence (webhook + re-vérification simultanés) : le
// passage à « echoue » est conditionnel et seul celui qui le gagne recrédite.
export async function rembourserRetraitEchoue(retraitId: string) {
  await prisma.$transaction(async (tx) => {
    const maj = await tx.retrait.updateMany({
      where: { id: retraitId, statut: { in: ["en_attente", "traitement"] } },
      data: { statut: "echoue" },
    });
    if (maj.count === 0) return;
    const retrait = await tx.retrait.findUniqueOrThrow({ where: { id: retraitId } });

    await tx.wallet.update({
      where: { id: retrait.walletId },
      data: { solde: { increment: retrait.montant }, totalRetire: { decrement: retrait.montant } },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: retrait.walletId,
        type: "REMBOURSEMENT",
        montant: retrait.montant,
        devise: retrait.devise,
        description: `Remboursement — retrait échoué (${retrait.destinataire})`,
        reference: refRetrait(retraitId),
        statut: "completed",
      },
    });

    await tx.walletTransaction.updateMany({
      where: { type: "RETRAIT", reference: refRetrait(retraitId), statut: "en_cours" },
      data: { statut: "echoue" },
    });
  });
}

// Filet de sécurité si le webhook n'arrive pas (toujours le cas en local) :
// on redemande à NotchPay l'état des transferts encore ouverts de la boutique.
async function synchroniserRetraits(tenantId: string) {
  if (!hasNotchPay()) return;
  const ouverts = await prisma.retrait.findMany({
    where: { tenantId, statut: { in: ["en_attente", "traitement"] }, reference: { not: null } },
    take: 5,
  });
  await Promise.all(ouverts.map(async (r) => {
    try {
      const { transfer } = await verifierTransfertNotchPay(r.reference!);
      await appliquerStatutTransfert(r.id, transfer?.status);
    } catch {}
  }));
}

// ─── Résumé wallet (pour le dashboard) ───────────────────────────────────────

export async function getWalletResume(tenantId: string) {
  await synchroniserRetraits(tenantId);
  const wallet = await prisma.wallet.findUnique({
    where: { tenantId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      retraits: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!wallet) return null;

  return {
    ...wallet,
    retraitsEnAttente: wallet.retraits.filter((r) => r.statut === "en_attente" || r.statut === "traitement").reduce((s, r) => s + r.montant, 0),
  };
}
