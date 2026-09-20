import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — action réservée au super-admin" }, { status: 403 });

  const { id } = await params;
  const { certifie } = await req.json();

  const tenant = await prisma.tenant.update({ where: { id }, data: { certifie: !!certifie } }).catch(() => null);
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  return NextResponse.json({ success: true, certifie: tenant.certifie });
}
