// Fermeture de la session ouverte sur la caisse de travail.
// POST /api/pos/sessions/fermer — droit : fermer_caisse.
// Corps : { compte, justification?, detailComptage?, cle? }.
// Écart = compté − attendu ; s'il n'est pas nul, une justification est exigée
// (422 « justification_requise », l'écart est dans `details`) et la session reste ouverte.
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { schemaFermeture } from "@/lib/pos/schemas";
import { fermerSession } from "@/lib/pos/session-caisse";

export const POST = routePos(async (ctx, req) => {
  const corps = schemaFermeture.parse(await req.json());
  const session = await fermerSession(ctx, { compte: corps.compte, justification: corps.justification, detailComptage: corps.detailComptage, cle: cleIdempotence(req, corps) });
  return { ok: true, session, rejoue: session.rejoue };
});
