import { prisma } from "./prisma";
import { canalNotchPay, crediterWallet, debiterDisponibleTx, EMAIL_RETRAITS, operateurCameroun } from "./wallet";
import { pousserAdmins } from "./push";
import { normaliserTelephone } from "./devise-convert";
import { TYPES_NUMERIQUES } from "./pricing";
import { livrerCommandeDigitale } from "./livraison-numerique";
import { notifierMarchand } from "./notifications-marchand";
import { envoyerAlerteRetrait, envoyerEmailTexte } from "./email";

// ─── Codes ──────────────────────────────────────────────────────────────────

// Code d'un lien B2B (boutique → boutique), utilisé par AffiliationLien
export function genererCodeAffiliation(nomBoutique: string): string {
  const base = nomBoutique
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5) || "AFF";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

// Code de parrainage d'un affilié individuel (programme B2C)
export function genererCodeParrainage(nom: string): string {
  const base = nom
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6) || "AFF";
  const year = new Date().getFullYear().toString().slice(-2);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${base}${year}${suffix}`;
}

export async function genererCodeParrainageUnique(nom: string): Promise<string> {
  let code = genererCodeParrainage(nom);
  for (let i = 0; i < 5; i++) {
    const existe = await prisma.affilie.findUnique({ where: { codeParrainage: code } });
    if (!existe) return code;
    code = genererCodeParrainage(nom);
  }
  return `${code}${Date.now().toString(36).toUpperCase().slice(-3)}`;
}

// ─── Moteur de commission B2C (programme d'affiliation individuel) ──────────
// C'est le moteur "standard international" (type PartnerStack/Rewardful) :
// un marchand recrute des affiliés individuels via ProgrammeAffiliation, ils
// partagent un code de parrainage, chaque vente attribuée crée une
// CommissionAffilie. Fonctionne pour TOUS les canaux de commande (digital,
// WhatsApp/COD, paiement en ligne physique) — pas seulement le digital.

type ProgrammePourCalcul = {
  typeCommission: string;
  valeurCommission: number;
  tiersActifs: boolean;
  tier1Max: number;
  tier1Commission: number;
  tier2Max: number;
  tier2Commission: number;
  tier3Commission: number;
  tousLesProduits: boolean;
  produitIds: string[];
};

// Sous-types de produit considérés "digitaux" pour la règle de commission
// d'affiliation par défaut (50%) — exclut "bundle", qui peut mélanger des
// produits physiques et digitaux et ne doit pas hériter du taux digital.
export const TYPES_PRODUIT_DIGITAL = new Set(["digital", "fichier", "formation", "licence"]);

// Tous les types nécessitant une livraison digitale (token/clé/accès) après
// paiement — contrairement à TYPES_PRODUIT_DIGITAL ci-dessus, inclut "bundle"
// (qui doit toujours être résolu/livré via livrerBundle, même s'il ne compte
// pas comme "digital" pour le calcul de commission).
export const TYPES_LIVRAISON_DIGITALE = TYPES_NUMERIQUES; // evenement/bootcamp : place live (lib/live/service.ts)

// Commission par défaut d'un produit digital sans taux personnalisé —
// nettement supérieure au taux physique par défaut car sans coût de
// livraison/stock pour le marchand.
const TAUX_DEFAUT_DIGITAL = 0.5;

function tauxPourPalier(programme: ProgrammePourCalcul, conversionsActuelles: number): number {
  if (!programme.tiersActifs) return programme.valeurCommission;
  if (conversionsActuelles >= programme.tier2Max) return programme.tier3Commission;
  if (conversionsActuelles >= programme.tier1Max) return programme.tier2Commission;
  return programme.tier1Commission;
}

export function calculerCommissionLigne(params: {
  montantLigne: number;
  produitId: string;
  produit: { affiliationActive: boolean; tauxCommissionAff: number | null; type?: string } | null;
  programme: ProgrammePourCalcul;
  conversionsActuelles: number;
}): number {
  const { montantLigne, produitId, produit, programme, conversionsActuelles } = params;

  const eligible = programme.tousLesProduits || programme.produitIds.includes(produitId);
  if (!eligible) return 0;

  const estDigital = !!produit?.type && TYPES_PRODUIT_DIGITAL.has(produit.type);

  if (programme.typeCommission === "fixe") {
    const montant = produit?.affiliationActive && produit.tauxCommissionAff
      ? produit.tauxCommissionAff
      : programme.valeurCommission;
    return Math.round(montant * 100) / 100;
  }

  // Pourcentage : taux spécifique produit (déjà une fraction, ex 0.20) sinon,
  // pour un produit digital, 50% garanti ; sinon taux du programme selon le
  // palier atteint (stocké en points, ex 10 = 10%).
  const tauxFraction = produit?.affiliationActive
    ? (produit.tauxCommissionAff ?? (estDigital ? TAUX_DEFAUT_DIGITAL : tauxPourPalier(programme, conversionsActuelles) / 100))
    : tauxPourPalier(programme, conversionsActuelles) / 100;

  return Math.round(montantLigne * tauxFraction * 100) / 100;
}

function estAutoReferencement(
  affilie: { email: string; telephone: string | null },
  commande: { clientEmail: string | null; clientTelephone: string }
): boolean {
  if (affilie.email && commande.clientEmail && affilie.email.toLowerCase() === commande.clientEmail.toLowerCase()) {
    return true;
  }
  if (affilie.telephone && commande.clientTelephone) {
    const a = affilie.telephone.replace(/\D/g, "");
    const c = commande.clientTelephone.replace(/\D/g, "");
    if (a && c && a === c) return true;
  }
  return false;
}

// Appelé UNE FOIS à la création de toute commande contenant un codeAffiliation
// (quel que soit le canal). Crée les CommissionAffilie en statut "pending".
// Idempotent : ne recrédite jamais deux fois la même commande.
export async function enregistrerConversionAffiliation(params: {
  commande: {
    id: string;
    tenantId: string;
    clientEmail: string | null;
    clientTelephone: string;
    montantTotal: number;
    codeAffiliation?: string | null;
  };
  lignes: Array<{ produitId: string; prix: number; quantite: number }>;
  /** Commande payée en ligne : majoration Axso incluse dans `prix`, retirée avant de calculer la commission. */
  tauxCommission?: number | null;
}): Promise<void> {
  const { commande, lignes, tauxCommission } = params;
  if (!commande.codeAffiliation) return;

  const dejaEnregistre = await prisma.commissionAffilie.findFirst({ where: { commandeId: commande.id } });
  if (dejaEnregistre) return;

  const affilie = await prisma.affilie.findFirst({
    where: { tenantId: commande.tenantId, codeParrainage: commande.codeAffiliation, statut: "actif" },
    include: { programme: true },
  });
  if (!affilie || !affilie.programme || !affilie.programme.actif) return;
  if (estAutoReferencement(affilie, commande)) return;

  const produits = await prisma.produit.findMany({
    where: { id: { in: lignes.map((l) => l.produitId) } },
    select: { id: true, affiliationActive: true, tauxCommissionAff: true, type: true },
  });
  const produitsMap = new Map(produits.map((p) => [p.id, p]));

  let montantCommission = 0;
  for (const ligne of lignes) {
    montantCommission += calculerCommissionLigne({
      // Sur le prix du vendeur : l'affilié n'est jamais payé sur la commission Axso.
      montantLigne: (tauxCommission ? Math.round(ligne.prix / (1 + tauxCommission)) : ligne.prix) * ligne.quantite,
      produitId: ligne.produitId,
      produit: produitsMap.get(ligne.produitId) ?? null,
      programme: affilie.programme,
      conversionsActuelles: affilie.conversions,
    });
  }
  montantCommission = Math.round(montantCommission * 100) / 100;
  if (montantCommission <= 0) return;

  await prisma.$transaction([
    prisma.commissionAffilie.create({
      data: {
        tenantId: commande.tenantId,
        affilieId: affilie.id,
        commandeId: commande.id,
        montantCommission,
        valeurCommande: commande.montantTotal,
        statut: "pending",
      },
    }),
    prisma.affilie.update({
      where: { id: affilie.id },
      data: {
        conversions: { increment: 1 },
        commissionTotal: { increment: montantCommission },
        commissionPending: { increment: montantCommission },
      },
    }),
  ]);
}

// Fait passer les commissions "pending" d'une commande à "approuvee" (donc
// payables) — appelé au moment où la vente est définitivement acquise :
// livraison confirmée pour le COD, immédiatement pour le digital/paiement en
// ligne (même logique que la capture de Commission existante).
export async function capturerCommissionAffiliation(commandeId: string): Promise<void> {
  await prisma.commissionAffilie.updateMany({
    where: { commandeId, statut: "pending" },
    data: { statut: "approuvee" },
  });
}

// ─── Paiement des commissions (validé par Axso) ──────────────────────────────
// Symétrique à initierRetrait() dans lib/wallet.ts : le paiement d'une commission affiliée
// sort du wallet du marchand (il a déjà reçu la vente en entier), débit atomique conditionnel.
// Depuis le 20/10/2026, plus de transfert automatique (NotchPay refuse les IP non déclarées) :
// le paiement reste « en_attente », Axso est prévenu, fait le transfert dans NotchPay puis le
// clôture dans Admin › Affiliés (cloturerCommissionManuelle). Refusé → marchand recrédité.

export async function payerCommissionsAffilie(params: {
  tenantId: string;
  affilieId: string;
}): Promise<{ montant: number; paiementId: string }> {
  const { tenantId, affilieId } = params;

  const affilie = await prisma.affilie.findFirst({ where: { id: affilieId, tenantId } });
  if (!affilie) throw new Error("Affilié introuvable");
  if (!affilie.telephone) throw new Error("Numéro de téléphone du bénéficiaire requis pour le paiement");
  // Numéro au format international, indicatif du pays de la boutique (vérifié AVANT le débit du wallet).
  const { pays } = (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { pays: true } })) ?? {};
  const tel = normaliserTelephone(affilie.telephone, pays);
  if (!tel) throw new Error(`Numéro de ${affilie.nom} invalide : corrige-le (avec l'indicatif de son pays s'il est à l'étranger) avant de payer.`);

  const commissions = await prisma.commissionAffilie.findMany({
    where: { tenantId, affilieId, statut: "approuvee" },
  });
  const montant = Math.round(commissions.reduce((s, c) => s + c.montantCommission, 0) * 100) / 100;
  if (montant <= 0) throw new Error("Aucune commission approuvée à payer pour cet affilié");
  const commissionIds = commissions.map((c) => c.id);

  const paiement = await prisma.$transaction(async (tx) => {
    // Comme un retrait : seul le solde disponible (hors ventes en séquestre 48 h) peut sortir.
    const wallet = await debiterDisponibleTx(tx, tenantId, montant, true);

    // Conditionnel : deux paiements simultanés ne paient pas deux fois les mêmes commissions
    // (le second échoue ici et la transaction annule son débit du wallet).
    const prises = await tx.commissionAffilie.updateMany({
      where: { id: { in: commissionIds }, statut: "approuvee" },
      data: { statut: "payee" },
    });
    if (prises.count !== commissionIds.length) throw new Error("Commissions déjà en cours de paiement — rechargez la page");

    await tx.affilie.update({
      where: { id: affilieId },
      data: { commissionPending: { decrement: montant } },
    });

    const p = await tx.paiementCommission.create({
      data: { tenantId, affilieurId: affilieId, montant, methode: "mobile_money", telephone: tel, statut: "en_attente", commissionIds },
    });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id, type: "RETRAIT", montant: -montant, devise: wallet.devise,
        description: `Commission affilié — ${affilie.nom}`, reference: refCommission(p.id), statut: "en_cours",
      },
    });
    return p;
  });

  // Jamais bloquant : le paiement reste visible dans Admin › Affiliés même si l'alerte échoue.
  await signalerCommissionAValider(paiement.id).catch((e) => console.error("[affiliation] alerte admin", paiement.id, e?.message));

  return { montant, paiementId: paiement.id };
}

