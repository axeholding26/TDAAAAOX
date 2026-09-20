import { prisma } from "./prisma";
import { crediterWallet } from "./wallet";
import { initierTransfertNotchPay } from "./notchpay";
import { livrerBundle } from "./bundle-delivery";

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

// ─── Répartition B2B (legacy, AffiliationLien/AffiliationCommission) ────────

export function calculerRepartition(
  montantTotal: number,
  tauxCommission: number,
  tauxAff: number | null | undefined,
  codeAffiliation: string | null | undefined
): { axso: number; affilieur: number; tenant: number } {
  const axso = Math.round(montantTotal * tauxCommission * 100) / 100;
  let affilieur = 0;
  if (codeAffiliation && tauxAff && tauxAff > 0) {
    affilieur = Math.round(montantTotal * tauxAff * 100) / 100;
  }
  const tenant = Math.round((montantTotal - axso - affilieur) * 100) / 100;
  return { axso, affilieur, tenant };
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
export const TYPES_LIVRAISON_DIGITALE = new Set(["digital", "fichier", "formation", "licence", "bundle"]);

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
  commande: { clientEmail: string; clientTelephone: string }
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
    clientEmail: string;
    clientTelephone: string;
    montantTotal: number;
    codeAffiliation?: string | null;
  };
  lignes: Array<{ produitId: string; prix: number; quantite: number }>;
}): Promise<void> {
  const { commande, lignes } = params;
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
      montantLigne: ligne.prix * ligne.quantite,
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
// ligne (même logique que la capture de Commission/Escrow existante).
export async function capturerCommissionAffiliation(commandeId: string): Promise<void> {
  await prisma.commissionAffilie.updateMany({
    where: { commandeId, statut: "pending" },
    data: { statut: "approuvee" },
  });
}

// ─── Paiement réel des commissions (NotchPay Transfers) ─────────────────────
// Symétrique à initierRetrait() dans lib/wallet.ts : le paiement d'une
// commission affiliée est un coût qui sort du wallet du marchand (il a déjà
// reçu la vente en entier), débit atomique conditionnel + remboursement
// automatique si le transfert échoue.

export async function payerCommissionsAffilie(params: {
  tenantId: string;
  affilieId: string;
}): Promise<{ montant: number; paiementId: string }> {
  const { tenantId, affilieId } = params;

  const affilie = await prisma.affilie.findFirst({ where: { id: affilieId, tenantId } });
  if (!affilie) throw new Error("Affilié introuvable");
  if (!affilie.telephone) throw new Error("Numéro de téléphone du bénéficiaire requis pour le paiement");

  const commissions = await prisma.commissionAffilie.findMany({
    where: { tenantId, affilieId, statut: "approuvee" },
  });
  const montant = Math.round(commissions.reduce((s, c) => s + c.montantCommission, 0) * 100) / 100;
  if (montant <= 0) throw new Error("Aucune commission approuvée à payer pour cet affilié");
  const commissionIds = commissions.map((c) => c.id);

  const paiement = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { tenantId } });
    if (!wallet) throw new Error("Wallet marchand introuvable");

    const debit = await tx.wallet.updateMany({
      where: { tenantId, solde: { gte: montant } },
      data: { solde: { decrement: montant }, totalRetire: { increment: montant } },
    });
    if (debit.count === 0) throw new Error("Solde insuffisant pour payer cette commission");

    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "RETRAIT",
        montant: -montant,
        devise: wallet.devise,
        description: `Commission affilié — ${affilie.nom}`,
        statut: "en_cours",
      },
    });

    await tx.commissionAffilie.updateMany({
      where: { id: { in: commissionIds } },
      data: { statut: "payee" },
    });

    await tx.affilie.update({
      where: { id: affilieId },
      data: { commissionPending: { decrement: montant } },
    });

    return tx.paiementCommission.create({
      data: {
        tenantId,
        affilieurId: affilieId,
        montant,
        methode: "mobile_money",
        telephone: affilie.telephone,
        statut: "en_attente",
        commissionIds,
      },
    });
  });

  if (process.env.NOTCHPAY_PUBLIC_KEY && process.env.NOTCHPAY_PRIVATE_KEY) {
    try {
      const wallet = await prisma.wallet.findUnique({ where: { tenantId } });
      const { transfer } = await initierTransfertNotchPay({
        amount: montant,
        currency: wallet?.devise ?? "XAF",
        channel: "cm.mtn", // formulaire affilié n'a pas encore de sélecteur d'opérateur — MTN par défaut
        beneficiaryData: { name: affilie.nom, phone: affilie.telephone, country: "CM" },
        reference: `AXSO-AFF-${paiement.id}`,
        description: "Commission affiliation Axso",
      });
      const echecImmediat = transfer?.status === "failed" || transfer?.status === "canceled";
      if (echecImmediat) {
        await rembourserPaiementCommissionEchoue(paiement.id);
      } else {
        const statut = transfer?.status === "complete" || transfer?.status === "processing" ? "traite" : "en_attente";
        await prisma.paiementCommission.update({
          where: { id: paiement.id },
          data: { statut, reference: transfer?.id?.toString() },
        });
      }
    } catch {
      // Le transfert a échoué avant de renvoyer un statut exploitable —
      // l'affilié ne doit jamais rester "payé" sans avoir reçu l'argent.
      await rembourserPaiementCommissionEchoue(paiement.id);
    }
  }

  return { montant, paiementId: paiement.id };
}

