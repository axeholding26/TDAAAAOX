// Analyse d'un article au scan (§44).
// GET /api/pos/analytics/article?produitId=&varianteId=
// Réponse : AnalyseArticle (lib/pos/analytics/article.ts) — des estimations
// calculées par le code, jamais par le modèle de langage.
// Droit : voir_stock ou voir_analytics (aucun prix d'achat n'est rendu).
import { routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { erreurs } from "@/lib/pos/erreurs";
import { analyseArticle } from "@/lib/pos/analytics/article";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "voir_stock", "voir_analytics");
  const p = new URL(req.url).searchParams;
  const produitId = p.get("produitId")?.trim();
  if (!produitId || produitId.length > 64) throw erreurs.invalide("Indiquez l'article à analyser.");
  return analyseArticle(ctx.tenantId, produitId, p.get("varianteId")?.trim() || null);
});
