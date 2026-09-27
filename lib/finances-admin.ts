// Totaux de commissions pour l'admin AXSO : chaque commission est dans la devise
// de SA boutique (FCFA, naira, cedi…) — les additionner telles quelles mélangeait
// les devises. Chaque commission est convertie depuis SA devise en XAF (devise du
// portefeuille AXSO), aux taux du jour.
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { versXAF, convertirMontant } from "./devise-convert";
import { tauxDuJour } from "./taux-change";

/** Commissions converties en XAF, par boutique (triées de la plus rentable à la moins rentable). */
export async function commissionsParBoutiqueXAF(where: Prisma.CommissionWhereInput) {
  const [groupes, taux] = await Promise.all([
    prisma.commission.groupBy({ by: ["tenantId", "devise"], _sum: { montantCommission: true, montantMarchand: true }, where }),
    tauxDuJour(),
  ]);
  // Chaque commission est convertie depuis SA devise ; montants affichés par boutique dans sa devise actuelle.
  const devises = new Map((await prisma.tenant.findMany({ where: { id: { in: groupes.map((g) => g.tenantId) } }, select: { id: true, devise: true } })).map((t) => [t.id, t.devise]));
  const parBoutique = new Map<string, { tenantId: string; devise: string; commission: number; marchand: number; commissionXAF: number }>();
  for (const g of groupes) {
    const devise = devises.get(g.tenantId) ?? g.devise;
    const b = parBoutique.get(g.tenantId) ?? { tenantId: g.tenantId, devise, commission: 0, marchand: 0, commissionXAF: 0 };
    const vers = (m: number) => (g.devise === devise ? m : convertirMontant(m, g.devise, devise, taux));
    b.commission += vers(g._sum.montantCommission ?? 0);
    b.marchand += vers(g._sum.montantMarchand ?? 0);
    b.commissionXAF += versXAF(g._sum.montantCommission ?? 0, g.devise, taux);
    parBoutique.set(g.tenantId, b);
  }
  return [...parBoutique.values()].sort((a, b) => b.commissionXAF - a.commissionXAF);
}

export async function totalCommissionsXAF(where: Prisma.CommissionWhereInput): Promise<number> {
  return Math.round((await commissionsParBoutiqueXAF(where)).reduce((s, g) => s + g.commissionXAF, 0));
}
