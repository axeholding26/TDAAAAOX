// API Messages — inbox WhatsApp/Instagram DMs + réponse + templates
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET — lister messages reçus ───────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source"); // "whatsapp" | "instagram_dm" | null
  const nonLus = searchParams.get("nonLus") === "true";

  const messages = await prisma.messageRecu.findMany({
    where: {
      tenantId,
      ...(source && { source }),
      ...(nonLus && { lu: false }),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const [nbNonLus, nbTotal] = await Promise.all([
    prisma.messageRecu.count({ where: { tenantId, lu: false } }),
    prisma.messageRecu.count({ where: { tenantId } }),
  ]);

  return NextResponse.json({ messages, nbNonLus, nbTotal });
}

// ── PATCH — marquer comme lu / répondu ────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { id, lu, repondu } = await req.json();
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const msg = await prisma.messageRecu.findFirst({ where: { id, tenantId } });
  if (!msg) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const updated = await prisma.messageRecu.update({
    where: { id },
    data: {
      ...(lu !== undefined && { lu }),
      ...(repondu !== undefined && { repondu }),
    },
  });

  return NextResponse.json(updated);
}

// ── POST — répondre à un message (WhatsApp direct) ───────────────────────────
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { messageId, reponse, telephone } = await req.json();
  if (!reponse?.trim()) return NextResponse.json({ error: "Message vide" }, { status: 400 });

  // Envoyer via MCP WhatsApp
  const { executerOutilMcp } = await import("@/lib/mcp/executor");
  const dest = telephone ?? (await prisma.messageRecu.findFirst({ where: { id: messageId, tenantId }, select: { de: true } }))?.de;

  if (!dest) return NextResponse.json({ error: "Destinataire introuvable" }, { status: 400 });

  const result = await executerOutilMcp("whatsapp_envoyer_message", { telephone: dest, message: reponse }, tenantId);

  // Marquer comme répondu
  if (messageId) {
    await prisma.messageRecu.update({ where: { id: messageId }, data: { lu: true, repondu: true } }).catch(() => {});
  }

  return NextResponse.json({ succes: result.succes, resultat: result.resultat });
}

// ── DELETE — supprimer un message ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.messageRecu.deleteMany({ where: { id, tenantId } });
  return NextResponse.json({ success: true });
}
