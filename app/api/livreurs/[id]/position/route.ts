import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as any)?.id;
  const { latitude, longitude } = await req.json();

  const livreur = await prisma.livreur.findUnique({ where: { id } });
  if (!livreur || livreur.userId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const now = new Date();
  await prisma.livreur.update({
    where: { id },
    data: { latitude, longitude, positionAt: now },
  });

  // Recopie sur la commande en cours de livraison : c'est ce champ que lit le
  // traceur client (/[slug]/tracking/[token]), pas Livreur.latitude.
  if (latitude && longitude) {
    await prisma.commande.updateMany({
      where: { livreurId: id, statut: "expediee" },
      data: { livreurPosition: { lat: latitude, lng: longitude, updatedAt: now.toISOString() } },
    });
  }

  return NextResponse.json({ success: true });
}
