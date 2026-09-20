// NotchPay — vérification de secours (fallback si le webhook n'est pas encore arrivé)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifierPaiementNotchPay, hasNotchPay } from "@/lib/notchpay";

export async function GET(req: NextRequest) {
  const commandeId = req.nextUrl.searchParams.get("commandeId");
  if (!commandeId) return NextResponse.json({ error: "commandeId manquant" }, { status: 400 });

  if (!hasNotchPay()) {
    return NextResponse.json({ error: "Paiement en ligne indisponible" }, { status: 503 });
  }

  const commande = await prisma.commande.findUnique({
    where: { id: commandeId },
    select: { paiementStatut: true, paiementReference: true },
  });
  if (!commande?.paiementReference) {
    return NextResponse.json({ statut: null, commandeStatut: commande?.paiementStatut ?? null });
  }

  try {
    // paiementReference = référence NotchPay ("trx.xxx") — GET /payments/{reference}
    // n'accepte que leur propre référence, pas la nôtre (merchant_reference).
    const { transaction } = await verifierPaiementNotchPay(commande.paiementReference);
    return NextResponse.json({ statut: transaction?.status, commandeStatut: commande.paiementStatut });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur de vérification" }, { status: 500 });
  }
}