// Idempotent : ne rembourse jamais deux fois le même paiement.
export async function rembourserPaiementCommissionEchoue(paiementId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const paiement = await tx.paiementCommission.findUnique({ where: { id: paiementId } });
    if (!paiement) return;
    if (paiement.statut === "echec" || paiement.statut === "traite") return;

    const wallet = await tx.wallet.findUnique({ where: { tenantId: paiement.tenantId } });
    if (!wallet) return;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { solde: { increment: paiement.montant }, totalRetire: { decrement: paiement.montant } },
    });

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
      await tx.commissionAffilie.updateMany({
        where: { id: { in: paiement.commissionIds } },
        data: { statut: "approuvee" }, // repasse payable, pas perdue
      });
      await tx.affilie.update({
        where: { id: paiement.affilieurId },
        data: { commissionPending: { increment: paiement.montant } },
      });
    }

    await tx.paiementCommission.update({ where: { id: paiementId }, data: { statut: "echec" } });
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
  lignes: Array<{ produitId: string; produit?: { fichierUrl?: string | null; type?: string } | null }>;
  reference: string;
  tauxCommission: number;
  fraisPasserelle?: number;
}) {
  const { commande, lignes, reference, tauxCommission, fraisPasserelle } = params;

  const produits = await prisma.produit.findMany({
    where: { id: { in: lignes.map((l) => l.produitId) }, type: { in: [...TYPES_LIVRAISON_DIGITALE] } },
    select: {
      id: true, type: true, fichierUrl: true,
      produitFichier: true,
      licenceProduit: true,
    },
  });

  await crediterWallet({
    tenantId: commande.tenantId,
    montantBrut: commande.montantTotal,
    tauxCommission,
    devise: commande.devise,
    description: `Vente digitale #${commande.id.slice(-6).toUpperCase()}`,
    commandeId: commande.id,
    reference,
    fraisPasserelle,
  });

  // Livraison — un mécanisme distinct par type de produit digital.
  const crypto = await import("crypto");
  const EXPIRE_FICHIER_JOURS = 365; // achat = accès longue durée, pas 48h comme le legacy

  for (const produit of produits) {
    try {
      if (produit.type === "digital") {
        // Legacy — un seul fichier direct, accès court (comportement historique conservé).
        if (!produit.fichierUrl) continue;
        const token = crypto.randomBytes(32).toString("hex");
        await prisma.telechargement.create({
          data: { produitId: produit.id, commandeId: commande.id, token, expireAt: new Date(Date.now() + 48 * 3600 * 1000) },
        });
      } else if (produit.type === "fichier" && produit.produitFichier) {
        // Nouveau système multi-fichiers — un token couvre tous les fichiers du produit
        // (voir app/api/telechargements/[token] qui liste via ?fichier=<id>).
        const token = crypto.randomBytes(32).toString("hex");
        await prisma.telechargement.create({
          data: { produitId: produit.id, commandeId: commande.id, token, expireAt: new Date(Date.now() + EXPIRE_FICHIER_JOURS * 86400 * 1000) },
        });
      } else if (produit.type === "formation") {
        // Accès à vie au contenu de la formation, via token self-service.
        const token = crypto.randomBytes(32).toString("hex");
        await prisma.accesFormation.create({
          data: { produitId: produit.id, commandeId: commande.id, token, clientEmail: commande.clientEmail },
        });
      } else if (produit.type === "licence" && produit.licenceProduit) {
        // Attribue la prochaine clé disponible (générée/importée à l'avance par le
        // marchand). Si le stock de clés est épuisé, on ne bloque pas la commande —
        // le marchand doit en générer davantage, visible via ses stats de licence.
        const cle = await prisma.cleLicence.findFirst({
          where: { licenceProduitId: produit.licenceProduit.id, statut: "disponible" },
          orderBy: { createdAt: "asc" },
        });
        if (cle) {
          const expiry = produit.licenceProduit.dureeJours
            ? new Date(Date.now() + produit.licenceProduit.dureeJours * 86400 * 1000)
            : null;
          await prisma.cleLicence.update({
            where: { id: cle.id },
            data: { statut: "vendue", commandeId: commande.id, acheteurEmail: commande.clientEmail, expireAt: expiry },
          });
        }
      } else if (produit.type === "bundle") {
        // Résout et livre chaque élément inclus (fichier/licence/digital) — déjà
        // implémenté dans lib/bundle-delivery.ts, jamais appelé jusqu'ici.
        await livrerBundle(commande.id, produit.id);
      }
    } catch (err) {
      // Une livraison en échec ne doit jamais bloquer la confirmation des autres
      // lignes ni du paiement lui-même — le marchand voit l'erreur dans ses logs.
      console.error(`[traiterPaiementDigital] échec livraison produit ${produit.id} (${produit.type})`, err);
    }
  }

  await prisma.commande.update({
    where: { id: commande.id },
    data: { paiementStatut: "completed", statut: "livree" },
  });
}
