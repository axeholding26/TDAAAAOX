// NotchPay — achat/renouvellement d'un palier d'abonnement payant
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { initierPaiementNotchPay, hasNotchPay } from "@/lib/notchpay";

const PALIER_PRIX: Record<string, number> = { palier1: 6000, palier2: 20000 };

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Aucune boutique" }, { status: 400 });

  if (!hasNotchPay()) {
    return NextResponse.json({ error: "Paiement en ligne indisponible" }, { status: 503 });
  }

  const { plan } = await req.json();
  if (!plan || !PALIER_PRIX[plan]) {
    return NextResponse.json({ error: "Plan invalide" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nomBoutique: true, email: true, whatsapp: true, devise: true },
  });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  // Référence marchande (dispatch webhook par préfixe SUB-{tenantId}-{plan}-...).
  const merchantRef = `SUB-${tenantId}-${plan}-${Date.now()}`;
  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;

  try {
    const { transaction, authorizationUrl } = await initierPaiementNotchPay({
      amount: PALIER_PRIX[plan],
      currency: "XAF",
      email: tenant.email,
      name: tenant.nomBoutique,
      phone: tenant.whatsapp,
      description: `Abonnement Axso — ${plan}`,
      reference: merchantRef,
      callback: `${origin}/dashboard/abonnement?paiement=en_cours`,
    });

    await prisma.tenant.update({ where: { id: tenantId }, data: { planPendingRef: transaction?.reference ?? merchantRef } });

    return NextResponse.json({ authorizationUrl });
  } catch (err: any) {
    console.error("[abonnement/paiement]", err);
    return NextResponse.json({ error: err.message ?? "Erreur d'initialisation du paiement" }, { status: 500 });
  }
}
