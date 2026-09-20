import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { crediterWallet } from "@/lib/wallet";

// Confirmation de réception par l'acheteur — libère l'escrow immédiatement
// et crédite le wallet du marchand.
export async function POST(req: NextRequest) {
  try {
    const { commandeId } = await req.json();
    if (!commandeId) return NextResponse.json({ error: "Commande manquante" }, { status: 400 });

    const escrow = await prisma.escrow.findUnique({
      where: { commandeId },
      include: { commande: { include: { commission: true } } },
    });

    if (!escrow) return NextResponse.json({ error: "Escrow introuvable" }, { status: 404 });
    if (escrow.statut === "released") {
      return NextResponse.json({ error: "Déjà confirmé" }, { status: 400 });
    }
    if (escrow.commande.statut !== "livree") {
      return NextResponse.json({ error: "La commande n'est pas encore marquée livrée" }, { status: 400 });
    }

    const now = new Date();
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

      // 2. Marquer la commande finalisée
      await tx.commande.update({
        where: { id: commandeId },
        data: { statut: "livree" },
      });
    });

    // 3. Créditer le wallet marchand (calcule + capture la commission)
    await crediterWallet({
      tenantId: commande.tenantId,
      montantBrut: commande.montantTotal,
      tauxCommission,
      devise: commande.devise,
      description: `Vente confirmée #${commande.numero}`,
      commandeId,
      reference: commande.numero,
    });

    return NextResponse.json({
      success: true,
      message: "Réception confirmée. Le paiement a été versé sur le wallet du vendeur.",
    });
  } catch (err) {
    console.error("[ESCROW/CONFIRMER]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
