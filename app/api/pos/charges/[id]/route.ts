import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// PATCH — met à jour une charge (typiquement : marquer payée)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const charge = await prisma.chargeExploitation.findFirst({ where: { id, tenantId } });
    if (!charge) return NextResponse.json({ error: "Charge introuvable" }, { status: 404 });

    const body = await req.json();
    const data: any = {};
    if (body.statut !== undefined) data.statut = body.statut;
    if (body.montant !== undefined) data.montant = Number(body.montant);
    if (body.description !== undefined) data.description = body.description;
    if (body.dateEcheance !== undefined) data.dateEcheance = body.dateEcheance ? new Date(body.dateEcheance) : null;
    if (body.notes !== undefined) data.notes = body.notes;

    const miseAJour = await prisma.chargeExploitation.update({ where: { id }, data });
    return NextResponse.json({ charge: miseAJour });
  } catch (err) {
    console.error("[pos/charges/[id] PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — supprime une charge (erreur de saisie)
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const charge = await prisma.chargeExploitation.findFirst({ where: { id, tenantId } });
    if (!charge) return NextResponse.json({ error: "Charge introuvable" }, { status: 404 });

    await prisma.chargeExploitation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[pos/charges/[id] DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
