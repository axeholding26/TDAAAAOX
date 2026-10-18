import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appliquerPedagogie, leconPedagogie } from "@/lib/formation/editeur";

type Ctx = { params: Promise<{ produitId: string; chapitreId: string; leconId: string }> };

async function verifLecon(produitId: string, chapitreId: string, leconId: string, tenantId: string) {
  return prisma.lecon.findFirst({
    where: { id: leconId, chapitreId, chapitre: { formation: { produitId, produit: { tenantId } } } },
    include: { chapitre: { select: { formationId: true } } },
  });
}

// PATCH — modifie une leçon
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    // Sans boutique (admin, livreur) : un filtre tenantId vide ouvrirait toutes les boutiques.
    if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
    const { produitId, chapitreId, leconId } = await params;

    const lecon = await verifLecon(produitId, chapitreId, leconId, tenantId);
    if (!lecon) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });

    const body = await req.json();
    const data: any = {};
    const fields = ["titre", "type", "contenu", "videoType", "videoUrl", "audioUrl", "duree", "gratuite", "actif"];
    for (const f of fields) {
      if (f in body) data[f] = f === "duree" && body[f] ? parseInt(body[f]) : body[f];
    }
    if ("type" in data && !["texte", "video", "audio", "quiz", "devoir"].includes(data.type)) return NextResponse.json({ error: "type invalide" }, { status: 400 });
    const peda = leconPedagogie.safeParse(body);
    if (!peda.success) return NextResponse.json({ error: peda.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });

    await prisma.lecon.update({ where: { id: leconId }, data });
    await appliquerPedagogie({ type: "lecon", id: leconId, formationId: lecon.chapitre.formationId }, peda.data);
    const updated = await prisma.lecon.findUnique({ where: { id: leconId }, include: { quiz: true, ressources: { orderBy: { ordre: "asc" } } } });
    return NextResponse.json({ lecon: updated });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — supprime une leçon
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    // Sans boutique (admin, livreur) : un filtre tenantId vide ouvrirait toutes les boutiques.
    if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
    const { produitId, chapitreId, leconId } = await params;

    const lecon = await verifLecon(produitId, chapitreId, leconId, tenantId);
    if (!lecon) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });

    await prisma.lecon.delete({ where: { id: leconId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
