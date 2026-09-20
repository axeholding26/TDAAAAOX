import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

// POST — ajoute un ou plusieurs produits à un bundle
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const bundle = await prisma.produit.findFirst({
      where: { id, tenantId, type: "bundle" },
      include: { bundleProduit: true },
    });
    if (!bundle?.bundleProduit) return NextResponse.json({ error: "Bundle introuvable" }, { status: 404 });

    const { produitIds }: { produitIds: string[] } = await req.json();
    if (!Array.isArray(produitIds) || produitIds.length === 0) {
      return NextResponse.json({ error: "produitIds requis" }, { status: 400 });
    }

    // Vérifier que les produits appartiennent au même tenant
    const produits = await prisma.produit.findMany({
      where: { id: { in: produitIds }, tenantId },
      select: { id: true },
    });
    const idsValides = new Set(produits.map((p) => p.id));

    // Récupérer l'ordre maximal existant
    const maxOrdre = await prisma.elementBundle.aggregate({
      where: { bundleId: bundle.bundleProduit.id },
      _max: { ordre: true },
    });
    const baseOrdre = (maxOrdre._max.ordre ?? -1) + 1;

    // Ignorer les doublons silencieusement
    const elements = await Promise.all(
      produitIds
        .filter((pid) => idsValides.has(pid))
        .map((pid, i) =>
          prisma.elementBundle.upsert({
            where: { bundleId_produitInclusId: { bundleId: bundle.bundleProduit!.id, produitInclusId: pid } },
            create: { bundleId: bundle.bundleProduit!.id, produitInclusId: pid, ordre: baseOrdre + i },
            update: {},
          })
        )
    );

    return NextResponse.json({ elements }, { status: 201 });
  } catch (err) {
    console.error("[bundle elements POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// GET — liste les éléments d'un bundle avec infos produit
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const bundle = await prisma.produit.findFirst({
      where: { id, tenantId },
      include: {
        bundleProduit: {
          include: {
            elements: {
              include: {
                produitInclus: { select: { id: true, nom: true, prix: true, images: true, type: true, actif: true } },
              },
              orderBy: { ordre: "asc" },
            },
          },
        },
      },
    });

    if (!bundle?.bundleProduit) return NextResponse.json({ error: "Bundle introuvable" }, { status: 404 });
    return NextResponse.json({ elements: bundle.bundleProduit.elements });
  } catch (err) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
