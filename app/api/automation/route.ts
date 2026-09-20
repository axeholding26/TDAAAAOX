import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const workflows = await prisma.automationWorkflow.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ workflows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const body = await req.json();
  const { nom, type, delaiHeures, canal, sujet, message } = body;
  if (!nom || !type || !message) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const workflow = await prisma.automationWorkflow.create({
    data: {
      tenantId, nom, type,
      delaiHeures: delaiHeures ?? 1,
      canal: canal ?? "email",
      sujet: sujet ?? null,
      message,
    },
  });
  return NextResponse.json({ workflow }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const body = await req.json();
  const { id, ...data } = body;
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.automationWorkflow.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Workflow introuvable" }, { status: 404 });

  const workflow = await prisma.automationWorkflow.update({ where: { id }, data });
  return NextResponse.json({ workflow });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  await prisma.automationWorkflow.deleteMany({ where: { id, tenantId } });
  return NextResponse.json({ ok: true });
}
