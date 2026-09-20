import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST public — marque une leçon comme complète pour un apprenant
// Body: { leconId, commandeId, clientEmail }
export async function POST(req: NextRequest) {
  try {
    const { leconId, commandeId, clientEmail } = await req.json();
    if (!leconId || !commandeId || !clientEmail) {
      return NextResponse.json({ error: "leconId, commandeId et clientEmail requis" }, { status: 400 });
    }

    // Vérifie que la commande donne accès à cette leçon
    const commande = await prisma.commande.findFirst({
      where: { id: commandeId, clientEmail },
    });
    if (!commande) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const lecon = await prisma.lecon.findUnique({ where: { id: leconId } });
    if (!lecon) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });

    const progression = await prisma.progressionLecon.upsert({
      where: { leconId_clientEmail: { leconId, clientEmail } },
      create: { leconId, commandeId, clientEmail, complete: true, completedAt: new Date() },
      update: { complete: true, completedAt: new Date() },
    });

    return NextResponse.json({ ok: true, progression });
  } catch (err) {
    console.error("[formations/progression POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET — récupère la progression d'un apprenant pour un produit
// ?produitId=&clientEmail=&commandeId=
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const produitId   = searchParams.get("produitId");
    const clientEmail = searchParams.get("clientEmail");
    const commandeId  = searchParams.get("commandeId");

    if (!produitId || !clientEmail) {
      return NextResponse.json({ error: "produitId et clientEmail requis" }, { status: 400 });
    }

    const formation = await prisma.formation.findFirst({
      where: { produitId },
      include: {
        chapitres: {
          include: { lecons: { select: { id: true } } },
          orderBy: { ordre: "asc" },
        },
      },
    });
    if (!formation) return NextResponse.json({ error: "Formation introuvable" }, { status: 404 });

    const leconIds = formation.chapitres.flatMap((c) => c.lecons.map((l) => l.id));
    const progressions = await prisma.progressionLecon.findMany({
      where: { leconId: { in: leconIds }, clientEmail },
    });

    const completedSet = new Set(progressions.filter((p) => p.complete).map((p) => p.leconId));
    const pct = leconIds.length > 0 ? Math.round((completedSet.size / leconIds.length) * 100) : 0;

    return NextResponse.json({
      total:     leconIds.length,
      completes: completedSet.size,
      pct,
      leconIds:  [...completedSet],
    });
  } catch (err) {
    console.error("[formations/progression GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
