import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payerCommissionsAffilie } from "@/lib/affiliation";
import { boutiquesDuCompte } from "@/lib/tenant";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  // Sans boutique, `where: { tenantId: undefined }` lirait les paiements de toutes les boutiques.
  if (!tenantId) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
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

// POST — demande le paiement des commissions approuvées d'un affilié : débit du wallet marchand,
// puis Axso fait le transfert et le clôture (voir lib/affiliation.ts).
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any).tenantId;
  if (!tenantId) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  // L'argent sort du wallet : propriétaire seul, comme les retraits (jamais un membre d'équipe).
  const { proprietaire } = await boutiquesDuCompte((session.user as any).id);
  if (!proprietaire.includes(tenantId)) return NextResponse.json({ error: "Seul le propriétaire de la boutique peut payer les commissions" }, { status: 403 });
  const body = await req.json().catch(() => ({}));

  if (!body.affilieId) return NextResponse.json({ error: "affilieId requis" }, { status: 400 });

  try {
    const { montant, paiementId } = await payerCommissionsAffilie({ tenantId, affilieId: body.affilieId });
    return NextResponse.json({ montant, paiementId }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Erreur lors du paiement" }, { status: 400 });
  }
}

// Plus de PATCH : depuis le 20/10/2026 c'est Axso qui fait le transfert et clôture le paiement
// (Admin › Affiliés). Le marchand qui le marquait payé ou échoué risquait un double versement.
