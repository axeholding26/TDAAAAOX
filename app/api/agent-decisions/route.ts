import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Historique des actions prises par les agents Axso (AXIA + agents
// spécialisés) — la donnée existait déjà (AgentDecision, écrite par chaque
// executeOutil au moment de l'action), mais aucune interface ne l'exposait
// au marchand jusqu'ici.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agent") || undefined;
  const cursor = searchParams.get("cursor") || undefined;
  const limit = 30;

  const decisions = await prisma.agentDecision.findMany({
    where: { tenantId, ...(agentId ? { agentId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = decisions.length > limit;
  const page = hasMore ? decisions.slice(0, limit) : decisions;

  const agentsDistincts = await prisma.agentDecision.findMany({
    where: { tenantId },
    distinct: ["agentId"],
    select: { agentId: true },
    orderBy: { agentId: "asc" },
  });

  return NextResponse.json({
    decisions: page,
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
    agents: agentsDistincts.map(a => a.agentId),
  });
}
