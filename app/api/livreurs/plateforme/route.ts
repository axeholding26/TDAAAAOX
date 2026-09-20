import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Tous les livreurs de la plateforme (pour les marchands)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const livreurs = await prisma.livreur.findMany({
    where: { actif: true },
    select: {
      id: true,
      nom: true,
      telephone: true,
      vehicule: true,
      zone: true,
      disponible: true,
      latitude: true,
      longitude: true,
      positionAt: true,
      tenantId: true,
      createdAt: true,
      _count: { select: { commandes: true } },
      tenant: { select: { nomBoutique: true, pays: true } },
    },
    orderBy: [{ disponible: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ livreurs });
}
