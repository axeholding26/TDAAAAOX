// Un lot : blocage, déblocage, péremption, rappel.
// PATCH /api/pos/lots/[id]
//   Corps : { cle, action: bloquer | debloquer | perime | rappele | epuise | noter, motif?, notes? }.
//   Motif obligatoire pour bloquer, débloquer et rappeler. « perime » et « rappele » retirent le reste du lot du stock.
//   Réponse : { ok, lotId, statut, stockRetire, avertissement, rejoue }. Droit : ajuster_stock. Audité.
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { changerLot, schemaActionLot } from "@/lib/pos/operations/lots";

export const PATCH = routePos<{ id: string }>(async (ctx, req, { id }) => {
  const corps = await req.json();
  // Ancien écran : { statut: "perime" | "rappele" | "epuise" }.
  const action = corps.action ?? corps.statut;
  return { ok: true, ...(await changerLot(ctx, id, schemaActionLot.parse({ ...corps, action, cle: cleIdempotence(req, corps) ?? crypto.randomUUID() }))) };
});
