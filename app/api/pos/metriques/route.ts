// Observabilité de la caisse (§66).
// GET /api/pos/metriques?heures=24 → { periodeHeures, calculeAt, metriques: Metrique[] }
// Une métrique sans source fiable a `valeur: null` et dit pourquoi dans `note`.
// Droit : voir_analytics.
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { metriquesPos } from "@/lib/pos/metriques";

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "voir_analytics");
  return metriquesPos(ctx.tenantId, Number(new URL(req.url).searchParams.get("heures")) || 24);
});
