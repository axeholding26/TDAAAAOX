import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";

const PLANS_VALIDES = ["palier0", "palier1", "palier2"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — action réservée au super-admin" }, { status: 403 });

  const { id } = await params;
  const { plan, jours } = await req.json();

  if (!PLANS_VALIDES.includes(plan)) {
    return NextResponse.json({ error: `Plan invalide. Valeurs acceptées : ${PLANS_VALIDES.join(", ")}` }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { statut: true } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  if (tenant.statut === "systeme") return NextResponse.json({ error: "Boutique système, non modifiable" }, { status: 400 });

  const planExpiresAt = plan === "palier0" ? null : new Date(Date.now() + (Number(jours) || 30) * 24 * 3600 * 1000);

  await prisma.tenant.update({ where: { id }, data: { planType: plan, planExpiresAt, planPendingRef: null } });

  return NextResponse.json({ success: true, plan, planExpiresAt });
}
