// Un appareil enregistré. Droit : gerer_appareils.
// PATCH  /api/pos/scanner/appareils/:id — renommer. Corps : { nom }.
// DELETE /api/pos/scanner/appareils/:id — révoquer : refusé dès sa requête suivante.
import { routePos } from "@/lib/pos/acces";
import { renommerAppareil, revoquerAppareil, schemaRenommage } from "@/lib/pos/scanner/service";

export const PATCH = routePos<{ id: string }>(async (ctx, req, { id }) => {
  const d = schemaRenommage.parse(await req.json());
  return { ok: true, appareil: await renommerAppareil(ctx, id, d.nom) };
});

export const DELETE = routePos<{ id: string }>(async (ctx, _req, { id }) => ({ ok: true, ...(await revoquerAppareil(ctx, id)) }));
