// Confirmation d'un paiement de commande storefront — appelé par le webhook NotchPay
// et, en secours, par la page de confirmation si le webhook n'est pas encore arrivé.
// Idempotent : ne fait rien si la commande est déjà marquée payée.
import { lienBoutique } from "./origine-site";
import { prisma } from "./prisma";
import { crediterWallet } from "./wallet";
import { traiterPaiementDigital, enregistrerConversionAffiliation, capturerCommissionAffiliation, TYPES_LIVRAISON_DIGITALE } from "./affiliation";
import { notifierMarchand } from "./notifications-marchand";
import { formatMontant } from "./utils";
import { verifierPaiementNotchPay, paiementCouvre } from "./notchpay";
import { envoyerConfirmationCommande, envoyerAlerteNouvelleCommande } from "./email";
import { PAIEMENT } from "./commandes";
import { compterVentes } from "./stock";

export const NOTE_PRIX_ACHAT_MANQUANT = "Prix d'achat à renseigner : le montant fournisseur est incomplet.";

// Dropshipping : la commande payée part chez chaque fournisseur concerné.
async function routerVersFournisseurs(commandeId: string, tenantId: string) {
  const lignes = await prisma.ligneCommande.findMany({
    where: { commandeId, produit: { fournisseurId: { not: null } } },
    select: { prix: true, quantite: true, produit: { select: { fournisseurId: true, prixFournisseur: true } } },
  });
  // Montant = prix d'achat connus uniquement. Un prix manquant n'est jamais deviné :
  // il compte 0 et la commande fournisseur le signale.
  const parFournisseur = new Map<string, { montant: number; prixManquant: boolean }>();
  for (const l of lignes) {
    const f = l.produit.fournisseurId!;
    const cumul = parFournisseur.get(f) ?? { montant: 0, prixManquant: false };
    if (l.produit.prixFournisseur == null) cumul.prixManquant = true;
    else cumul.montant += l.produit.prixFournisseur * l.quantite;
    parFournisseur.set(f, cumul);
  }
  for (const [fournisseurId, { montant, prixManquant }] of parFournisseur) {
    const deja = await prisma.commandeFournisseur.findFirst({ where: { commandeId, fournisseurId } });
    // « en_attente » : aucun connecteur fournisseur n'est branché, rien n'est donc envoyé
    // tout seul — le marchand transmet la commande depuis Sourcing → Commandes fournisseurs.
    if (!deja) await prisma.commandeFournisseur.create({ data: { tenantId, commandeId, fournisseurId, montantFournisseur: montant, notes: prixManquant ? NOTE_PRIX_ACHAT_MANQUANT : null, statut: "en_attente", envoiAuto: true } });
  }
  if (parFournisseur.size) {
    await notifierMarchand({
      tenantId, commandeId, type: "commande_fournisseur",
      titre: "Commande à passer chez le fournisseur",
      message: `Une commande payée attend d'être transmise à ${parFournisseur.size} fournisseur(s). Le message de commande est prêt.${[...parFournisseur.values()].some((f) => f.prixManquant) ? " Prix d'achat à renseigner sur au moins un produit." : ""}`,
      lien: "/dashboard/sourcing?bloc=commandes",
    });
  }
}

// NotchPay prélève son propre frais de traitement sur chaque paiement — jamais
// déduit du vendeur, seulement de la commission Axso (voir lib/wallet.ts). On le
// lit directement depuis la transaction NotchPay plutôt que de le deviner.
function fraisNotchPay(transaction: any): number {
  const fees = transaction?.fees;
  if (Array.isArray(fees) && fees.length > 0) {
    return fees.reduce((s: number, f: any) => s + (Number(f?.amount) || 0), 0);
  }
  const amount = transaction?.amount;
  const total = transaction?.amounts?.total;
  if (typeof amount === "number" && typeof total === "number") {
    return Math.max(0, amount - total);
  }
  return 0;
}

/**
 * `transactionEvenement` : données du webhook signé, utilisées seulement si l'API
 * NotchPay ne répond pas. Sans transaction vérifiable, rien n'est confirmé.
 */
