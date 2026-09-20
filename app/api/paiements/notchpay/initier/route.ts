// NotchPay — initialise le paiement d'une commande (page hébergée)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initierPaiementNotchPay, hasNotchPay } from "@/lib/notchpay";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    if (!hasNotchPay()) {
      return NextResponse.json({ error: "Paiement en ligne indisponible" }, { status: 503 });
    }

    const body = await req.json();
    const { commandeId, montant, devise, clientEmail, clientNom, clientTelephone, description } = body;

    if (!commandeId || !montant || !devise || !clientEmail) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const commande = await prisma.commande.findUnique({ where: { id: commandeId }, include: { tenant: { select: { slug: true } } } });
    if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

    // Référence marchande envoyée à NotchPay (dispatch webhook par préfixe ORD-).
    // NotchPay attribue sa PROPRE référence ("trx.xxx") en retour — c'est elle
    // qu'on doit stocker pour pouvoir interroger GET /payments/{reference} plus tard.
    const merchantRef = `ORD-${commandeId}`;
    const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

    const { transaction, authorizationUrl } = await initierPaiementNotchPay({
      amount: montant,
      currency: devise,
      email: clientEmail,
      name: clientNom ?? "Client",
      phone: clientTelephone,
      description: description ?? `Commande Axso #${commande.numero}`,
      reference: merchantRef,
      callback: `${origin}/${commande.tenant.slug}/confirmation/${commandeId}`,
    });

    await prisma.commande.update({
      where: { id: commandeId },
      data: { paiementProvider: "notchpay", paiementReference: transaction?.reference ?? merchantRef, methodePaiement: "notchpay" },
    }).catch(() => {});

    return NextResponse.json({ authorizationUrl, reference: merchantRef });
  } catch (err: any) {
    console.error("[notchpay/initier]", err);
    return NextResponse.json({ error: err.message ?? "Erreur d'initialisation du paiement" }, { status: 500 });
  }
}