/** Lie la ligne RETRAIT du wallet marchand au paiement de commission (et sert de description NotchPay). */
export const refCommission = (paiementId: string) => `AXSO-AFF-${paiementId}`;

/** Prévient Axso qu'une commission attend son transfert (push du Command Center + e-mail détaillé). */
export async function signalerCommissionAValider(paiementId: string) {
  const p = await prisma.paiementCommission.findUniqueOrThrow({ where: { id: paiementId } });
  const [affilie, tenant] = await Promise.all([
    prisma.affilie.findUnique({ where: { id: p.affilieurId }, select: { nom: true, email: true } }),
    prisma.tenant.findUnique({
      where: { id: p.tenantId },
      select: { nomBoutique: true, slug: true, email: true, whatsapp: true, devise: true, wallet: { select: { solde: true, devise: true } }, proprietaires: { where: { role: "owner" }, take: 1, select: { user: { select: { name: true, email: true } } } } },
    }),
  ]);
  const dejaPayes = await prisma.paiementCommission.count({ where: { tenantId: p.tenantId, telephone: p.telephone, statut: "traite" } });
  const devise = tenant?.wallet?.devise ?? tenant?.devise ?? "XAF";
  const operateur = operateurCameroun(p.telephone);
  const boutique = tenant?.nomBoutique ?? p.tenantId;
  const montant = `${p.montant.toLocaleString("fr-FR")} ${devise}`;
  const res = await Promise.allSettled([
    pousserAdmins({ titre: "🤝 Commission d'affilié à valider", message: `${boutique} · ${montant} → ${affilie?.nom ?? "affilié"}`, lien: "/admin/affilies", type: "retrait_a_valider" }),
    envoyerAlerteRetrait({
      a: EMAIL_RETRAITS, lienAdmin: "https://axsoafrica.com/admin/affilies",
      retraitId: p.id, reference: refCommission(p.id), creeLe: p.createdAt,
      montant: p.montant, devise, methode: "mobile_money", operateur: operateur?.toUpperCase() ?? null, destinataire: p.telephone ?? "",
      canal: canalNotchPay({ methode: "mobile_money", operateur, devise, destinataire: p.telephone ?? "" }), notes: null,
      boutique, slug: tenant?.slug ?? "", proprietaire: tenant?.proprietaires[0]?.user ?? null,
      emailBoutique: tenant?.email ?? null, whatsappBoutique: tenant?.whatsapp ?? null,
      soldeApres: tenant?.wallet?.solde ?? null, premierRetraitVersCeNumero: dejaPayes === 0,
      affilie: affilie ? { nom: affilie.nom, email: affilie.email } : { nom: "affilié", email: "" },
    }).then((ok) => { if (!ok) throw new Error("e-mail non envoyé"); }),
  ]);
  res.forEach((x) => x.status === "rejected" && console.error("[affiliation] alerte", paiementId, x.reason?.message));
}

