import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Réservé au super-admin" }, { status: 403 });

  const { id } = await params;
  if (id === session.userId) return NextResponse.json({ error: "Impossible de te révoquer toi-même" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role !== "admin_lecteur") {
    return NextResponse.json({ error: "Seuls les comptes en lecture seule peuvent être révoqués ici" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
