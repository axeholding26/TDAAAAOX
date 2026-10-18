import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { appliquerPedagogie, chapitrePedagogie } from "@/lib/formation/editeur";

type Ctx = { params: Promise<{ produitId: string; chapitreId: string }> };

async function verifChapitre(produitId: string, chapitreId: string, tenantId: string) {
  return prisma.chapitre.findFirst({
    where: { id: chapitreId, formation: { produitId, produit: { tenantId } } },
  });
}

// PATCH — modifie un chapitre (titre, actif)
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

    const body = await req.json();
    const data: any = {};
    if ("titre" in body) data.titre = body.titre.trim();
    if ("actif"  in body) data.actif  = body.actif;
    const peda = chapitrePedagogie.safeParse(body);
    if (!peda.success) return NextResponse.json({ error: peda.error.issues[0]?.message ?? "Données invalides" }, { status: 400 });

    await prisma.chapitre.update({ where: { id: chapitreId }, data });
    await appliquerPedagogie({ type: "chapitre", id: chapitreId, formationId: chapitre.formationId }, peda.data);
    const updated = await prisma.chapitre.findUnique({ where: { id: chapitreId } });
    return NextResponse.json({ chapitre: updated });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — supprime un chapitre et ses leçons (cascade)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    // Sans boutique (admin, livreur) : un filtre tenantId vide ouvrirait toutes les boutiques.
    if (!tenantId) return NextResponse.json({ error: "Non autorisé", message: "Non autorisé" }, { status: 401 });
    const { produitId, chapitreId } = await params;

    const chapitre = await verifChapitre(produitId, chapitreId, tenantId);
    if (!chapitre) return NextResponse.json({ error: "Chapitre introuvable" }, { status: 404 });

    await prisma.chapitre.delete({ where: { id: chapitreId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
