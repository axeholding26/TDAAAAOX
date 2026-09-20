// API Route — Dropshipping : Produits importés
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── GET — liste des produits dropshipping ──────────────────────────────────
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const fournisseur = searchParams.get("fournisseur") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: any = { tenantId, type: "dropshipping" };
    if (search) where.nom = { contains: search, mode: "insensitive" };
    if (fournisseur) where.nomFournisseur = { contains: fournisseur, mode: "insensitive" };

    const [produits, total] = await Promise.all([
      prisma.produit.findMany({
        where,
        select: {
          id: true,
          nom: true,
          slug: true,
          prix: true,
          prixFournisseur: true,
          images: true,
          categorie: true,
          urlFournisseur: true,
          nomFournisseur: true,
          ventes: true,
          stock: true,
          actif: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.produit.count({ where }),
    ]);

    return NextResponse.json({ produits, total, page, limit });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST — importer un nouveau produit dropshipping ───────────────────────
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const body = await request.json();

    const {
      nom, description, prix, prixFournisseur, categorie, tags,
      images, urlFournisseur, nomFournisseur, stock,
    } = body;

    if (!nom || !prix) {
      return NextResponse.json({ message: "Nom et prix requis" }, { status: 400 });
    }

    // Détection de doublons : même URL fournisseur
    if (urlFournisseur) {
      const doublon = await prisma.produit.findFirst({
        where: { tenantId, urlFournisseur, type: "dropshipping" },
        select: { id: true, nom: true },
      });
      if (doublon) {
        return NextResponse.json(
          { message: "Ce produit a déjà été importé", doublon },
          { status: 409 }
        );
      }
    }

    // Génération d'un slug unique
    const baseSlug = nom
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const produit = await prisma.produit.create({
      data: {
        tenantId,
        nom,
        slug,
        description: description || null,
        prix: parseFloat(prix),
        prixFournisseur: prixFournisseur ? parseFloat(prixFournisseur) : null,
        categorie: categorie || null,
        tags: tags || [],
        images: images || [],
        videos: [],
        urlFournisseur: urlFournisseur || null,
        nomFournisseur: nomFournisseur || null,
        type: "dropshipping",
        stock: stock ?? 9999,
        actif: true,
      },
    });

    return NextResponse.json({ produit }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ── PATCH — modifier prix / marge d'un produit (ou plusieurs) ────────────
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const body = await request.json();

    // Mise à jour en masse si "bulk: true" + "margePercent"
    if (body.bulk && typeof body.margePercent === "number") {
      const produits = await prisma.produit.findMany({
        where: { tenantId, type: "dropshipping", prixFournisseur: { not: null } },
        select: { id: true, prixFournisseur: true },
      });

      await Promise.all(
        produits.map((p) => {
          const nouvPrix = p.prixFournisseur! / (1 - body.margePercent / 100);
          return prisma.produit.update({
            where: { id: p.id },
            data: { prix: Math.round(nouvPrix) },
          });
        })
      );

      return NextResponse.json({ updated: produits.length });
    }

    // Mise à jour unitaire
    const { id, prix, prixFournisseur, actif } = body;
    if (!id) return NextResponse.json({ message: "ID requis" }, { status: 400 });

    const produit = await prisma.produit.findFirst({
      where: { id, tenantId, type: "dropshipping" },
    });
    if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

    const updated = await prisma.produit.update({
      where: { id },
      data: {
        ...(prix !== undefined && { prix: parseFloat(prix) }),
        ...(prixFournisseur !== undefined && { prixFournisseur: parseFloat(prixFournisseur) }),
        ...(actif !== undefined && { actif }),
      },
    });

    return NextResponse.json({ produit: updated });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ── DELETE — supprimer un produit dropshipping ────────────────────────────
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ message: "ID requis" }, { status: 400 });

    const produit = await prisma.produit.findFirst({
      where: { id, tenantId, type: "dropshipping" },
    });
    if (!produit) return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

    await prisma.produit.update({
      where: { id },
      data: { actif: false },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
