// API Connecteurs — gestion des connexions aux services tiers
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET — lister tous les connecteurs du tenant ───────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const configs = await prisma.connecteurConfig.findMany({ where: { tenantId } });

  // Masquer les tokens sensibles pour l'affichage
  const safe = configs.map(c => ({
    ...c,
    accessToken: c.accessToken ? "••••••••" + c.accessToken.slice(-4) : null,
    config: masquerSecrets(c.config as Record<string, any>),
  }));

  return NextResponse.json({ connecteurs: safe });
}

// ── POST — créer ou mettre à jour un connecteur ───────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { type, accessToken, pageId, igUserId, config } = await req.json();
  if (!type) return NextResponse.json({ error: "Type requis" }, { status: 400 });

  const connecteur = await prisma.connecteurConfig.upsert({
    where: { tenantId_type: { tenantId, type } },
    create: {
      tenantId, type, statut: "actif",
      ...(accessToken && { accessToken }),
      ...(pageId && { pageId }),
      ...(igUserId && { igUserId }),
      config: config ?? {},
    },
    update: {
      statut: "actif",
      ...(accessToken && { accessToken }),
      ...(pageId && { pageId }),
      ...(igUserId && { igUserId }),
      ...(config && { config }),
    },
  });

  return NextResponse.json({ succes: true, id: connecteur.id, statut: connecteur.statut });
}

// ── DELETE — déconnecter un service ──────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (!type) return NextResponse.json({ error: "Type requis" }, { status: 400 });

  await prisma.connecteurConfig.updateMany({
    where: { tenantId, type },
    data: { statut: "inactif", accessToken: null, pageId: null, igUserId: null, config: {} },
  });

  return NextResponse.json({ succes: true });
}

// ── PATCH — tester la connexion ───────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { type } = await req.json();
  const config = await prisma.connecteurConfig.findFirst({ where: { tenantId, type } });

  if (!config || config.statut !== "actif") {
    return NextResponse.json({ connecte: false, message: "Connecteur non configuré" });
  }

  // Test de connectivité simple
  try {
    if (type === "meta" || type === "whatsapp") {
      const r = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${config.accessToken}`);
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);
      return NextResponse.json({ connecte: true, message: `Connecté en tant que: ${data.name ?? data.id}` });
    }
    if (type === "higgsfield") {
      const cfg = config.config as any;
      if (!cfg.apiKey) throw new Error("Clé API manquante");
      return NextResponse.json({ connecte: true, message: "Clé API Higgsfield configurée" });
    }
    if (type === "gemini") {
      const cfg = config.config as any;
      if (!cfg.apiKey) throw new Error("Clé API manquante");
      return NextResponse.json({ connecte: true, message: "Clé API Gemini configurée" });
    }
    if (type === "whatsapp_genuka") {
      const cfg = config.config as any;
      if (!cfg.proxyToken) throw new Error("Proxy token manquant");
      return NextResponse.json({ connecte: true, message: "WhatsApp via Genuka configuré" });
    }
    return NextResponse.json({ connecte: true, message: "Connecteur actif" });
  } catch (err: any) {
    await prisma.connecteurConfig.updateMany({ where: { tenantId, type }, data: { statut: "erreur" } });
    return NextResponse.json({ connecte: false, message: err.message });
  }
}

function masquerSecrets(cfg: Record<string, any>): Record<string, any> {
  const secrets = ["apiKey", "secret", "password", "token", "webhook_secret"];
  return Object.fromEntries(
    Object.entries(cfg).map(([k, v]) =>
      secrets.some(s => k.toLowerCase().includes(s)) && typeof v === "string"
        ? [k, "••••" + v.slice(-4)]
        : [k, v]
    )
  );
}
