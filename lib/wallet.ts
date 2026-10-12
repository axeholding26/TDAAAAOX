// Wallet AXSO — logique métier
// Flux : paiement confirmé (NotchPay) → crédit wallet immédiat (montant net, commission déduite)
//        retrait    → débit wallet → virement NotchPay (Transfers)

import { prisma } from "./prisma";
import { versXAF } from "./devise-convert";
import { tauxDuJour } from "./taux-change";
import { initierTransfertNotchPay, verifierTransfertNotchPay, hasNotchPay } from "./notchpay";

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

// Revenu d'abonnement net des frais NotchPay réels sur cette transaction.
export async function crediterPlateformeAvecFrais(montantBrut: number, frais: number, devise: string, description: string, reference?: string) {
  const net = Math.max(0, montantBrut - frais);
  const taux = await tauxDuJour(); // hors transaction : aucun appel réseau pendant qu'elle est ouverte
  await prisma.$transaction(async (tx) => {
    if (net > 0) await crediterPlateformeTx(tx, taux, net, devise, description, reference);
    await logFraisPasserelleTx(tx, taux, frais, devise, `Frais NotchPay${reference ? ` · ${reference}` : ""}`, reference);
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

  // montantBrut = ce que le client a payé, déjà majoré de la commission côté storefront
  // (prix vendeur × (1 + tauxCommission)) — on extrait donc le net du vendeur par
  // division, on ne déduit RIEN de son prix : le vendeur reçoit exactement son prix.
  const montantNet = Math.round((montantBrut / (1 + tauxCommission)) * 100) / 100;
  const montantCommission = Math.round((montantBrut - montantNet) * 100) / 100;

  const taux = await tauxDuJour(); // hors transaction : aucun appel réseau pendant qu'elle est ouverte
  await prisma.$transaction(async (tx) => {
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
  });

  return { montantNet, montantCommission };
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
// Deux circuits :
// - automatique : Mobile Money MTN/Orange Cameroun en XAF → NotchPay Transfers
//   (seuls canaux de transfert que NotchPay propose) ;
// - manuel : tout le reste (autre opérateur, autre pays, virement bancaire) reste
//   « en_attente » sans référence et se traite depuis Admin › Finances.

// Lie la ligne RETRAIT du wallet à son retrait (et sert de référence marchande NotchPay).
const refRetrait = (retraitId: string) => `AXSO-${retraitId}`;

// Numéro mobile camerounais au format attendu par NotchPay, ou null.
export function telCameroun(saisie: string): string | null {
  const d = saisie.replace(/\D/g, "").replace(/^(00)?237/, "");
  return /^6\d{8}$/.test(d) ? `+237${d}` : null;
}

export async function initierRetrait(params: RetraitParams) {
  const { tenantId, methode, operateur, notes } = params;
  const destinataire = params.destinataire.trim();
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

  const op = (operateur ?? "").toLowerCase();
  const phone = methode === "mobile_money" && retrait.devise === "XAF" && (op === "mtn" || op === "orange") ? telCameroun(destinataire) : null;
  if (!phone || !hasNotchPay()) return retrait; // circuit manuel

  try {
    const { transfer } = await initierTransfertNotchPay({
      amount: montant,
      currency: retrait.devise,
      channel: `cm.${op}`,
      beneficiaryData: { name: nomBoutique, phone, country: "CM" },
      reference: refRetrait(retrait.id),
      description: "Retrait Axso Wallet",
      metadata: { retraitId: retrait.id },
    });
    const reference = typeof transfer === "string" ? transfer : (transfer?.reference ?? transfer?.id)?.toString();
    await appliquerStatutTransfert(retrait.id, typeof transfer === "string" ? "pending" : transfer?.status, reference);
  } catch (err: any) {
    // Refus explicite de la demande (numéro invalide…) : rien n'est parti, on recrédite.
    if (err?.status === 400 || err?.status === 422) {
      await rembourserRetraitEchoue(retrait.id);
      throw new Error(`Transfert refusé : ${err.message}. Le montant a été recrédité sur votre solde.`);
    }
    // Panne réseau, 5xx, accès refusé côté Axso : on ne sait pas si l'argent est
    // parti. Ne JAMAIS recréditer à l'aveugle (double paiement) — le retrait
    // reste en attente et passe dans le circuit manuel, à vérifier chez NotchPay.
    console.error("[wallet/retrait] transfert NotchPay incertain", retrait.id, err?.status, err?.message);
    await prisma.retrait.update({
      where: { id: retrait.id },
      data: { notes: [notes, `NotchPay : ${err?.message ?? "sans réponse"} — vérifier chez NotchPay avant de payer`].filter(Boolean).join(" · ") },
    });
  }

  const final = await prisma.retrait.findUniqueOrThrow({ where: { id: retrait.id } });
  if (final.statut === "echoue") throw new Error("Le transfert a échoué. Le montant a été recrédité sur votre solde.");
  return final;
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
