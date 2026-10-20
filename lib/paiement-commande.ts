// Confirmation d'un paiement de commande storefront — appelé par le webhook NotchPay
// et, en secours, par la page de confirmation si le webhook n'est pas encore arrivé.
// Idempotent : ne fait rien si la commande est déjà marquée payée.
import { prisma } from "./prisma";
import { crediterWallet } from "./wallet";
import { traiterPaiementDigital, enregistrerConversionAffiliation, capturerCommissionAffiliation, TYPES_LIVRAISON_DIGITALE } from "./affiliation";
import { notifierMarchand } from "./notifications-marchand";
import { formatMontant } from "./utils";
import { verifierPaiementNotchPay, paiementCouvre } from "./notchpay";
import { envoyerConfirmationCommande, envoyerAlerteNouvelleCommande } from "./email";
import { PAIEMENT } from "./commandes";
import { compterVentes } from "./stock";
import { rembourserCommande } from "./remboursement";
import { publier } from "./controle-ia/evenements";

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

/** La transaction NotchPay paie bien CETTE commande : aboutie, montant et devise couverts, référence liée. */
export function transactionAppartient(transaction: any, commande: { id: string; montantTotal: number; devise: string; paiementReference: string | null }, reference: string): boolean {
  const refMarchande = transaction?.merchant_reference ?? transaction?.trxref;
  // Sans référence marchande renvoyée, seule la référence NotchPay enregistrée à l'initialisation fait foi.
  const liee = refMarchande ? refMarchande === `ORD-${commande.id}` : !!commande.paiementReference && reference === commande.paiementReference && transaction?.reference === reference;
  return liee && paiementCouvre(transaction, commande.montantTotal, commande.devise);
}

/**
 * Confirme une commande UNIQUEMENT sur la transaction relue chez NotchPay (API authentifiée
 * par notre clé privée) : montant, devise et référence marchande contrôlés. Les données du
 * webhook, même signées, ne suffisent jamais ; si NotchPay ne répond pas, l'erreur remonte
 * (le webhook répond 500 et NotchPay le renverra ; la réconciliation repasse aussi).
 * Rejouable : un appel répété sur une commande déjà payée reprend seulement la
 * finalisation (crédit, livraison digitale, fournisseurs), qui est idempotente.
 */
export async function confirmerPaiementCommande(commandeId: string, reference: string) {
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    include: {
      tenant: { select: { id: true, commissionRate: true, nomBoutique: true, email: true, slug: true } },
      lignes: { include: { produit: { select: { id: true, type: true, fichierUrl: true } } } },
    },
  });
  if (!commande) return;
  if (commande.paiementStatut === PAIEMENT.PAYE) {
    if (reference === commande.paiementReference || reference === `ORD-${commandeId}`) return finaliserPaiementCommande(commandeId);
    return signalerDoublePaiement(commande, reference);
  }
  if (commande.paiementStatut !== PAIEMENT.ATTENTE && commande.paiementStatut !== PAIEMENT.ECHOUE) return; // remboursée

  // Le montant réellement payé est relu chez NotchPay : une transaction « complete »
  // d'un autre montant, d'une autre devise ou d'une autre commande ne paie pas celle-ci.
  const transaction = await verifierPaiementNotchPay(reference).then((r) => r.transaction).catch((e) => {
    if (e?.status === 404) return null; // transaction inconnue de NotchPay : refusée
    throw e; // NotchPay injoignable : réessayé plus tard, jamais confirmé à l'aveugle
  });
  if (!transactionAppartient(transaction, commande, reference)) {
    console.error("[paiement-commande] paiement refusé : ne correspond pas à la commande", {
      commandeId, reference, attendu: `${commande.montantTotal} ${commande.devise}`,
      recu: transaction ? `${transaction.amount} ${transaction.currency} (${transaction.status}, ${transaction.merchant_reference ?? transaction.trxref ?? "sans référence"})` : "transaction introuvable",
    });
    return;
  }

  const fraisPasserelle = fraisNotchPay(transaction);

  // Passage à « payé » ATOMIQUE : le webhook NotchPay et la page de confirmation
  // peuvent appeler cette fonction en même temps — un seul des deux continue.
  const pris = await prisma.commande.updateMany({
    where: { id: commandeId, paiementStatut: { in: [PAIEMENT.ATTENTE, PAIEMENT.ECHOUE] } },
    data: { paiementStatut: PAIEMENT.PAYE, paiementReference: reference },
  });
  if (pris.count === 0) return;
  await prisma.$transaction((tx) => compterVentes(tx, commandeId, 1));

  // Commande annulée par le marchand avant que le client ne valide son paiement :
  // jamais ressuscitée, l'argent est rendu tout de suite sur le moyen d'origine.
  if (commande.statut === "annulee") {
    const r = await rembourserCommande({ commandeId, tenantId: commande.tenantId, motif: `Paiement reçu après l'annulation #${commande.numero}`, restock: false });
    await notifierMarchand({
      tenantId: commande.tenantId, commandeId, type: "commande_remboursee",
      titre: `Paiement tardif sur la commande annulée #${commande.numero}`,
      message: r.ok ? "Le client a payé après l'annulation : il a été remboursé automatiquement via NotchPay." : `Le client a payé après l'annulation et le remboursement automatique a échoué (${r.error}). Rembourse-le depuis la commande.`,
      lien: `/dashboard/commandes/${commandeId}`,
    }).catch(() => {});
    return;
  }

  // Bus AXSO CONTROL (automatisations, webhooks) : part après la réponse, sans effet sur le paiement.
  for (const type of ["order.paid", "payment.completed"] as const) publier(commande.tenantId, type, { commandeId, numero: commande.numero, montant: commande.montantTotal, devise: commande.devise, methode: "en_ligne", reference });

  // Code promo : compté quand le paiement est réellement reçu (un paiement abandonné ne consomme pas le code).
  if (commande.codePromoId) {
    await prisma.codePromo.update({ where: { id: commande.codePromoId }, data: { utilisations: { increment: 1 } } }).catch(() => {});
  }

  // L'argent et les accès d'abord : les notifications ne doivent jamais les retarder ni les empêcher.
  await finaliserPaiementCommande(commandeId, fraisPasserelle);

  await notifierMarchand({
    tenantId: commande.tenantId,
    type: "nouvelle_commande",
    titre: `Nouvelle commande #${commande.numero}`,
    message: `${commande.clientNom} · ${commande.lignes.length} article(s) · ${formatMontant(commande.montantTotal, commande.devise)} · payé en ligne`,
    lien: `/dashboard/commandes/${commande.id}`,
    commandeId: commande.id,
  }).catch(() => {});

  const hasDigital = commande.lignes.some((l) => l.produit?.type && TYPES_LIVRAISON_DIGITALE.has(l.produit.type));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axsoafrica.com";

  // Achat digital : l'e-mail avec le lien d'accès part de la livraison (lib/livraison-numerique.ts),
  // journalisé et retenté. Ici seulement la confirmation d'une commande physique.
  if (commande.clientEmail && !hasDigital) {
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
      lien: `${appUrl}/dashboard/commandes/${commande.id}`,
    }).catch(() => {});
  }

  // Programme d'affiliation B2C : s'applique à TOUTE commande payée en ligne
  // (digitale ou physique) — la vente est acquise immédiatement ici, donc
  // enregistrement + capture directe (pas d'attente de livraison comme pour le COD).
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

