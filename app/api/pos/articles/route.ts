// Catalogue de la caisse : recherche côté serveur, paginée par curseur.
// GET /api/pos/articles?q=&categorie=&curseur=&limite=&categories=1
// Droit : vendre, scanner ou voir_stock. Les coûts ne sortent qu'avec « voir_couts ».
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { categoriesCatalogue, rechercherArticles } from "@/lib/pos/catalogue";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "vendre", "scanner", "voir_stock");
  const p = new URL(req.url).searchParams;
  const [resultat, categories] = await Promise.all([
    rechercherArticles(ctx.tenantId, p.get("q"), {
      magasinId: ctx.magasinId, categorie: p.get("categorie") || null, curseur: p.get("curseur") || null,
      limite: Number(p.get("limite")) || undefined,
    }),
    p.get("categories") === "1" ? categoriesCatalogue(ctx.tenantId) : undefined,
  ]);
  const voirCouts = aDroit(ctx, "voir_couts");
  return {
    articles: voirCouts ? resultat.articles : resultat.articles.map((a) => ({ ...a, cout: null, variantes: a.variantes.map((v) => ({ ...v, cout: null })) })),
    curseurSuivant: resultat.curseurSuivant,
    ...(categories ? { categories } : {}),
  };
});
