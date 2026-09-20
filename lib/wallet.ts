// Wallet AXSO — logique métier
// Flux : paiement confirmé (NotchPay) → crédit wallet immédiat (montant net, commission déduite)
//        retrait    → débit wallet → virement NotchPay (Transfers)

import { prisma } from "./prisma";
import { initierTransfertNotchPay } from "./notchpay";

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

async function crediterPlateformeTx(tx: any, montant: number, devise: string, description: string, reference?: string) {
  if (montant <= 0) return;
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

// Crédit direct plein montant (aucun partage marchand) — utilisé pour le revenu
// d'abonnement, qui appartient à 100% à Axso.
export async function crediterPlateforme(montant: number, devise: string, description: string, reference?: string) {
  await prisma.$transaction(async (tx) => {
    await crediterPlateformeTx(tx, montant, devise, description, reference);
  });
}

async function logFraisPasserelleTx(tx: any, frais: number, devise: string, description: string, reference?: string) {
  if (frais <= 0) return;
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
  await prisma.$transaction(async (tx) => {
    if (net > 0) await crediterPlateformeTx(tx, net, devise, description, reference);
    await logFraisPasserelleTx(tx, frais, devise, `Frais NotchPay${reference ? ` · ${reference}` : ""}`, reference);
  });
}

// ─── Récompenser un marchand ───────────────────────────────────────────────────
// Bonus versé par Axso depuis son propre wallet plateforme — débite réellement
// la plateforme (même débit atomique conditionnel que initierRetrait) pour ne
// jamais promettre plus d'argent que ce qu'Axso a réellement en caisse.
export async function crediterBonusWallet(tenantId: string, montant: number, devise: string, raison: string) {
  await prisma.$transaction(async (tx) => {
    const platformTenantId = await getOrCreatePlatformTenantId(tx);
    const debit = await tx.wallet.updateMany({
      where: { tenantId: platformTenantId, solde: { gte: montant } },
      data: { solde: { decrement: montant }, totalRetire: { increment: montant } },
    });
    if (debit.count === 0) throw new Error("Solde plateforme insuffisant pour ce bonus");

    const platformWallet = await tx.wallet.findUnique({ where: { tenantId: platformTenantId } });
    await tx.walletTransaction.create({
      data: { walletId: platformWallet!.id, type: "RETRAIT", montant: -montant, devise, description: `Bonus marchand · ${raison}`, statut: "completed" },
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
          await crediterPlateformeTx(tx, commissionNette, devise, `Commission sur vente${reference ? ` · ${reference}` : ""}`, reference);
        }
        await logFraisPasserelleTx(tx, frais, devise, `Frais NotchPay${reference ? ` · ${reference}` : ""}`, reference);
      }
    }
  });

  return { montantNet, montantCommission };
}

// ─── Initier un retrait ───────────────────────────────────────────────────────
// Sécurité : le débit du solde et sa vérification sont une SEULE opération atomique
// (updateMany conditionnel) pour éliminer toute race condition entre deux retraits
// concurrents qui passeraient tous les deux un contrôle de solde fait séparément.

