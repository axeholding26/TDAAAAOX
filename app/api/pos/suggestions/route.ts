// Suggestions d'articles pour le panier en cours (« souvent achetés ensemble »).
// GET /api/pos/suggestions?produits=id1,id2&limite=4 — droit : vendre.
// Réponse : { suggestions: Suggestion[], estimation: true, methode }.
// Comptage sur l'historique réel des ventes de la boutique (lib/pos/suggestions.ts) ;
// liste vide tant que l'historique est insuffisant.
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { MIN_COMMANDES, MIN_OCCURRENCES, suggestionsCoAchat } from "@/lib/pos/suggestions";

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "vendre");
  const url = new URL(req.url);
  const produits = (url.searchParams.get("produits") ?? "").split(",").map((s) => s.trim()).filter((s) => s && s.length <= 64);
  const suggestions = await suggestionsCoAchat(ctx.tenantId, produits, { magasinId: ctx.magasinId, limite: Number(url.searchParams.get("limite")) || 4 });
  return {
    suggestions,
    estimation: true,
    methode: `Articles achetés avec ceux du panier dans au moins ${MIN_OCCURRENCES} ventes des 180 derniers jours (sur au moins ${MIN_COMMANDES} ventes).`,
  };
});