/**
 * Ce qu'une commande payée en ligne doit produire : accès digitaux, ou confirmation +
 * commande fournisseur (dropshipping), puis crédit du portefeuille marchand.
 * Idempotent (crédit unique par commande, livraison digitale et commandes fournisseur
 * non recréées) : rejoué par le webhook, la page de retour et la réconciliation quotidienne
 * tant qu'une étape a échoué. `fraisPasserelle` inconnu (rejeu) : relu chez NotchPay.
 */
export async function finaliserPaiementCommande(commandeId: string, fraisPasserelle?: number) {
  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    include: { tenant: { select: { commissionRate: true } }, lignes: { include: { produit: { select: { id: true, type: true, fichierUrl: true } } } } },
  });
  if (!commande || commande.paiementStatut !== PAIEMENT.PAYE || commande.methodePaiement !== "notchpay" || commande.statut === "annulee") return;
  const reference = commande.paiementReference ?? `ORD-${commandeId}`;
  // Taux figé à la création de la commande (numérique +13 %, physique en ligne +10 %, lib/pricing.ts) :
  // une commande créée avant un changement de politique garde le sien. Anciennes commandes : taux de la boutique.
  const tauxCommission = commande.tauxCommission ?? commande.tenant.commissionRate ?? 0.1;
  const frais = fraisPasserelle ?? await verifierPaiementNotchPay(reference).then((r) => fraisNotchPay(r.transaction)).catch(() => 0);

  if (commande.lignes.some((l) => l.produit?.type && TYPES_LIVRAISON_DIGITALE.has(l.produit.type))) {
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
      fraisPasserelle: frais,
    });
    return;
  }
  // Dropshipping payé : confirmé, puis expédié par le fournisseur (cycle de livraison normal).
  await prisma.commande.updateMany({ where: { id: commandeId, statut: "en_attente" }, data: { statut: "confirmee" } });
  await routerVersFournisseurs(commandeId, commande.tenantId);
  await crediterWallet({
    tenantId: commande.tenantId,
    montantBrut: commande.montantTotal,
    // La livraison n'est pas majorée de la commission : elle revient en entier au marchand.
    montantHorsCommission: commande.montantLivraison,
    tauxCommission,
    devise: commande.devise,
    description: `Paiement reçu #${commande.numero}`,
    commandeId: commande.id,
    reference,
    fraisPasserelle: frais,
  });
}

// Deuxième paiement « complete » sur une commande déjà payée (le client a payé deux fois) :
// jamais crédité ni ignoré en silence — le marchand est prévenu pour rembourser le client.
async function signalerDoublePaiement(commande: { id: string; tenantId: string; numero: string; montantTotal: number; devise: string }, reference: string) {
  const transaction = await verifierPaiementNotchPay(reference).then((r) => r.transaction).catch(() => null);
  const refMarchande = transaction?.merchant_reference ?? transaction?.trxref;
  if (transaction?.status !== "complete" || refMarchande !== `ORD-${commande.id}`) return;
  console.error("[paiement-commande] DOUBLE PAIEMENT à rembourser", { commandeId: commande.id, reference, montant: transaction.amount, devise: transaction.currency });
  await notifierMarchand({
    tenantId: commande.tenantId, commandeId: commande.id, type: "commande_remboursee",
    titre: `Paiement en double sur la commande #${commande.numero}`,
    message: `Le client a payé deux fois (${formatMontant(Number(transaction.amount), String(transaction.currency))}, référence ${reference}). Le second paiement n'a pas été crédité : contacte le support Axso pour le lui rendre.`,
    lien: `/dashboard/commandes/${commande.id}`,
  }).catch(() => {});
}
