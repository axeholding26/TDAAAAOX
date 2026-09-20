import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ produitId: string; chapitreId: string; leconId: string }> };

async function verifLecon(produitId: string, chapitreId: string, leconId: string, tenantId: string) {
  return prisma.lecon.findFirst({
    where: { id: leconId, chapitreId, chapitre: { formation: { produitId, produit: { tenantId } } } },
  });
}

// PATCH — modifie une leçon
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { produitId, chapitreId, leconId } = await params;

    const lecon = await verifLecon(produitId, chapitreId, leconId, tenantId);
    if (!lecon) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });

    const body = await req.json();
    const data: any = {};
    const fields = ["titre", "type", "contenu", "videoType", "videoUrl", "audioUrl", "duree", "gratuite", "actif"];
    for (const f of fields) {
      if (f in body) data[f] = f === "duree" && body[f] ? parseInt(body[f]) : body[f];
    }

    const updated = await prisma.lecon.update({ where: { id: leconId }, data });
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
    const { produitId, chapitreId, leconId } = await params;

    const lecon = await verifLecon(produitId, chapitreId, leconId, tenantId);
    if (!lecon) return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });

    await prisma.lecon.delete({ where: { id: leconId } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
