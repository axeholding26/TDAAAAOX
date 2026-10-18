import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appliquerPedagogie, leconPedagogie } from "@/lib/formation/editeur";

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
    // Sans boutique (admin, livreur) : un filtre tenantId vide ouvrirait toutes les boutiques.
    if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
    const { produitId, chapitreId } = await params;

    const chapitre = await verifChapitre(produitId, chapitreId, tenantId);
    if (!chapitre) return NextResponse.json({ error: "Chapitre introuvable" }, { status: 404 });

    const body = await req.json();
    const { titre, type = "texte", contenu, videoType, videoUrl, audioUrl, duree, gratuite } = body;
    if (!titre?.trim()) return NextResponse.json({ error: "titre requis" }, { status: 400 });
    if (!["texte", "video", "audio", "quiz", "devoir"].includes(type)) return NextResponse.json({ error: "type invalide" }, { status: 400 });
    const peda = leconPedagogie.safeParse(body);
    if (!peda.success) return NextResponse.json({ error: peda.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });

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
    await appliquerPedagogie({ type: "lecon", id: lecon.id, formationId: chapitre.formationId }, peda.data);

    const complete = await prisma.lecon.findUnique({ where: { id: lecon.id }, include: { quiz: true, ressources: { orderBy: { ordre: "asc" } } } });
    return NextResponse.json({ lecon: complete }, { status: 201 });
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
    // Sans boutique (admin, livreur) : un filtre tenantId vide ouvrirait toutes les boutiques.
    if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
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
