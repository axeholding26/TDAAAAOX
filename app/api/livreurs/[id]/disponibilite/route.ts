import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as any)?.id;

  const livreur = await prisma.livreur.findUnique({ where: { id } });
  if (!livreur) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (livreur.userId !== userId) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const updated = await prisma.livreur.update({
    where: { id },
    data: { disponible: !livreur.disponible },
  });

  return NextResponse.json({ disponible: updated.disponible });
}
