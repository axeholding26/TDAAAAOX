import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ produitId: string }> };

// GET — liste tous les chapitres avec leurs leçons
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { produitId } = await params;

    const formation = await prisma.formation.findFirst({
      where: { produitId, produit: { tenantId } },
      include: {
        chapitres: {
          include: {
            lecons: { orderBy: { ordre: "asc" } },
            _count: { select: { lecons: true } },
          },
          orderBy: { ordre: "asc" },
        },
      },
    });

    if (!formation) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });
    return NextResponse.json({ formation, chapitres: formation.chapitres });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — crée un chapitre
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { produitId } = await params;

    const formation = await prisma.formation.findFirst({
      where: { produitId, produit: { tenantId } },
      include: { _count: { select: { chapitres: true } } },
    });
    if (!formation) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });

    const { titre } = await req.json();
    if (!titre?.trim()) return NextResponse.json({ error: "titre requis" }, { status: 400 });

    const chapitre = await prisma.chapitre.create({
      data: {
        formationId: formation.id,
        titre: titre.trim(),
        ordre: formation._count.chapitres,
      },
      include: { lecons: true, _count: { select: { lecons: true } } },
    });

    return NextResponse.json({ chapitre }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH — réordonne les chapitres
// Body: { ordre: string[] } — tableau d'IDs dans le nouvel ordre
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { produitId } = await params;

    const formation = await prisma.formation.findFirst({ where: { produitId, produit: { tenantId } } });
    if (!formation) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });

    const { ordre } = await req.json(); // string[]
    if (!Array.isArray(ordre)) return NextResponse.json({ error: "ordre requis" }, { status: 400 });

    await Promise.all(
      ordre.map((id: string, i: number) =>
        prisma.chapitre.update({ where: { id, formationId: formation.id }, data: { ordre: i } })
      )
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
