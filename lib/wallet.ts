// Wallet AXSO — logique métier
// Flux : paiement confirmé (NotchPay) → crédit wallet immédiat (montant net, commission déduite)
//        retrait    → débit wallet → virement NotchPay (Transfers)

import { prisma } from "./prisma";
import { versXAF } from "./devise-convert";
import { tauxDuJour } from "./taux-change";
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

  return {
    ...wallet,
    retraitsEnAttente: wallet.retraits.filter((r) => r.statut === "en_attente").reduce((s, r) => s + r.montant, 0),
  };
}
