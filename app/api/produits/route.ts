// API Route — Gestion des produits
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { schemaProduit } from "@/lib/validations";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const actif = searchParams.get("actif");

    const where: any = { tenantId };
    if (search) where.nom = { contains: search, mode: "insensitive" };
    if (actif !== null) where.actif = actif === "true";

    const [produits, total] = await Promise.all([
      prisma.produit.findMany({
        where,
        include: { variantes: true, _count: { select: { avis: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.produit.count({ where }),
    ]);

    return NextResponse.json({ produits, total, page, limit });
  } catch (err) {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    const body = await request.json();
    const data = schemaProduit.parse(body);

    // Vérifier si le slug existe déjà pour ce tenant
    const slugExiste = await prisma.produit.findUnique({
      where: { tenantId_slug: { tenantId, slug: data.slug } },
    });

    if (slugExiste) {
      return NextResponse.json(
        { message: "Un produit avec ce slug existe déjà" },
        { status: 400 }
      );
    }

    const { variantes: variantesInput, ...produitData } = data as any;

    const produit = await prisma.produit.create({
      data: { ...produitData, tenantId },
    });

    // Create variants if provided
    if (variantesInput?.length) {
      await prisma.variante.createMany({
        data: variantesInput.map((v: any) => ({
          produitId: produit.id,
          nom: v.nom,
          valeur: v.valeur,
          sku: v.sku || null,
          prix: v.prix || null,
          stock: v.stock ?? 0,
          image: v.image || null,
        })),
      });
    }

    return NextResponse.json({ produit }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: "Données invalides", erreurs: err.issues }, { status: 400 });
    }
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
