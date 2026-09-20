import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schemaVeille = z.object({
  nomConcurrent: z.string().min(1),
  urlConcurrent: z.string().url().optional(),
  categorie: z.string().optional(),
  produitNom: z.string().optional(),
  prixDetecte: z.number().positive().optional(),
  descriptionNote: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const items = await prisma.veilleConcurrentielle.findMany({
      where: { tenantId },
      orderBy: { detectedAt: "desc" },
    });

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const data = schemaVeille.parse(await req.json());
    const item = await prisma.veilleConcurrentielle.create({ data: { ...data, tenantId } });
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Données invalides" }, { status: 400 });
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ message: "ID requis" }, { status: 400 });

    const item = await prisma.veilleConcurrentielle.findFirst({ where: { id, tenantId } });
    if (!item) return NextResponse.json({ message: "Introuvable" }, { status: 404 });

    await prisma.veilleConcurrentielle.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
