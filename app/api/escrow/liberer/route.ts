import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { crediterWallet } from "@/lib/wallet";

// Libérer manuellement un escrow (owner si délai 48h dépassé)
// Crédite automatiquement le wallet du marchand.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  const role = (session.user as any)?.role;

  if (role !== "owner") {
    return NextResponse.json({ error: "Réservé au propriétaire" }, { status: 403 });
  }

  const { commandeId } = await req.json();

  const escrow = await prisma.escrow.findUnique({
    where: { commandeId },
    include: { commande: { include: { commission: true } } },
  });

  if (!escrow) return NextResponse.json({ error: "Escrow introuvable" }, { status: 404 });
  if (escrow.commande.tenantId !== tenantId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (escrow.statut === "released") {
    return NextResponse.json({ error: "Fonds déjà libérés" }, { status: 400 });
  }

  const now = new Date();
  if (now < escrow.releaseAt) {
    const diff = Math.ceil((escrow.releaseAt.getTime() - now.getTime()) / (1000 * 60 * 60));
    return NextResponse.json({
      error: `Libération possible dans ${diff}h (protection acheteur)`,
    }, { status: 400 });
  }

  const commande = escrow.commande;
  const tauxCommission = commande.montantTotal > 0
    ? (commande.commission?.montantCommission ?? commande.montantTotal * 0.03) / commande.montantTotal
    : 0;

  await prisma.$transaction(async (tx) => {
    // 1. Libérer l'escrow
    await tx.escrow.update({
      where: { commandeId },
      data: { statut: "released", releasedAt: now },
    });
  });

  // 2. Créditer le wallet marchand (calcule + capture la commission)
  const { montantNet } = await crediterWallet({
    tenantId,
    montantBrut: commande.montantTotal,
    tauxCommission,
    devise: commande.devise,
    description: `Fonds libérés #${commande.numero}`,
    commandeId,
    reference: commande.numero,
  });

  return NextResponse.json({
    success: true,
    montant: escrow.montant,
    montantNet,
    message: "Fonds libérés et crédités sur votre wallet Axso.",
  });
}
