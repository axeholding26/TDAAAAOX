// Réconciliation des paiements NotchPay : filet de sécurité quand le webhook
// n'arrive jamais et que le client ne revient pas sur la page de confirmation.
// - commande en attente avec une transaction NotchPay → revérifiée et confirmée si payée ;
// - commande payée en ligne jamais créditée (erreur pendant la finalisation) → finalisée ;
// - livraison numérique incomplète ou e-mail du lien en échec → reprise ;
// - abonnement payé mais palier pas encore activé → activé ;
// - produit physique à payer en ligne, jamais payé après 24 h → annulée, stock rendu.
// Tout est idempotent. Appelée par cron/paiements (une fois par jour) et cron/automatisations
// (toutes les 5 à 15 min avec un planificateur externe) : sans webhook, un paiement est confirmé
// au passage suivant au lieu d'attendre le lendemain.
import { prisma } from "@/lib/prisma";
import { PAIEMENT } from "@/lib/commandes";
import { confirmerPaiementCommande, finaliserPaiementCommande } from "@/lib/paiement-commande";
import { verifierAbonnementEnAttente } from "@/lib/abonnement-paiement";
import { rendreStock } from "@/lib/stock";
import { reprendreLivraisons } from "@/lib/livraison-numerique";

const JOUR = 86_400_000;

export async function reconcilierPaiements() {
  const maintenant = Date.now();
  const bilan = { verifiees: 0, finalisees: 0, livraisons: 0, abonnements: 0, liberees: 0, erreurs: 0 };
  const essayer = async (f: () => Promise<unknown>) => { try { await f(); } catch (e) { bilan.erreurs++; console.error("[reconciliation-paiements]", e); } };

  // ponytail: 100 éléments par catégorie et par passage (60 s) ; passer à des paquets si le volume l'exige.
  const enAttente = await prisma.commande.findMany({
    where: { methodePaiement: "notchpay", paiementStatut: { in: [PAIEMENT.ATTENTE, PAIEMENT.ECHOUE] }, paiementReference: { not: null }, createdAt: { gte: new Date(maintenant - 3 * JOUR), lte: new Date(maintenant - 10 * 60_000) } },
    select: { id: true, paiementReference: true }, orderBy: { createdAt: "asc" }, take: 100,
  });
  for (const c of enAttente) { bilan.verifiees++; await essayer(() => confirmerPaiementCommande(c.id, c.paiementReference!)); }

  const payees = await prisma.commande.findMany({
    where: { methodePaiement: "notchpay", paiementStatut: PAIEMENT.PAYE, statut: { not: "annulee" }, updatedAt: { gte: new Date(maintenant - 14 * JOUR) } },
    select: { id: true }, orderBy: { updatedAt: "desc" }, take: 500,
  });
  const creditees = new Set((await prisma.walletTransaction.findMany({ where: { type: "CREDIT", commandeId: { in: payees.map((c) => c.id) } }, select: { commandeId: true } })).map((t) => t.commandeId));
  for (const c of payees.filter((c) => !creditees.has(c.id)).slice(0, 100)) { bilan.finalisees++; await essayer(() => finaliserPaiementCommande(c.id)); }

  // Livraisons numériques incomplètes ou e-mail du lien en échec : reprises (idempotent).
  await essayer(async () => { bilan.livraisons = await reprendreLivraisons(); });

  const abonnements = await prisma.tenant.findMany({ where: { planPendingRef: { not: null } }, select: { id: true }, take: 100 });
  for (const t of abonnements) await essayer(async () => { if (await verifierAbonnementEnAttente(t.id)) bilan.abonnements++; });

  // Le stock d'un produit physique sort à la commande : non payée, elle le bloquait pour toujours.
  // Payée plus tard quand même : confirmerPaiementCommande rembourse une commande annulée.
  const abandonnees = await prisma.commande.findMany({
    where: { methodePaiement: { in: ["en_attente", "notchpay"] }, paiementStatut: { in: [PAIEMENT.ATTENTE, PAIEMENT.ECHOUE] }, statut: "en_attente", createdAt: { lte: new Date(maintenant - JOUR) }, lignes: { some: { produit: { type: "physique" } } } },
    select: { id: true, numero: true }, take: 100,
  });
  for (const c of abandonnees) await essayer(() => prisma.$transaction(async (tx) => {
    const { count } = await tx.commande.updateMany({ where: { id: c.id, statut: "en_attente", paiementStatut: { in: [PAIEMENT.ATTENTE, PAIEMENT.ECHOUE] } }, data: { statut: "annulee" } });
    if (!count) return;
    await rendreStock(tx, { commandeId: c.id, motif: `Paiement en ligne non reçu #${c.numero}` });
    bilan.liberees++;
  }));

  return bilan;
}
