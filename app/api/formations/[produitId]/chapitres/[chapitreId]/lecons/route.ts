import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ produitId: string; chapitreId: string }> };

async function verifChapitre(produitId: string, chapitreId: string, tenantId: string) {
  return prisma.chapitre.findFirst({
    where: { id: chapitreId, formation: { produitId, produit: { tenantId } } },
    include: { _count: { select: { lecons: true } } },
  });
}

// POST — crée une leçon dans un chapitre
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { produitId, chapitreId } = await params;

    const chapitre = await verifChapitre(produitId, chapitreId, tenantId);
    if (!chapitre) return NextResponse.json({ error: "Chapitre introuvable" }, { status: 404 });

    const { titre, type = "texte", contenu, videoType, videoUrl, audioUrl, duree, gratuite } = await req.json();
    if (!titre?.trim()) return NextResponse.json({ error: "titre requis" }, { status: 400 });

    const lecon = await prisma.lecon.create({
      data: {
        chapitreId,
        titre:     titre.trim(),
        type:      type ?? "texte",
        contenu:   contenu ?? null,
        videoType: videoType ?? null,
        videoUrl:  videoUrl ?? null,
        audioUrl:  audioUrl ?? null,
        duree:     duree ? parseInt(duree) : null,
        gratuite:  gratuite ?? false,
        ordre:     chapitre._count.lecons,
      },
    });

    return NextResponse.json({ lecon }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH — réordonne les leçons dans un chapitre
// Body: { ordre: string[] }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { produitId, chapitreId } = await params;

    const chapitre = await verifChapitre(produitId, chapitreId, tenantId);
    if (!chapitre) return NextResponse.json({ error: "Chapitre introuvable" }, { status: 404 });

    const { ordre } = await req.json();
    if (!Array.isArray(ordre)) return NextResponse.json({ error: "ordre requis" }, { status: 400 });

    await Promise.all(
      ordre.map((id: string, i: number) =>
        prisma.lecon.update({ where: { id, chapitreId }, data: { ordre: i } })
      )
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