export async function confirmerPaiementCommande(commandeId: string, reference: string, transactionEvenement?: any) {
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    include: {
      tenant: { select: { id: true, commissionRate: true, nomBoutique: true, email: true, slug: true } },
      lignes: { include: { produit: { select: { id: true, type: true, fichierUrl: true } } } },
    },
  });
  if (!commande) return;
  if (commande.paiementStatut !== PAIEMENT.ATTENTE && commande.paiementStatut !== PAIEMENT.ECHOUE) return; // déjà traité (idempotence) ou remboursé

  // Le montant réellement payé est relu chez NotchPay : une transaction « complete »
  // d'un autre montant, d'une autre devise ou d'une autre commande ne paie pas celle-ci.
  const transaction = await verifierPaiementNotchPay(reference).then((r) => r.transaction).catch(() => transactionEvenement);
  const refMarchande = transaction?.merchant_reference ?? transaction?.trxref;
  if (!paiementCouvre(transaction, commande.montantTotal, commande.devise) || (refMarchande && refMarchande !== `ORD-${commandeId}`)) {
    console.error("[paiement-commande] paiement refusé : ne correspond pas à la commande", {
      commandeId, reference, attendu: `${commande.montantTotal} ${commande.devise}`,
      recu: transaction ? `${transaction.amount} ${transaction.currency} (${transaction.status}, ${refMarchande ?? "sans référence"})` : "transaction introuvable",
    });
    return;
  }

  const tauxCommission = commande.tenant.commissionRate ?? 0.1;
  const fraisPasserelle = fraisNotchPay(transaction);

  // Passage à « payé » ATOMIQUE : le webhook NotchPay et la page de confirmation
  // peuvent appeler cette fonction en même temps — un seul des deux continue,
  // sinon le wallet serait crédité deux fois.
  const pris = await prisma.commande.updateMany({
    where: { id: commandeId, paiementStatut: { in: [PAIEMENT.ATTENTE, PAIEMENT.ECHOUE] } },
    data: { paiementStatut: PAIEMENT.PAYE, paiementReference: reference },
  });
  if (pris.count === 0) return;
  await prisma.$transaction((tx) => compterVentes(tx, commandeId, 1));

  // Code promo : compté quand le paiement est réellement reçu (un paiement abandonné ne consomme pas le code).
  if (commande.codePromoId) {
    await prisma.codePromo.update({ where: { id: commande.codePromoId }, data: { utilisations: { increment: 1 } } }).catch(() => {});
  }

  await notifierMarchand({
    tenantId: commande.tenantId,
    type: "nouvelle_commande",
    titre: `Nouvelle commande #${commande.numero}`,
    message: `${commande.clientNom} · ${commande.lignes.length} article(s) · ${formatMontant(commande.montantTotal, commande.devise)} · payé en ligne`,
    lien: `/dashboard/commandes/${commande.id}`,
    commandeId: commande.id,
  });

  const hasDigital = commande.lignes.some((l) => l.produit?.type && TYPES_LIVRAISON_DIGITALE.has(l.produit.type));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axsoafrica.com";

  if (commande.clientEmail) {
    await envoyerConfirmationCommande({
      lienAcces: hasDigital ? await lienBoutique(commande.tenant.slug, `/confirmation/${commande.id}`) : undefined,
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
      lien: `${appUrl}/dashboard/commandes/${commande.id}`,
    }).catch(() => {});
  }

  if (hasDigital) {
    await traiterPaiementDigital({
      commande: {
        id: commande.id,
        tenantId: commande.tenantId,
        clientEmail: commande.clientEmail ?? "", // digital : email obligatoire à la commande
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
    // Dropshipping payé : confirmé, puis expédié par le fournisseur (cycle de livraison normal).
    await prisma.commande.update({ where: { id: commandeId }, data: { statut: "confirmee" } });
    await routerVersFournisseurs(commandeId, commande.tenantId).catch((e) => console.error("[routerVersFournisseurs]", e));
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
