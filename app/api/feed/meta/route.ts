// Meta Product Catalog Feed — Format CSV pour Facebook/Instagram Ads
// Soumets cette URL dans Meta Business → Commerce Manager → Catalogue
// URL : https://ta-boutique.axso.africa/api/feed/meta?slug=ta-boutique
// Format supporté : CSV (le plus simple pour Meta)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function csvEscape(val: string): string {
  const str = (val || "").replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (!slug) {
      return new NextResponse("?slug=votre-boutique requis", { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      include: {
        produits: {
          where: { actif: true },
          orderBy: { createdAt: "desc" },
          take: 500,
        },
      },
    });

    if (!tenant) return new NextResponse("Boutique introuvable", { status: 404 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://axso.africa";
    const boutiqueUrl = `${appUrl}/${slug}`;

    // En-tête CSV Meta Catalog
    const header = [
      "id", "title", "description", "availability", "condition",
      "price", "link", "image_link", "additional_image_link",
      "brand", "product_type", "google_product_category",
      "sale_price", "currency"
    ].join(",");

    const lignes = tenant.produits.map((p) => {
      const productUrl = `${boutiqueUrl}/produits/${p.slug}`;
      const prix = `${p.prix.toFixed(2)} ${tenant.devise}`;
      const prixSolde = p.prixCompare ? `${p.prix.toFixed(2)} ${tenant.devise}` : "";
      const imagesPrincipale = p.images[0] || "";
      const imagesSupp = p.images.slice(1, 4).join(",");

      return [
        csvEscape(p.id),
        csvEscape(p.nom),
        csvEscape((p.description || p.nom).slice(0, 5000)),
        csvEscape(p.stock > 0 ? "in stock" : "out of stock"),
        csvEscape("new"),
        csvEscape(prix),
        csvEscape(productUrl),
        csvEscape(imagesPrincipale),
        csvEscape(imagesSupp),
        csvEscape(tenant.nomBoutique),
        csvEscape(p.categorie || ""),
        csvEscape(p.categorie || ""),
        csvEscape(prixSolde),
        csvEscape(tenant.devise),
      ].join(",");
    });

    const csv = [header, ...lignes].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slug}-meta-catalog.csv"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[FEED/META]", err);
    return new NextResponse("Erreur serveur", { status: 500 });
  }
}