/**
 * Clôture par Axso d'un paiement de commission (transfert fait à la main dans NotchPay, ou impossible).
 * Payé : marchand et affilié prévenus. Refusé : marchand recrédité, commissions de nouveau payables.
 */
export async function cloturerCommissionManuelle(paiementId: string, paye: boolean) {
  const p = await prisma.paiementCommission.findUnique({ where: { id: paiementId } });
  if (!p) throw new Error("Paiement introuvable");
  if (p.reference) throw new Error("Ce paiement est suivi automatiquement par NotchPay");
  if (p.statut !== "en_attente") throw new Error("Ce paiement est déjà traité");
  const [affilie, tenant] = await Promise.all([
    prisma.affilie.findUnique({ where: { id: p.affilieurId }, select: { nom: true, email: true } }),
    prisma.tenant.findUnique({ where: { id: p.tenantId }, select: { nomBoutique: true, email: true, devise: true } }),
  ]);
  const montant = `${p.montant.toLocaleString("fr-FR")} ${tenant?.devise ?? ""}`.trim();
  if (paye) {
    const { count } = await prisma.paiementCommission.updateMany({ where: { id: paiementId, statut: "en_attente" }, data: { statut: "traite" } });
    if (!count) throw new Error("Ce paiement est déjà traité");
    await prisma.walletTransaction.updateMany({ where: { type: "RETRAIT", reference: refCommission(paiementId), statut: "en_cours" }, data: { statut: "completed" } });
    if (affilie?.email && tenant) {
      await envoyerEmailTexte({
        a: affilie.email, repondreA: tenant.email, boutique: tenant.nomBoutique,
        sujet: `Votre commission de ${montant} a été envoyée`,
        texte: `Bonjour ${affilie.nom},\n\n${tenant.nomBoutique} vous a versé ${montant} de commissions d'affiliation sur le ${p.telephone}.\n\nMerci pour votre recommandation !`,
      }).catch(() => false);
    }
  } else {
    // Pris d'abord, conditionnellement : de deux clôtures simultanées, seule la gagnante rembourse et prévient.
    const { count } = await prisma.paiementCommission.updateMany({ where: { id: paiementId, statut: "en_attente" }, data: { statut: "refus_en_cours" } });
    if (!count) throw new Error("Ce paiement est déjà traité");
    await rembourserPaiementCommissionEchoue(paiementId).catch(async (e) => {
      await prisma.paiementCommission.updateMany({ where: { id: paiementId, statut: "refus_en_cours" }, data: { statut: "en_attente" } });
      throw e;
    });
  }
  await notifierMarchand({
    tenantId: p.tenantId, type: paye ? "commission_payee" : "commission_refusee", lien: "/dashboard/affiliation",
    titre: paye ? `Commission de ${montant} versée à ${affilie?.nom ?? "l'affilié"}` : `Commission de ${montant} non versée`,
    message: paye
      ? `Axso a envoyé ${montant} à ${affilie?.nom ?? "l'affilié"} (${p.telephone}).`
      : `Le versement à ${affilie?.nom ?? "l'affilié"} (${p.telephone}) n'a pas pu être fait : ${montant} ont été remis sur votre solde et les commissions sont de nouveau à payer.`,
  });
}

