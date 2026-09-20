// Confirmation d'un paiement de commande storefront — appelé par le webhook NotchPay
// et, en secours, par la page de confirmation si le webhook n'est pas encore arrivé.
// Idempotent : ne fait rien si la commande est déjà marquée payée.
import { prisma } from "./prisma";
import { crediterWallet } from "./wallet";
import { traiterPaiementDigital, enregistrerConversionAffiliation, capturerCommissionAffiliation, TYPES_LIVRAISON_DIGITALE } from "./affiliation";
import { notifierMarchand } from "./notifications-marchand";
import { formatMontant } from "./utils";
import { verifierPaiementNotchPay } from "./notchpay";
import { envoyerConfirmationCommande, envoyerAlerteNouvelleCommande } from "./email";

// NotchPay prélève son propre frais de traitement sur chaque paiement — jamais
// déduit du vendeur, seulement de la commission Axso (voir lib/wallet.ts). On le
// lit directement depuis la transaction NotchPay plutôt que de le deviner.
async function fraisNotchPay(reference: string): Promise<number> {
  try {
    const { transaction } = await verifierPaiementNotchPay(reference);
    const fees = (transaction as any)?.fees;
    if (Array.isArray(fees) && fees.length > 0) {
      return fees.reduce((s: number, f: any) => s + (Number(f?.amount) || 0), 0);
    }
    const amount = (transaction as any)?.amount;
    const total = (transaction as any)?.amounts?.total;
    if (typeof amount === "number" && typeof total === "number") {
      return Math.max(0, amount - total);
    }
  } catch {
    // Ne bloque jamais la confirmation du paiement pour ça — la commission sera
    // comptée brute cette fois, sans grever le crédit du vendeur.
  }
  return 0;
}

export async function confirmerPaiementCommande(commandeId: string, reference: string) {
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    include: {
      tenant: { select: { id: true, commissionRate: true, nomBoutique: true, email: true } },
      lignes: { include: { produit: { select: { id: true, type: true, fichierUrl: true } } } },
    },
  });
  if (!commande) return;
  if (commande.paiementStatut === "completed") return; // déjà traité (idempotence)

  const tauxCommission = commande.tenant.commissionRate ?? 0.06;
  const fraisPasserelle = await fraisNotchPay(reference);

  await prisma.commande.update({
    where: { id: commandeId },
    data: { paiementStatut: "completed", paiementReference: reference },
  });

  await notifierMarchand({
    tenantId: commande.tenantId,
    type: "nouvelle_commande",
    titre: `Nouvelle commande #${commande.numero}`,
    message: `${commande.clientNom} · ${commande.lignes.length} article(s) · ${formatMontant(commande.montantTotal, commande.devise)} · payé en ligne`,
    lien: `/dashboard/commandes/${commande.id}`,
    commandeId: commande.id,
  });

  if (commande.clientEmail) {
    await envoyerConfirmationCommande({
      email: commande.clientEmail,
      nom: commande.clientNom,
      numeroCommande: commande.numero,
      montantTotal: commande.montantTotal,
      devise: commande.devise,
      produits: commande.lignes.map((l) => ({ nom: l.nom, quantite: l.quantite, prix: l.prix })),
      boutique: commande.tenant.nomBoutique,
    }).catch(() => {});
  }
  if (commande.tenant.email) {
    await envoyerAlerteNouvelleCommande({
      email: commande.tenant.email,
      numeroCommande: commande.numero,
      montantTotal: commande.montantTotal,
      devise: commande.devise,
      clientNom: commande.clientNom,
      boutique: commande.tenant.nomBoutique,
      lien: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://axso.vercel.app"}/dashboard/commandes/${commande.id}`,
    }).catch(() => {});
  }

  const hasDigital = commande.lignes.some((l) => l.produit?.type && TYPES_LIVRAISON_DIGITALE.has(l.produit.type));

  if (hasDigital) {
    await traiterPaiementDigital({
      commande: {
        id: commande.id,
        tenantId: commande.tenantId,
        clientEmail: commande.clientEmail,
        clientNom: commande.clientNom,
        montantTotal: commande.montantTotal,
        devise: commande.devise,
      },
      lignes: commande.lignes.map((l) => ({ produitId: l.produitId, produit: l.produit })),
      reference,
      tauxCommission,
      fraisPasserelle,
    });
  } else {
    await prisma.commande.update({ where: { id: commandeId }, data: { statut: "confirmee" } });
    await crediterWallet({
      tenantId: commande.tenantId,
      montantBrut: commande.montantTotal,
      tauxCommission,
      devise: commande.devise,
      description: `Paiement reçu #${commande.numero}`,
      commandeId: commande.id,
      reference,
      fraisPasserelle,
    }).catch(() => {});
  }

  // Programme d'affiliation B2C : s'applique à TOUTE commande payée en ligne
  // (digitale ou physique), pas seulement au digital — la vente est acquise
  // immédiatement ici (paiement en ligne confirmé), donc enregistrement +
  // capture directe (pas d'attente de livraison comme pour le COD).
  await enregistrerConversionAffiliation({
    commande: {
      id: commande.id,
      tenantId: commande.tenantId,
      clientEmail: commande.clientEmail,
      clientTelephone: commande.clientTelephone,
      montantTotal: commande.montantTotal,
      codeAffiliation: commande.codeAffiliation,
    },
    lignes: commande.lignes.map((l) => ({ produitId: l.produitId, prix: l.prix, quantite: l.quantite })),
  }).catch(() => {});
  await capturerCommissionAffiliation(commande.id).catch(() => {});
}
