// Google Merchant Center Product Feed — Format RSS 2.0 / Google Shopping
// Soumets cette URL dans Google Merchant Center pour des listings GRATUITS
// URL : https://ta-boutique.axso.africa/api/feed/google?slug=ta-boutique

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const PAYS_LANGUES: Record<string, string> = {
  SN: "fr-SN", CI: "fr-CI", CM: "fr-CM", GH: "en-GH",
  NG: "en-NG", KE: "en-KE", MA: "fr-MA", TG: "fr-TG",
};

const PAYS_CIBLES: Record<string, string> = {
  SN: "SN", CI: "CI", CM: "CM", GH: "GH",
  NG: "NG", KE: "KE", MA: "MA", TG: "TG",
};

function escapeXml(str: string): string {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
          where: { actif: true, type: { in: ["physique", "dropshipping"] } },
          orderBy: { createdAt: "desc" },
          take: 500,
        },
      },
    });

    if (!tenant) {
      return new NextResponse("Boutique introuvable", { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://axso.africa";
    const boutiqueUrl = `${appUrl}/${slug}`;
    const langue = PAYS_LANGUES[tenant.pays] || "fr-FR";
    const pays = PAYS_CIBLES[tenant.pays] || tenant.pays;

    const items = tenant.produits.map((p) => {
      const imageUrl = p.images[0] || "";
      const prixFormate = p.prix.toFixed(2);
      const prixCompareFormate = p.prixCompare ? p.prixCompare.toFixed(2) : null;
      const productUrl = `${boutiqueUrl}/produits/${p.slug}`;

      return `
    <item>
      <g:id>${escapeXml(p.id)}</g:id>
      <g:title>${escapeXml(p.nom)}</g:title>
      <g:description>${escapeXml(p.description || p.nom)}</g:description>
      <g:link>${productUrl}</g:link>
      ${imageUrl ? `<g:image_link>${escapeXml(imageUrl)}</g:image_link>` : ""}
      <g:price>${prixFormate} ${tenant.devise}</g:price>
      ${prixCompareFormate ? `<g:sale_price>${prixFormate} ${tenant.devise}</g:sale_price>` : ""}
      ${prixCompareFormate ? `<g:sale_price_original>${prixCompareFormate} ${tenant.devise}</g:sale_price_original>` : ""}
      <g:availability>${p.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability>
      <g:condition>new</g:condition>
      ${p.categorie ? `<g:product_type>${escapeXml(p.categorie)}</g:product_type>` : ""}
      ${p.categorie ? `<g:google_product_category>${escapeXml(p.categorie)}</g:google_product_category>` : ""}
      ${p.sku ? `<g:mpn>${escapeXml(p.sku)}</g:mpn>` : ""}
      ${p.tags.length > 0 ? `<g:custom_label_0>${escapeXml(p.tags.slice(0, 3).join(", "))}</g:custom_label_0>` : ""}
      ${p.poids ? `<g:shipping_weight>${p.poids} kg</g:shipping_weight>` : ""}
      <g:identifier_exists>FALSE</g:identifier_exists>
      <g:target_country>${pays}</g:target_country>
      <g:content_language>${langue.split("-")[0]}</g:content_language>
      ${p.images.slice(1, 11).map((img, i) => `<g:additional_image_link>${escapeXml(img)}</g:additional_image_link>`).join("\n      ")}
    </item>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(tenant.nomBoutique)}</title>
    <link>${boutiqueUrl}</link>
    <description>${escapeXml(tenant.description || `Boutique ${tenant.nomBoutique} sur Axso`)}</description>
    <language>${langue}</language>
    ${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600", // Cache 1h
      },
    });
  } catch (err) {
    console.error("[FEED/GOOGLE]", err);
    return new NextResponse("Erreur serveur", { status: 500 });
  }
}