export async function initierRetrait(params: RetraitParams) {
  const { tenantId, montant, devise, methode, destinataire, operateur, notes } = params;

  const MINIMUM = 1000;
  if (montant < MINIMUM) throw new Error(`Montant minimum de retrait : ${MINIMUM} ${devise}`);

  const retrait = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { tenantId } });
    if (!wallet) throw new Error("Wallet introuvable");

    // Débit conditionnel atomique — échoue (count 0) si le solde a changé entre
    // temps (retrait concurrent) et ne descend jamais sous 0.
    const debit = await tx.wallet.updateMany({
      where: { tenantId, solde: { gte: montant } },
      data: { solde: { decrement: montant }, totalRetire: { increment: montant } },
    });
    if (debit.count === 0) throw new Error("Solde insuffisant");

    // Ligne de transaction RETRAIT
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "RETRAIT",
        montant: -montant,
        devise,
        description: `Retrait ${methode === "mobile_money" ? `Mobile Money (${operateur ?? ""})` : "Virement bancaire"} → ${destinataire}`,
        statut: "en_cours",
      },
    });

    // Enregistrement du retrait
    const r = await tx.retrait.create({
      data: {
        walletId: wallet.id,
        tenantId,
        montant,
        devise,
        methode,
        destinataire,
        operateur,
        notes,
        statut: "en_attente",
      },
    });

    return r;
  });

  // Appel NotchPay Transfers si clés configurées
  if (process.env.NOTCHPAY_PUBLIC_KEY && process.env.NOTCHPAY_PRIVATE_KEY) {
    try {
      // Le formulaire wallet ne propose aujourd'hui que MTN/Orange Cameroun (+237)
      const channel =
        methode === "mobile_money"
          ? `cm.${(operateur ?? "mtn").toLowerCase()}`
          : "cm";
      const { transfer } = await initierTransfertNotchPay({
        amount: montant,
        currency: devise,
        channel,
        beneficiaryData:
          methode === "mobile_money"
            ? { name: destinataire, phone: destinataire, country: "CM" }
            : {
                name: destinataire.split("|")[0] ?? destinataire,
                account_number: destinataire.split("|")[1] ?? destinataire,
              },
        reference: `AXSO-${retrait.id}`,
        description: "Retrait Axso Wallet",
      });

      const ref = transfer?.id?.toString();
      const echecImmediat = transfer?.status === "failed" || transfer?.status === "canceled";

      if (echecImmediat) {
        await rembourserRetraitEchoue(retrait.id);
      } else {
        const statut = transfer?.status === "complete" || transfer?.status === "processing" ? "traitement" : "en_attente";
        await prisma.retrait.update({ where: { id: retrait.id }, data: { statut, reference: ref } });
        if (ref) {
          await prisma.walletTransaction.updateMany({
            where: { walletId: retrait.walletId, type: "RETRAIT", statut: "en_cours" },
            data: { statut: "completed", reference: ref },
          });
        }
      }
    } catch {
      // L'appel NotchPay a échoué avant même de renvoyer un statut — le marchand
      // ne doit jamais perdre cet argent : remboursement automatique immédiat.
      await rembourserRetraitEchoue(retrait.id);
    }
  }

  return retrait;
}

// ─── Rembourser un retrait qui a échoué ───────────────────────────────────────
// Appelé soit en synchrone (échec immédiat de l'appel NotchPay), soit depuis le
// webhook (`transfer.failed`) si l'échec arrive plus tard. Idempotent : ne
// rembourse jamais deux fois le même retrait.
export async function rembourserRetraitEchoue(retraitId: string) {
  await prisma.$transaction(async (tx) => {
    const retrait = await tx.retrait.findUnique({ where: { id: retraitId } });
    if (!retrait) return;
    // Idempotence : un retrait déjà remboursé ou déjà complété ne doit plus bouger.
    if (retrait.statut === "echoue" || retrait.statut === "complete") return;

    await tx.wallet.update({
      where: { id: retrait.walletId },
      data: {
        solde: { increment: retrait.montant },
        totalRetire: { decrement: retrait.montant },
      },
    });

    await tx.walletTransaction.create({
      data: {
        walletId: retrait.walletId,
        type: "REMBOURSEMENT",
        montant: retrait.montant,
        devise: retrait.devise,
        description: `Remboursement — retrait échoué (${retrait.destinataire})`,
        commandeId: undefined,
        statut: "completed",
      },
    });

    await tx.walletTransaction.updateMany({
      where: { walletId: retrait.walletId, type: "RETRAIT", statut: "en_cours" },
      data: { statut: "echoue" },
    });

    await tx.retrait.update({ where: { id: retraitId }, data: { statut: "echoue" } });
  });
}

// ─── Résumé wallet (pour le dashboard) ───────────────────────────────────────

export async function getWalletResume(tenantId: string) {
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

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { commissionRate: true } });
  const tauxCommission = tenant?.commissionRate ?? 0.06;

  // Solde en séquestre (commandes confirmées mais escrow non libéré)
  const escrowsActifs = await prisma.escrow.aggregate({
    where: { tenantId, statut: "held" },
    _sum: { montant: true },
  });

  const soldeSequestre = escrowsActifs._sum.montant ?? 0;
  const netSequestre = soldeSequestre / (1 + tauxCommission);

  return {
    ...wallet,
    soldeSequestre: netSequestre,
    retraitsEnAttente: wallet.retraits.filter((r) => r.statut === "en_attente").reduce((s, r) => s + r.montant, 0),
  };
}
