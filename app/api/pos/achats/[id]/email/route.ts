// POST /api/pos/achats/[id]/email — droit : achat_valider. Corps : { cle }.
// Envoie réellement le bon par e-mail au fournisseur (Resend). Refuse sans rien
// changer si le fournisseur n'a pas d'e-mail (422 email_absent), si le service
// n'est pas configuré (501 integration_en_attente) ou si l'envoi échoue (502).
// Un brouillon réellement parti passe à « envoyé ». Réponse : { ok, envoyeA, bon }.
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { envoyerBonParEmail } from "@/lib/pos/achats/bons";

export const POST = routePos<{ id: string }>(async (ctx, req, { id }) => {
  const corps = await req.json().catch(() => ({}));
  return { ok: true, ...(await envoyerBonParEmail(ctx, id, cleIdempotence(req, corps))) };
});
