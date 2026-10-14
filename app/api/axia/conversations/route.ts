import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { accesComplet } from "@/lib/permissions-server";

// Historique des discussions AXIA, façon ChatGPT — une conversation par fil,
// commutable, renommable, supprimable.
// Les conversations n'ont pas d'auteur (pas de colonne userId) : l'historique,
// qui contient chiffres et données clients, est réservé à l'accès complet. Un
// membre restreint discute sans historique (conversation éphémère, jamais lue
// ni écrite en base — les routes [id] lui répondent 404).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
  if (!(await accesComplet(session))) return NextResponse.json({ conversations: [] });

  const conversations = await prisma.axiaConversation.findMany({
    where: { tenantId },
    select: { id: true, titre: true, updatedAt: true, createdAt: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ conversations });
}

export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
  if (!(await accesComplet(session))) {
    const maintenant = new Date();
    return NextResponse.json({ conversation: { id: "ephemere", titre: "Nouvelle conversation", messages: [], createdAt: maintenant, updatedAt: maintenant } });
  }

  const conversation = await prisma.axiaConversation.create({
    data: { tenantId, titre: "Nouvelle conversation", messages: [] },
  });

  return NextResponse.json({ conversation });
}
