import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { CANAUX_RELANCE, TYPES_RELANCE } from "@/lib/relances";

// Seuls les types et canaux que le moteur sait envoyer (lib/relances.ts). Délai : jusqu'à 1 an (relance des inactifs).
const champs = z.object({
  nom: z.string().trim().min(1).max(120),
  type: z.enum(TYPES_RELANCE),
  canal: z.enum(CANAUX_RELANCE).default("email"),
  delaiHeures: z.number().int().min(0).max(24 * 365).default(1),
  sujet: z.string().max(200).nullish(),
  message: z.string().trim().min(1).max(2000),
  actif: z.boolean(),
});

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

  const lu = champs.omit({ actif: true }).safeParse(await req.json().catch(() => null));
  if (!lu.success) return NextResponse.json({ error: "Champs invalides : nom, type (bienvenue, après achat, panier abandonné, inactif), canal (email ou WhatsApp) et message sont requis." }, { status: 400 });

  const workflow = await prisma.automationWorkflow.create({ data: { tenantId, ...lu.data, sujet: lu.data.sujet ?? null } });
  return NextResponse.json({ workflow }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { id, ...corps } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
  // Jamais tenantId ni les compteurs : seulement ce que le marchand règle.
  const lu = champs.partial().safeParse(corps);
  if (!lu.success) return NextResponse.json({ error: "Champs invalides" }, { status: 400 });
  const data = lu.data;

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
