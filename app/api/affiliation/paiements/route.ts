import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payerCommissionsAffilie, rembourserPaiementCommissionEchoue } from "@/lib/affiliation";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const { searchParams } = new URL(req.url);
  const statut = searchParams.get("statut");

  const where: any = { tenantId };
  if (statut) where.statut = statut;

  const [paiementsRaw, commissionsDues] = await Promise.all([
    prisma.paiementCommission.findMany({ where, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.commissionAffilie.groupBy({
      by: ["affilieId"],
      where: { tenantId, statut: "approuvee" },
      _sum: { montantCommission: true },
      _count: true,
    }),
  ]);

  const affilieIds = [...new Set([...commissionsDues.map((g) => g.affilieId), ...paiementsRaw.map((p) => p.affilieurId)])];
  const affilies = affilieIds.length
    ? await prisma.affilie.findMany({ where: { id: { in: affilieIds } }, select: { id: true, nom: true, email: true, telephone: true } })
    : [];
  const affilieMap = new Map(affilies.map((a) => [a.id, a]));

  const paiements = paiementsRaw.map((p) => ({ ...p, affilie: affilieMap.get(p.affilieurId) ?? null }));

  const commissionsDuesDetail = commissionsDues.map((g) => ({
    affilieId: g.affilieId,
    affilie: affilieMap.get(g.affilieId) ?? null,
    montant: g._sum.montantCommission ?? 0,
    nombreCommissions: g._count,
  }));

  const totalPaye = paiements.filter((p) => p.statut === "traite").reduce((s, p) => s + p.montant, 0);
  const totalDu = commissionsDuesDetail.reduce((s, g) => s + g.montant, 0);

  return NextResponse.json({ paiements, commissionsDues: commissionsDuesDetail, stats: { totalPaye, totalDu, soldeRestant: totalDu } });
}

// POST — déclenche le paiement réel des commissions approuvées d'un affilié
// (débit wallet marchand + transfert NotchPay si configuré, voir lib/affiliation.ts)
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const role = (session.user as any)?.role;
  if (role !== "owner" && role !== "editeur") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const tenantId = (session.user as any).tenantId;
  const body = await req.json();

  if (!body.affilieId) return NextResponse.json({ error: "affilieId requis" }, { status: 400 });

  try {
    const { montant, paiementId } = await payerCommissionsAffilie({ tenantId, affilieId: body.affilieId });
    return NextResponse.json({ montant, paiementId }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erreur lors du paiement" }, { status: 400 });
  }
}

// PATCH — ajuste le statut d'un paiement déjà créé (confirmation manuelle
// d'un virement hors NotchPay, ou signalement d'échec avec remboursement
// automatique du wallet marchand)
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const existing = await prisma.paiementCommission.findFirst({ where: { id: body.id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });

  if (body.statut === "echec") {
    await rembourserPaiementCommissionEchoue(body.id);
    const paiement = await prisma.paiementCommission.findUnique({ where: { id: body.id } });
    return NextResponse.json({ paiement });
  }

  const paiement = await prisma.paiementCommission.update({
    where: { id: body.id },
    data: { statut: body.statut ?? undefined, reference: body.reference ?? undefined, notes: body.notes ?? undefined },
  });

  return NextResponse.json({ paiement });
}
