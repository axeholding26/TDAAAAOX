import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  const { id } = await params;

  const conversation = await prisma.axiaConversation.findFirst({ where: { id, tenantId } });
  if (!conversation) return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });

  return NextResponse.json({ conversation });
}

// Titre déduit automatiquement du premier message utilisateur, tant que le
// marchand n'a pas renommé explicitement la conversation.
function titreAutomatique(messages: any[]): string | null {
  const premier = messages.find((m) => m?.role === "user" && typeof m.content === "string" && m.content.trim());
  if (!premier) return null;
  const texte = premier.content.trim();
  return texte.length > 48 ? `${texte.slice(0, 48)}…` : texte;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  const { id } = await params;

  const existing = await prisma.axiaConversation.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { titre?: string; messages?: any } = {};

  if (typeof body.titre === "string" && body.titre.trim()) {
    data.titre = body.titre.trim().slice(0, 80);
  }
  if (Array.isArray(body.messages)) {
    data.messages = body.messages;
    // Auto-titre uniquement si jamais renommé manuellement (encore la valeur par défaut)
    // et qu'aucun titre explicite n'est fourni dans cette requête.
    if (!data.titre && existing.titre === "Nouvelle conversation") {
      const auto = titreAutomatique(body.messages);
      if (auto) data.titre = auto;
    }
  }

  const conversation = await prisma.axiaConversation.update({ where: { id }, data });
  return NextResponse.json({ conversation });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  const { id } = await params;

  const existing = await prisma.axiaConversation.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });

  await prisma.axiaConversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
