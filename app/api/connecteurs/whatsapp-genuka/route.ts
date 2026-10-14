import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { lireConnexion, enregistrerConnexion } from "@/lib/connect";
import { quotaCommandesAtteint } from "@/lib/abonnement";

// GET — lire la config WhatsApp via Genuka du tenant
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Aucune boutique" }, { status: 400 });

  const config = await lireConnexion(tenantId, "whatsapp_genuka");

  // Jamais les secrets eux-mêmes : seulement s'ils sont renseignés.
  const cfg = (config?.config ?? {}) as any;
  return NextResponse.json({ config: config ? { statut: config.statut, updatedAt: config.updatedAt, config: { proxyToken: !!cfg.proxyToken, webhookSecret: !!cfg.webhookSecret } } : null });
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
  if (!tenantId) return NextResponse.json({ error: "Aucune boutique" }, { status: 400 });

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour connecter WhatsApp.", code: "quota_atteint" }, { status: 403 });
  }

  const { proxyToken, webhookSecret } = await req.json().catch(() => ({}));
  if ((!proxyToken || typeof proxyToken !== "string") && (!webhookSecret || typeof webhookSecret !== "string")) {
    return NextResponse.json({ error: "Renseignez le proxy token et/ou le secret du webhook" }, { status: 400 });
  }

  const existant = await lireConnexion(tenantId, "whatsapp_genuka");
  const config = {
    ...(existant?.config as any),
    ...(proxyToken && typeof proxyToken === "string" ? { proxyToken } : {}),
    ...(webhookSecret && typeof webhookSecret === "string" ? { webhookSecret } : {}),
  };

  await enregistrerConnexion(tenantId, "whatsapp_genuka", { statut: "actif", config });

  return NextResponse.json({ success: true });
}

// DELETE — désactiver la connexion
export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Aucune boutique" }, { status: 400 });

  await prisma.connecteurConfig.updateMany({
    where: { tenantId, type: "whatsapp_genuka" },
    data: { statut: "inactif", config: {} },
  });

  return NextResponse.json({ success: true });
}
