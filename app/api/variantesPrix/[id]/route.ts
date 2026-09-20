import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// PATCH — modifier une variante de prix
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const existant = await prisma.variantePrix.findFirst({ where: { id, tenantId } });
    if (!existant) return NextResponse.json({ error: "Variante introuvable" }, { status: 404 });

    const body = await req.json();
    const data: Record<string, any> = {};

    const CHAMPS = ["nom", "prix", "prixPromo", "periodeValidite", "renouvAuto", "autorisePromo", "actif"] as const;
    for (const c of CHAMPS) {
      if (c in body) data[c] = body[c];
    }
    if ("dateDebut" in body) data.dateDebut = body.dateDebut ? new Date(body.dateDebut) : null;
    if ("dateFin"   in body) data.dateFin   = body.dateFin   ? new Date(body.dateFin)   : null;

    const variante = await prisma.variantePrix.update({ where: { id }, data });
    return NextResponse.json({ variante });
  } catch (err) {
    console.error("[api/variantesPrix/[id] PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// DELETE — supprimer une variante de prix
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const existant = await prisma.variantePrix.findFirst({ where: { id, tenantId } });
    if (!existant) return NextResponse.json({ error: "Variante introuvable" }, { status: 404 });

    await prisma.variantePrix.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/variantesPrix/[id] DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
