import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import { LIMITES, palierAuMoins, type Palier } from "./plans";
import { finEssai } from "./essai-regles";

const PALIERS_VALIDES = new Set<string>(["palier0", "palier1", "palier2"]);

// L'abonnement vaut pour le COMPTE : une boutique profite du meilleur palier
// en cours parmi toutes les boutiques de ses propriétaires. Payer le Palier 2
// sur la boutique A couvre donc aussi la boutique B du même compte.
export function boutiquesDuMemeCompte<S extends Prisma.TenantSelect>(tenantId: string, select: S) {
  return prisma.tenant.findMany({
    where: {
      OR: [
        { id: tenantId },
        { proprietaires: { some: { user: { boutiques: { some: { tenantId } } } } } },
      ],
    },
    select,
  });
}

// `plan` : ce dont la boutique profite (essai Illimité compris, voir lib/essai.ts) ;
// `planPaye` : le palier réellement payé, sans l'essai.
export async function planActif(tenantId: string): Promise<{ plan: Palier; planPaye: Palier; actif: boolean; essaiFinLe: Date | null }> {
  const tenants = await boutiquesDuMemeCompte(tenantId, { planType: true, planExpiresAt: true, essaiFinLe: true });

  const now = new Date();
  let planPaye: Palier = "palier0";
  for (const t of tenants) {
    // Valeurs héritées ("gratuit", "premium"...) des tenants créés avant les
    // paliers — ignorées, sinon tout code qui indexe LIMITES/FEATURES par
    // palier planterait (undefined).
    if (!PALIERS_VALIDES.has(t.planType) || !t.planExpiresAt || t.planExpiresAt < now) continue;
    if (palierAuMoins(t.planType as Palier, planPaye)) planPaye = t.planType as Palier;
  }
  const essaiFinLe = finEssai(tenants);
  return { plan: essaiFinLe && essaiFinLe > now ? "palier2" : planPaye, planPaye, actif: true, essaiFinLe };
}

// Nombre de commandes créées depuis le début du mois calendaire courant —
// base du quota Palier 0 (60/mois). Compte toutes les commandes reçues, y
// compris au-delà du quota (elles continuent d'arriver, voir
// quotaCommandesAtteint pour ce que le quota bloque réellement) — sauf les
// paiements en ligne jamais aboutis : la commande est créée avant le paiement,
// un visiteur qui abandonne ne doit pas consommer le quota du marchand.
export async function commandesCeMois(tenantId: string): Promise<number> {
  const debutDuMois = new Date();
  debutDuMois.setDate(1);
  debutDuMois.setHours(0, 0, 0, 0);
  return prisma.commande.count({
    where: {
      tenantId,
      createdAt: { gte: debutDuMois },
      NOT: { methodePaiement: { in: ["en_attente", "notchpay"] }, paiementStatut: { in: ["pending", "failed"] } },
    },
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

// Nouvelle échéance après un paiement de `jours` jours : un renouvellement du
// même palier encore actif s'ajoute aux jours restants (jamais perdus) ; un
// changement de palier ou un palier expiré repart d'aujourd'hui.
export function expirationApresPaiement(actuel: { planType: string; planExpiresAt: Date | null }, plan: string, jours: number, maintenant = new Date()): Date {
  const depart = actuel.planType === plan && actuel.planExpiresAt && actuel.planExpiresAt > maintenant ? actuel.planExpiresAt : maintenant;
  return new Date(depart.getTime() + jours * 24 * 3600 * 1000);
}
