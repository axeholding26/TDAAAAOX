// Un numéro de série.
// GET   /api/pos/series/[id] — { serie, historique: [{ date, libelle, detail, auteur }] }. Droit : voir_stock.
// PATCH /api/pos/series/[id] — { cle, action: bloquer | debloquer | defectueux | remettre_en_stock, motif }.
//   Un numéro vendu ne change d'état que par un retour ou l'annulation de la vente (409).
//   Réponse : { ok, id, numero, statut, rejoue }. Droit : ajuster_stock. Audité.
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { changerSerie, detailSerie, schemaActionSerie } from "@/lib/pos/operations/series";

export const GET = routePos<{ id: string }>(async (ctx, _req, { id }) => {
  exigerUnDroit(ctx, "voir_stock");
  return detailSerie(ctx, id);
});

export const PATCH = routePos<{ id: string }>(async (ctx, req, { id }) => {
  const corps = await req.json();
  return { ok: true, ...(await changerSerie(ctx, id, schemaActionSerie.parse({ ...corps, cle: cleIdempotence(req, corps) }))) };
});
