import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET — cash COD collecté par un livreur, non encore remis au marchand.
// Accessible par le livreur lui-même (lecture seule — il ne peut pas se
// marquer remis, voir /api/commandes/remise-cod) ou par le marchand propriétaire.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as any)?.id;
  const tenantId = (session.user as any)?.tenantId;
  const role = (session.user as any)?.role;

  const livreur = await prisma.livreur.findUnique({ where: { id } });
  if (!livreur) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const estLeLivreur = livreur.userId === userId;
  const estLeMarchand = (role === "owner" || role === "editeur") && livreur.tenantId === tenantId;
  if (!estLeLivreur && !estLeMarchand) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const commandes = await prisma.commande.findMany({
    where: {
      livreurId: id,
      methodePaiement: { in: ["whatsapp_cod", "direct_cod"] },
      statut: "livree",
      codRemis: false,
    },
    select: {
      id: true, numero: true, clientNom: true, montantTotal: true, devise: true, updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const totalDu = commandes.reduce((s, c) => s + c.montantTotal, 0);

  return NextResponse.json({ commandes, totalDu, livreur: { id: livreur.id, nom: livreur.nom } });
}
