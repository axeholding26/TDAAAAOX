// Recherche d'un article par code lu (scanner, caméra, clavier).
// GET /api/pos/scan?code=  — droit : scanner ou vendre.
// Reconnaît, dans l'ordre : code-barres de variante, de produit, SKU, numéro de
// série, étiquette de balance (lib/pos/catalogue.ts → resoudreCode).
//
// Réponse : `{ produit, article, varianteId }`. `produit` garde la forme
// qu'attendent l'ancienne caisse (POSPanel) et BarcodeScanner ; `article` est
// l'article complet de la caisse 2.0 ; `varianteId` est renseigné quand le code
// lu est celui d'une variante précise.
import { NextResponse } from "next/server";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { resoudreCode } from "@/lib/pos/catalogue";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "scanner", "vendre");
  const code = new URL(req.url).searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ error: "Aucun code n'a été lu. Scannez de nouveau.", code: "invalide" }, { status: 400 });

  const article = await resoudreCode(ctx.tenantId, code, { magasinId: ctx.magasinId });
  if (!article) return NextResponse.json({ error: "Produit introuvable pour ce code", code: "inconnu" }, { status: 404 });
  if (!aDroit(ctx, "voir_couts")) {
    article.cout = null;
    article.variantes = article.variantes.map((v) => ({ ...v, cout: null }));
  }
  return {
    produit: {
      id: article.produitId, nom: article.nom, prix: article.prix, stock: article.stock, sku: article.sku,
      images: article.image ? [article.image] : [], categorie: article.categorie,
      variantes: article.variantes.map((v) => ({ id: v.id, nom: v.nom, valeur: v.valeur, prix: v.prix, stock: v.stock })),
    },
    article,
    varianteId: article.varianteId,
  };
});