// Idempotent : ne rembourse jamais deux fois le même paiement.
export async function rembourserPaiementCommissionEchoue(paiementId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Passage à « echec » d'abord, conditionnel : deux appels simultanés ne remboursent pas deux fois.
    const pris = await tx.paiementCommission.updateMany({ where: { id: paiementId, statut: { notIn: ["echec", "traite"] } }, data: { statut: "echec" } });
    if (!pris.count) return;
    const paiement = await tx.paiementCommission.findUniqueOrThrow({ where: { id: paiementId } });

    const wallet = await tx.wallet.findUnique({ where: { tenantId: paiement.tenantId } });
    if (!wallet) throw new Error("Wallet marchand introuvable"); // annule le passage à « echec »

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { solde: { increment: paiement.montant }, totalRetire: { decrement: paiement.montant } },
    });

    await tx.walletTransaction.updateMany({ where: { type: "RETRAIT", reference: refCommission(paiementId), statut: "en_cours" }, data: { statut: "echoue" } });
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "REMBOURSEMENT",
        montant: paiement.montant,
        devise: wallet.devise,
        description: `Remboursement — commission affilié échouée (${paiement.telephone ?? ""})`,
        statut: "completed",
      },
    });

    if (paiement.commissionIds.length > 0) {
      // Repasse payable, pas perdue — sauf la commission d'une commande remboursée ou annulée
      // entre-temps (libererCommande ne touche pas une commission « payee ») : rejetée.
      const commissions = await tx.commissionAffilie.findMany({ where: { id: { in: paiement.commissionIds } }, select: { id: true, commandeId: true, montantCommission: true } });
      const defaites = new Set((await tx.commande.findMany({
        where: { id: { in: commissions.map((c) => c.commandeId).filter((x): x is string => !!x) }, OR: [{ statut: "annulee" }, { paiementStatut: { in: ["refunded", "refunding"] } }] },
        select: { id: true },
      })).map((c) => c.id));
      const rejetees = commissions.filter((c) => c.commandeId && defaites.has(c.commandeId));
      const montantRejete = rejetees.reduce((s, c) => s + c.montantCommission, 0);
      await tx.commissionAffilie.updateMany({ where: { id: { in: rejetees.map((c) => c.id) } }, data: { statut: "rejetee" } });
      await tx.commissionAffilie.updateMany({ where: { id: { in: paiement.commissionIds }, statut: "payee" }, data: { statut: "approuvee" } });
      await tx.affilie.update({
        where: { id: paiement.affilieurId },
        data: {
          commissionPending: { increment: Math.round((paiement.montant - montantRejete) * 100) / 100 },
          ...(rejetees.length ? { conversions: { decrement: rejetees.length }, commissionTotal: { decrement: montantRejete } } : {}),
        },
      });
    }
  });
}

