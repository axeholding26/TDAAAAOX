import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { planActif } from "@/lib/abonnement";
import { PAYS_DEVISES } from "@/lib/ai-agent";
import { NOMS_PALIERS } from "@/lib/plans";

// État du plan du tenant courant, pour l'overlay abonnement plein écran
// (déclenché depuis n'importe quel cadenas du dashboard côté client).
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { nomBoutique: true, pays: true, devise: true },
  });

  const { plan: planActuel } = await planActif(tenantId);
  const pays = tenant?.pays ?? "CM";
  const devise = tenant?.devise ?? PAYS_DEVISES[pays] ?? "XAF";

  return NextResponse.json({
    planActuel,
    nomPlan: NOMS_PALIERS[planActuel],
    nomBoutique: tenant?.nomBoutique ?? null,
    devise,
  });
}
