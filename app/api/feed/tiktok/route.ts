// TikTok Product Catalog Feed — Format CSV pour TikTok for Business
// Soumets cette URL dans TikTok for Business → Catalogue → Data Source
// URL : https://ta-boutique.axso.africa/api/feed/tiktok?slug=ta-boutique

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function csvEscape(val: string): string {
  return `"${(val || "").replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    if (!slug) return new NextResponse("?slug requis", { status: 400 });

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: { produits: { where: { actif: true }, take: 500 } },
    });
    if (!tenant) return new NextResponse("Boutique introuvable", { status: 404 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://axso.africa";

    // Format TikTok Catalog CSV
    const header = [
      "sku_id", "item_title", "description", "availability",
      "condition", "price", "link", "image_url",
      "brand", "category_1", "sale_price"
    ].join(",");

    const lignes = tenant.produits.map((p) => [
      csvEscape(p.id),
      csvEscape(p.nom.slice(0, 255)),
      csvEscape((p.description || p.nom).slice(0, 3000)),
      csvEscape(p.stock > 0 ? "in stock" : "out of stock"),
      csvEscape("new"),
      csvEscape(`${p.prix} ${tenant.devise}`),
      csvEscape(`${appUrl}/${slug}/produits/${p.slug}`),
      csvEscape(p.images[0] || ""),
      csvEscape(tenant.nomBoutique),
      csvEscape(p.categorie || ""),
      csvEscape(p.prixCompare ? `${p.prix} ${tenant.devise}` : ""),
    ].join(","));

    return new NextResponse([header, ...lignes].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[FEED/TIKTOK]", err);
    return new NextResponse("Erreur serveur", { status: 500 });
  }
}
