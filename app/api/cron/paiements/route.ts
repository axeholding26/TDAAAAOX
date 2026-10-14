// Réconciliation quotidienne des paiements NotchPay : filet de sécurité quand le webhook
// n'arrive jamais et que le client ne revient pas sur la page de confirmation.
// - commande en attente avec une transaction NotchPay → revérifiée et confirmée si payée ;
// - commande payée en ligne jamais créditée (erreur pendant la finalisation) → finalisée ;
// - abonnement payé mais palier pas encore activé → activé.
// Tout est idempotent. Protégée par CRON_SECRET comme les autres tâches planifiées.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PAIEMENT } from "@/lib/commandes";
import { confirmerPaiementCommande, finaliserPaiementCommande } from "@/lib/paiement-commande";
import { verifierAbonnementEnAttente } from "@/lib/abonnement-paiement";

export const maxDuration = 60;

function autorise(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && (req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`);
}

const JOUR = 86_400_000;

export async function GET(req: Request) {
  if (!autorise(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const maintenant = Date.now();
  const bilan = { verifiees: 0, finalisees: 0, abonnements: 0, erreurs: 0 };
  const essayer = async (f: () => Promise<unknown>) => { try { await f(); } catch (e) { bilan.erreurs++; console.error("[cron/paiements]", e); } };

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

  const abonnements = await prisma.tenant.findMany({ where: { planPendingRef: { not: null } }, select: { id: true }, take: 100 });
  for (const t of abonnements) await essayer(async () => { if (await verifierAbonnementEnAttente(t.id)) bilan.abonnements++; });

  console.log("[cron/paiements]", bilan);
  return NextResponse.json(bilan);
}
