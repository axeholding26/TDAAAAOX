import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

const TYPES_DIGITAUX = ["fichier", "formation", "licence", "bundle"] as const;

// GET — liste tous les produits digitaux (nouveau système) du tenant
export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const produits = await prisma.produit.findMany({
      where: { tenantId, type: { in: [...TYPES_DIGITAUX] } },
      include: {
        produitFichier: { include: { _count: { select: { fichiers: true } } } },
        licenceProduit: {
          include: {
            _count: { select: { cles: true } },
            cles: { where: { statut: "disponible" }, select: { id: true }, take: 1 },
          },
        },
        bundleProduit: { include: { _count: { select: { elements: true } } } },
        _count: { select: { lignesCommande: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ produits });
  } catch (err) {
    console.error("[api/produits/digitaux GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — crée un Produit (type=fichier/formation/licence/bundle) + son enregistrement de détail
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const { nom, description, prix, prixCompare, images, categorie, tags, type } = await req.json();

    if (!nom || !prix || !type) {
      return NextResponse.json({ error: "nom, prix et type sont requis" }, { status: 400 });
    }

    const TYPES_VALIDES = ["fichier", "formation", "licence", "bundle"];
    if (!TYPES_VALIDES.includes(type)) {
      return NextResponse.json({ error: `Type invalide. Valeurs: ${TYPES_VALIDES.join(", ")}` }, { status: 400 });
    }

    // Slug unique par tenant
    let slug = slugify(nom);
    const existant = await prisma.produit.findUnique({ where: { tenantId_slug: { tenantId, slug } } });
    if (existant) slug = `${slug}-${Date.now().toString(36)}`;

    const produit = await prisma.produit.create({
      data: {
        tenantId,
        nom,
        slug,
        description: description || null,
        prix,
        prixCompare: prixCompare || null,
        stock: 99999, // aucune contrainte d'inventaire physique — voir TYPES_DIGITAUX
        images: images || [],
        tags: tags || [],
        categorie: categorie || null,
        type,
        actif: false, // brouillon jusqu'à publication explicite
      },
    });

    // Créer l'enregistrement de détail selon le type
    if (type === "fichier") {
      await prisma.produitFichier.create({ data: { produitId: produit.id } });
    } else if (type === "formation") {
      await prisma.formation.create({ data: { produitId: produit.id } });
    } else if (type === "licence") {
      await prisma.licenceProduit.create({ data: { produitId: produit.id } });
    } else if (type === "bundle") {
      await prisma.bundleProduit.create({ data: { produitId: produit.id } });
    }

    return NextResponse.json({ produit }, { status: 201 });
  } catch (err) {
    console.error("[api/produits/digitaux POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
