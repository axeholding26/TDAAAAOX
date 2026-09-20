import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string; elementId: string }> };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id, elementId } = await params;

    const element = await prisma.elementBundle.findFirst({
      where: { id: elementId, bundle: { produitId: id, produit: { tenantId } } },
    });
    if (!element) return NextResponse.json({ error: "Élément introuvable" }, { status: 404 });

    await prisma.elementBundle.delete({ where: { id: elementId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
