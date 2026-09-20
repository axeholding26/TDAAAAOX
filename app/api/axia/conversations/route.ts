import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Historique des discussions AXIA, façon ChatGPT — une conversation par fil,
// commutable, renommable, supprimable.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

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

  const conversation = await prisma.axiaConversation.create({
    data: { tenantId, titre: "Nouvelle conversation", messages: [] },
  });

  return NextResponse.json({ conversation });
}
