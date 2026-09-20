import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";

const STATUTS_VALIDES = ["active", "suspendu", "supprime"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — action réservée au super-admin" }, { status: 403 });

  const { id } = await params;
  const { statut } = await req.json();

  if (!STATUTS_VALIDES.includes(statut)) {
    return NextResponse.json({ error: `Statut invalide. Valeurs acceptées : ${STATUTS_VALIDES.join(", ")}` }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { statut: true, slug: true } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
  if (tenant.statut === "systeme") return NextResponse.json({ error: "Boutique système, non modifiable" }, { status: 400 });

  await prisma.tenant.update({ where: { id }, data: { statut } });

  return NextResponse.json({ success: true, statut });
}
