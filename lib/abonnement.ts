import { prisma } from "./prisma";
import { LIMITES, palierAuMoins, type Palier } from "./plans";

const PALIERS_VALIDES = new Set<string>(["palier0", "palier1", "palier2"]);

// L'abonnement vaut pour le COMPTE : une boutique profite du meilleur palier
// en cours parmi toutes les boutiques de ses propriétaires. Payer le Palier 2
// sur la boutique A couvre donc aussi la boutique B du même compte.
export async function planActif(tenantId: string): Promise<{ plan: Palier; actif: boolean }> {
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { id: tenantId },
        { proprietaires: { some: { user: { boutiques: { some: { tenantId } } } } } },
      ],
    },
    select: { planType: true, planExpiresAt: true },
  });

  const now = new Date();
  let plan: Palier = "palier0";
  for (const t of tenants) {
    // Valeurs héritées ("gratuit", "premium"...) des tenants créés avant les
    // paliers — ignorées, sinon tout code qui indexe LIMITES/FEATURES par
    // palier planterait (undefined).
    if (!PALIERS_VALIDES.has(t.planType) || !t.planExpiresAt || t.planExpiresAt < now) continue;
    if (palierAuMoins(t.planType as Palier, plan)) plan = t.planType as Palier;
  }
  return { plan, actif: true };
}

// Nombre de commandes créées depuis le début du mois calendaire courant —
// base du quota Palier 0 (30/mois). Compte TOUTES les commandes reçues, y
// compris au-delà du quota (elles continuent d'arriver, voir
// quotaCommandesAtteint pour ce que le quota bloque réellement).
export async function commandesCeMois(tenantId: string): Promise<number> {
  const debutDuMois = new Date();
  debutDuMois.setDate(1);
  debutDuMois.setHours(0, 0, 0, 0);
  return prisma.commande.count({
    where: { tenantId, createdAt: { gte: debutDuMois } },
  });
}

// Quota de commandes Palier 0 atteint : le marchand ne peut plus agir sur ses
// commandes (ni les nouvelles ni les anciennes) ni utiliser WhatsApp tant
// qu'il n'upgrade pas ou que le mois ne change pas. Les commandes elles-mêmes
// continuent d'être créées normalement — ce n'est jamais le checkout client
// qui est bloqué, uniquement les actions marchand en aval.
export async function quotaCommandesAtteint(tenantId: string): Promise<boolean> {
  const { plan } = await planActif(tenantId);
  const limite = LIMITES[plan]?.commandesParMois ?? null;
  if (limite === null) return false;
  const utilisees = await commandesCeMois(tenantId);
  return utilisees >= limite;
}
