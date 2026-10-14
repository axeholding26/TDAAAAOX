// API Connecteurs — gestion des connexions aux services tiers
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lireConnexion, enregistrerConnexion, deconnecter, etatConnexions } from "@/lib/connect";

// ── GET — lister tous les connecteurs du tenant ───────────────────────────────
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Aucune boutique" }, { status: 400 });

  // Aucun secret, même masqué : seulement l'état des services reliés.
  return NextResponse.json({ connecteurs: await etatConnexions(tenantId) });
}

// ── POST — créer ou mettre à jour un connecteur ───────────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Aucune boutique" }, { status: 400 });

  const { type, accessToken, pageId, igUserId, config } = await req.json().catch(() => ({}));
  if (!type) return NextResponse.json({ error: "Type requis" }, { status: 400 });

  const connecteur = await enregistrerConnexion(tenantId, type, {
    statut: "actif",
    accessToken: accessToken || undefined,
    pageId: pageId || undefined,
    igUserId: igUserId || undefined,
    config: config || undefined,
  });

  return NextResponse.json({ succes: true, id: connecteur.id, statut: connecteur.statut });
}

// ── DELETE — déconnecter un service ──────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Aucune boutique" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (!type) return NextResponse.json({ error: "Type requis" }, { status: 400 });

  await deconnecter(tenantId, type);

  return NextResponse.json({ succes: true });
}

// ── PATCH — tester la connexion ───────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Aucune boutique" }, { status: 400 });

  const { type } = await req.json().catch(() => ({}));
  const config = await lireConnexion(tenantId, type);

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
