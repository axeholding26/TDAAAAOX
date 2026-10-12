// Instantané du catalogue pour la caisse hors ligne, paginé par curseur.
// GET /api/pos/sync/catalogue?curseur=&limite=
//   Réponse : { articles: ArticleResolu[], curseurSuivant, meta? } — `meta`
//   (version, genereAt, catégories, promotions en vigueur) sur la première page.
// Droit : vendre. Drapeau : offline_pos (403 fonction_desactivee sinon).
// Les coûts ne sortent qu'avec « voir_couts ».
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { flagActif } from "@/lib/pos/flags";
import { pageInstantane } from "@/lib/pos/hors-ligne/service";

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "vendre");
  if (!(await flagActif(ctx.tenantId, "offline_pos"))) {
    throw new ErreurPos("fonction_desactivee", 403, "Le mode hors ligne n'est pas activé pour cette boutique. Activez-le dans les réglages de la caisse.");
  }
  const p = new URL(req.url).searchParams;
  return pageInstantane(ctx, { curseur: p.get("curseur"), limite: Number(p.get("limite")) || undefined });
});
