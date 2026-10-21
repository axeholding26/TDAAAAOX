import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { boutiquesDuCompte } from "@/lib/tenant";

// Cette route ne gère que le downgrade gratuit (aucun paiement requis).
// Les upgrades payants passent par /api/abonnement/paiement (NotchPay).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
  }

  // Rétrograder fait perdre les jours payés : décision du propriétaire seul.
  const { proprietaire } = await boutiquesDuCompte((session.user as any).id);
  if (!proprietaire.includes(tenantId)) return NextResponse.json({ error: "Seul le propriétaire peut changer d'abonnement" }, { status: 403 });

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
  }

  const plan = body.plan?.toLowerCase();
  if (plan !== "palier0") {
    return NextResponse.json(
      { error: "Les upgrades payants passent par le paiement NotchPay" },
      { status: 400 }
    );
  }

  // L'abonnement vaut pour le compte (lib/abonnement.ts::planActif) : revenir à Essentiel
  // s'applique à toutes les boutiques du propriétaire, sinon le palier d'une autre resterait actif.
  await prisma.tenant.updateMany({
    where: { id: { in: proprietaire } },
    data: { planType: "palier0", planExpiresAt: null, planPendingRef: null, planRappel: null },
  });

  return NextResponse.json({ succes: true, plan: "palier0" });
}
