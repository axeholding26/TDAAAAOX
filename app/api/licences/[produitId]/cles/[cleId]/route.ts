import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ produitId: string; cleId: string }> };

// PATCH — modifier le statut d'une clé (revocation, etc.)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { produitId, cleId } = await params;

    const cle = await prisma.cleLicence.findFirst({
      where: { id: cleId, licenceProduit: { produitId, produit: { tenantId } } },
    });
    if (!cle) return NextResponse.json({ error: "Clé introuvable" }, { status: 404 });

    const { statut } = await req.json();
    if (!["disponible", "revoquee"].includes(statut)) {
      return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
    }

    await prisma.cleLicence.update({ where: { id: cleId }, data: { statut } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — supprime une clé non vendue
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { produitId, cleId } = await params;

    const cle = await prisma.cleLicence.findFirst({
      where: { id: cleId, statut: "disponible", licenceProduit: { produitId, produit: { tenantId } } },
    });
    if (!cle) return NextResponse.json({ error: "Clé introuvable ou déjà vendue" }, { status: 404 });

    await prisma.cleLicence.delete({ where: { id: cleId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
