import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// POST — ajoute un ou plusieurs FichierNumerique à un ProduitFichier
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const produit = await prisma.produit.findFirst({ where: { id, tenantId, type: "fichier" } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const pf = await prisma.produitFichier.upsert({
      where:  { produitId: id },
      create: { produitId: id },
      update: {},
      select: { id: true, fichiers: { select: { ordre: true } } },
    });

    const { fichiers }: { fichiers: Array<{ nom: string; url: string; taille?: number; mimeType?: string }> } = await req.json();
    if (!Array.isArray(fichiers) || fichiers.length === 0) {
      return NextResponse.json({ error: "Au moins un fichier requis" }, { status: 400 });
    }

    const maxOrdre = pf.fichiers.reduce((m, f) => Math.max(m, f.ordre), -1);

    const crees = await prisma.$transaction(
      fichiers.map((f, i) =>
        prisma.fichierNumerique.create({
          data: {
            produitFichierId: pf.id,
            nom:      f.nom,
            url:      f.url,
            taille:   f.taille   || null,
            mimeType: f.mimeType || null,
            ordre:    maxOrdre + 1 + i,
          },
        })
      )
    );

    return NextResponse.json({ fichiers: crees }, { status: 201 });
  } catch (err) {
    console.error("[api/produits/digitaux/[id]/fichiers POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH — réordonne les fichiers
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const produit = await prisma.produit.findFirst({ where: { id, tenantId } });
    if (!produit) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

    const { ordre }: { ordre: { id: string; ordre: number }[] } = await req.json();
    await prisma.$transaction(
      ordre.map(({ id: fichierId, ordre: o }) =>
        prisma.fichierNumerique.updateMany({ where: { id: fichierId }, data: { ordre: o } })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
