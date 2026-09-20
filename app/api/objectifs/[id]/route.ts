import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const STATUTS_VALIDES = new Set(["actif", "pause", "atteint", "echoue"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  const { id } = await params;

  const objectif = await prisma.agentGoal.findFirst({ where: { id, tenantId } });
  if (!objectif) return NextResponse.json({ error: "Objectif introuvable" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body?.statut || !STATUTS_VALIDES.has(body.statut)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }

  const updated = await prisma.agentGoal.update({ where: { id }, data: { statut: body.statut } });
  return NextResponse.json({ objectif: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  const { id } = await params;

  const objectif = await prisma.agentGoal.findFirst({ where: { id, tenantId } });
  if (!objectif) return NextResponse.json({ error: "Objectif introuvable" }, { status: 404 });

  await prisma.agentGoal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
