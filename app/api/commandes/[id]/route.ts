import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as any)?.role;
  const tenantId = (session.user as any)?.tenantId;

  const commande = await prisma.commande.findUnique({
    where: { id },
    include: {
      lignes: true,
      client: true,
      livreur: true,
      commission: true,
      escrow: true,
    },
  });

  if (!commande) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Vérification accès : propriétaire tenant ou livreur assigné
  if (role === "livreur") {
    const livreur = await prisma.livreur.findFirst({
      where: { userId: (session.user as any)?.id },
    });
    if (!livreur || commande.livreurId !== livreur.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  } else {
    if (commande.tenantId !== tenantId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  return NextResponse.json({ commande });
}
