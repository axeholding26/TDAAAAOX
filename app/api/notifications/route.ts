import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const livreur = await prisma.livreur.findUnique({ where: { userId } });
  if (!livreur) return NextResponse.json({ notifications: [] });

  const notifications = await prisma.notification.findMany({
    where: { livreurId: livreur.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const nonLues = notifications.filter((n) => !n.lu).length;
  return NextResponse.json({ notifications, nonLues });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const userId = (session.user as any)?.id;
  const livreur = await prisma.livreur.findUnique({ where: { userId } });
  if (!livreur) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Marquer toutes comme lues
  await prisma.notification.updateMany({
    where: { livreurId: livreur.id, lu: false },
    data: { lu: true },
  });

  return NextResponse.json({ success: true });
}