// ─── Legacy B2B (AffiliationLien/AffiliationCommission) ─────────────────────
// Traite toute la chaîne de paiement digital après confirmation :
// 1. Crédite le wallet tenant (net de la commission Axso)
// 2. Crée les tokens de téléchargement (1 par produit digital)
// Le calcul/crédit de commission d'affiliation (B2C comme B2B) est géré
// séparément par enregistrerConversionAffiliation, appelé depuis
// lib/paiement-commande.ts pour tous les types de commande.
export async function traiterPaiementDigital(params: {
  commande: {
    id: string;
    tenantId: string;
    clientEmail: string;
    clientNom: string;
    montantTotal: number;
    devise: string;
  };
  lignes: Array<{ produitId: string; produit?: { fichierUrl?: string | null; type?: string } | null; prix?: number; quantite?: number }>;
  reference: string;
  tauxCommission: number;
  fraisPasserelle?: number;
}) {
  const { commande, reference, tauxCommission, fraisPasserelle } = params;

  // Livraison (jetons, accès, clés, e-mail) — lib/livraison-numerique.ts, idempotente et journalisée.
  // Faite AVANT le crédit : le client a payé, ses accès ne dépendent jamais du portefeuille du marchand.
  // Elle passe la commande à « livrée » quand tout est livré ; sinon le journal le signale au
  // marchand et la réconciliation la reprend.
  await livrerCommandeDigitale(commande.id);

  await crediterWallet({
    tenantId: commande.tenantId,
    montantBrut: commande.montantTotal,
    tauxCommission,
    devise: commande.devise,
    description: `Vente digitale #${commande.id.slice(-6).toUpperCase()}`,
    lignes: params.lignes.every((l) => l.prix != null && l.quantite != null) ? params.lignes.map((l) => ({ prix: l.prix!, quantite: l.quantite! })) : undefined,
    commandeId: commande.id,
    reference,
    fraisPasserelle,
  });
}
