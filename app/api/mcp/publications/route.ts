// CRUD publications planifiées + liste des posts passés
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const creerSchema = z.object({
  plateforme: z.enum(["facebook", "instagram", "whatsapp", "tiktok", "twitter"]),
  contenu: z.string().min(1),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
  planifieLe: z.string(),
  noteInterne: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const statut = searchParams.get("statut") || undefined;
  const plateforme = searchParams.get("plateforme") || undefined;

  const posts = await prisma.postPlanifie.findMany({
    where: {
      tenantId,
      ...(statut && { statut }),
      ...(plateforme && { plateforme }),
    },
    orderBy: { planifieLe: "asc" },
    take: 50,
  });

  return NextResponse.json(posts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = creerSchema.parse(await req.json());

  const post = await prisma.postPlanifie.create({
    data: {
      tenantId,
      plateforme: body.plateforme,
      contenu: body.contenu,
      hashtags: body.hashtags,
      imageUrl: body.imageUrl,
      videoUrl: body.videoUrl,
      planifieLe: new Date(body.planifieLe),
      noteInterne: body.noteInterne,
      statut: "planifie",
    },
  });

  return NextResponse.json(post, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  await prisma.postPlanifie.updateMany({
    where: { id, tenantId },
    data: { statut: "annule" },
  });

  return NextResponse.json({ ok: true });
}
