import { prisma } from "./prisma";

export type TypeObjectif = "ca" | "commandes" | "clients" | "panier_moyen";

export const LABELS_TYPE_OBJECTIF: Record<TypeObjectif, string> = {
  ca: "Chiffre d'affaires",
  commandes: "Nombre de commandes",
  clients: "Nouveaux clients",
  panier_moyen: "Panier moyen",
};

// Calcule la progression réelle d'un objectif depuis sa création jusqu'à
// maintenant — jamais stockée comme seule source de vérité (actuel n'est
// qu'un cache), toujours recalculée en direct pour éviter toute dérive.
export async function calculerProgression(params: {
  tenantId: string;
  type: string;
  depuis: Date;
}): Promise<number> {
  const { tenantId, type, depuis } = params;

  if (type === "clients") {
    return prisma.client.count({ where: { tenantId, createdAt: { gte: depuis } } });
  }

  const agg = await prisma.commande.aggregate({
    where: { tenantId, createdAt: { gte: depuis }, statut: { not: "annulee" } },
    _sum: { montantTotal: true },
    _count: true,
  });

  if (type === "commandes") return agg._count;
  if (type === "panier_moyen") return agg._count > 0 ? Math.round(((agg._sum.montantTotal ?? 0) / agg._count) * 100) / 100 : 0;
  // "ca" par défaut
  return Math.round((agg._sum.montantTotal ?? 0) * 100) / 100;
}
