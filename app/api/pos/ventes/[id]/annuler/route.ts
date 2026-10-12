// Annulation d'une vente en caisse.
// POST /api/pos/ventes/:id/annuler — droit : annuler_vente. Corps : { motif }.
// Stock rendu, paiements contre-passés, crédit et points repris, audit.
import { routePos } from "@/lib/pos/acces";
import { schemaAnnulation } from "@/lib/pos/schemas";
import { annulerVente } from "@/lib/pos/vente";

export const POST = routePos<{ id: string }>(async (ctx, req, { id }) => {
  const { motif } = schemaAnnulation.parse(await req.json());
  return { ok: true, ...(await annulerVente(ctx, id, motif)) };
});
