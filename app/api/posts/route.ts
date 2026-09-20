// API CRUD Posts Planifiés — Social Media Scheduler
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schemaPost = z.object({
  plateforme: z.enum(["instagram", "facebook", "tiktok", "whatsapp", "twitter"]),
  contenu: z.string().min(1).max(2200),
  hashtags: z.array(z.string()).default([]),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  planifieLe: z.string().datetime(),
  noteInterne: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const { searchParams } = new URL(req.url);
    const debut = searchParams.get("debut");
    const fin = searchParams.get("fin");
    const plateforme = searchParams.get("plateforme");

    const where: any = { tenantId };
    if (debut && fin) where.planifieLe = { gte: new Date(debut), lte: new Date(fin) };
    if (plateforme) where.plateforme = plateforme;

    const posts = await prisma.postPlanifie.findMany({
      where,
      orderBy: { planifieLe: "asc" },
    });

    return NextResponse.json({ posts });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const body = await req.json();
    const data = schemaPost.parse(body);

    const post = await prisma.postPlanifie.create({
      data: { ...data, tenantId, planifieLe: new Date(data.planifieLe) },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Données invalides", erreurs: err.issues }, { status: 400 });
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const { id, statut } = await req.json();
    if (!id) return NextResponse.json({ message: "ID requis" }, { status: 400 });

    const post = await prisma.postPlanifie.findFirst({ where: { id, tenantId } });
    if (!post) return NextResponse.json({ message: "Post introuvable" }, { status: 404 });

    const updated = await prisma.postPlanifie.update({
      where: { id },
      data: { statut: statut || post.statut },
    });

    return NextResponse.json({ post: updated });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ message: "ID requis" }, { status: 400 });

    const post = await prisma.postPlanifie.findFirst({ where: { id, tenantId } });
    if (!post) return NextResponse.json({ message: "Post introuvable" }, { status: 404 });

    await prisma.postPlanifie.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
