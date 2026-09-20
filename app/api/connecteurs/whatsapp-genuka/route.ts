import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { quotaCommandesAtteint } from "@/lib/abonnement";

// GET — lire la config WhatsApp via Genuka du tenant
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const config = await prisma.connecteurConfig.findFirst({
    where: { tenantId, type: "whatsapp_genuka" },
    select: { statut: true, config: true, updatedAt: true },
  });

  return NextResponse.json({ config: config ?? null });
}

// POST — activer la connexion Genuka. Le proxy token (envoi) et le webhook
// secret (réception) sont chacun optionnels et indépendants : un commerçant
// peut activer seulement la réception (webhook) en attendant de retrouver son
// proxy token, l'envoi automatique se rabat alors sur le fallback existant
// (Meta direct puis lien wa.me) tant que le token n'est pas renseigné.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour connecter WhatsApp.", code: "quota_atteint" }, { status: 403 });
  }

  const { proxyToken, webhookSecret } = await req.json();
  if ((!proxyToken || typeof proxyToken !== "string") && (!webhookSecret || typeof webhookSecret !== "string")) {
    return NextResponse.json({ error: "Renseignez le proxy token et/ou le secret du webhook" }, { status: 400 });
  }

  const existant = await prisma.connecteurConfig.findFirst({
    where: { tenantId, type: "whatsapp_genuka" },
    select: { config: true },
  });
  const config = {
    ...(existant?.config as any),
    ...(proxyToken && typeof proxyToken === "string" ? { proxyToken } : {}),
    ...(webhookSecret && typeof webhookSecret === "string" ? { webhookSecret } : {}),
  };

  await prisma.connecteurConfig.upsert({
    where: { tenantId_type: { tenantId, type: "whatsapp_genuka" } },
    create: { tenantId, type: "whatsapp_genuka", statut: "actif", config },
    update: { statut: "actif", config },
  });

  return NextResponse.json({ success: true });
}

// DELETE — désactiver la connexion
export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  await prisma.connecteurConfig.updateMany({
    where: { tenantId, type: "whatsapp_genuka" },
    data: { statut: "inactif", config: {} },
  });

  return NextResponse.json({ success: true });
}
