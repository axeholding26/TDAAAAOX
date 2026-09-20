import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prixClient } from "@/lib/pricing";

// GET /api/storefront/wishlist?slug=<tenant>&ids=<id1,id2,...> — public : résout les
// produits d'une wishlist (stockée côté client dans le navigateur) pour un tenant donné.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug") || "";
    const ids = (searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
    if (!slug || ids.length === 0) return NextResponse.json({ produits: [] });

    const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, commissionRate: true } });
    if (!tenant) return NextResponse.json({ produits: [] });

    const taux = tenant.commissionRate ?? 0.06;
    const produits = await prisma.produit.findMany({
      where: { tenantId: tenant.id, id: { in: ids }, actif: true },
      select: { id: true, nom: true, images: true, prix: true, prixCompare: true, stock: true, categorie: true, ventes: true },
    });

    const result = produits.map((p) => ({
      id: p.id,
      nom: p.nom,
      images: p.images,
      categorie: p.categorie,
      stock: p.stock,
      ventes: p.ventes,
      prixAffiche: prixClient(p.prix, taux),
      prixCompareAffiche: p.prixCompare ? prixClient(p.prixCompare, taux) : null,
    }));

    return NextResponse.json({ produits: result });
  } catch {
    return NextResponse.json({ produits: [] }, { status: 500 });
  }
}
