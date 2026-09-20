import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Pas de boutique" }, { status: 400 });

    const [
      totalAffilies,
      affiliesActifs,
      commissions,
      topAffilies,
      totalClics,
      totalConversions,
    ] = await Promise.all([
      prisma.affilie.count({ where: { tenantId } }),
      prisma.affilie.count({ where: { tenantId, statut: "actif" } }),
      prisma.commissionAffilie.findMany({
        where: { tenantId },
        select: { montantCommission: true, statut: true, valeurCommande: true },
      }),
      prisma.affilie.findMany({
        where: { tenantId },
        include: {
          commissions: {
            select: { montantCommission: true, statut: true, valeurCommande: true },
          },
        },
        orderBy: { commissionTotal: "desc" },
        take: 5,
      }),
      prisma.affilie.aggregate({ where: { tenantId }, _sum: { clics: true } }),
      prisma.affilie.aggregate({ where: { tenantId }, _sum: { conversions: true } }),
    ]);

    const commissionsPaid = commissions
      .filter((c) => c.statut === "payee")
      .reduce((sum, c) => sum + c.montantCommission, 0);

    const commissionsPending = commissions
      .filter((c) => c.statut === "pending" || c.statut === "approuvee")
      .reduce((sum, c) => sum + c.montantCommission, 0);

    const gmvAffilies = commissions.reduce((sum, c) => sum + c.valeurCommande, 0);
    const clics = totalClics._sum.clics ?? 0;
    const conversions = totalConversions._sum.conversions ?? 0;
    const tauxConversion = clics > 0 ? ((conversions / clics) * 100).toFixed(1) : "0";

    const topAffiliesFormatted = topAffilies.map((a) => ({
      id: a.id, nom: a.nom, email: a.email,
      codeParrainage: a.codeParrainage, statut: a.statut,
      clics: a.clics, conversions: a.conversions,
      commissionPending: a.commissionPending,
      commissionTotal: a.commissionTotal,
      ventes: a.commissions.length,
    }));

    return NextResponse.json({
      stats: {
        totalAffilies, affiliesActifs,
        commissionsPaid, commissionsPending, gmvAffilies,
        clics, conversions,
        tauxConversion: parseFloat(tauxConversion),
        funnel: {
          clics, conversions,
          paiements: commissions.filter((c) => c.statut === "payee").length,
        },
      },
      topAffilies: topAffiliesFormatted,
    });
  } catch (err) {
    console.error("[AFFILIATION/STATS]", err);
    return NextResponse.json({
      stats: {
        totalAffilies: 0, affiliesActifs: 0,
        commissionsPaid: 0, commissionsPending: 0, gmvAffilies: 0,
        clics: 0, conversions: 0, tauxConversion: 0,
        funnel: { clics: 0, conversions: 0, paiements: 0 },
      },
      topAffilies: [],
    });
  }
}
