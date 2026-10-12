// Un bon de commande.
// GET   /api/pos/achats/[id] — droit : achat_creer, achat_valider ou reception.
//   Réponse : { bon, texte, emailPossible } ; `texte` = le bon prêt à copier ou à envoyer.
// PATCH /api/pos/achats/[id]
//   Corps { action: "envoyer" | "confirmer" | "solder" | "annuler", motif?, cle } — droit : achat_valider
//     (achat_creer suffit pour abandonner un brouillon). Transitions contrôlées, 409 sinon.
//   Corps schemaBon (sans `action`) — droit : achat_creer. Remplace le contenu d'un brouillon.
//   Réponse : { ok, bon, texte, rejoue? }.
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { hasResend, emailReel } from "@/lib/email";
import { changerStatutBon, lireBon, modifierBon, schemaActionBon, schemaBon, texteDuBon } from "@/lib/pos/achats/bons";

async function reponse(tenantId: string, id: string, plus: Record<string, unknown> = {}) {
  const bon = await lireBon(tenantId, id);
  const { texte } = await texteDuBon(tenantId, bon);
  // L'envoi par e-mail n'est proposé que s'il peut réellement partir.
  return { bon, texte, emailPossible: hasResend() && emailReel(bon.fournisseur.email), ...plus };
}

export const GET = routePos<{ id: string }>(async (ctx, _req, { id }) => {
  exigerUnDroit(ctx, "achat_creer", "achat_valider", "reception");
  return reponse(ctx.tenantId, id);
});

export const PATCH = routePos<{ id: string }>(async (ctx, req, { id }) => {
  const corps = await req.json();
  if (corps?.action) {
    const { action, motif } = schemaActionBon.parse(corps);
    const r = await changerStatutBon(ctx, id, action, motif, cleIdempotence(req, corps));
    return reponse(ctx.tenantId, id, { ok: true, rejoue: r.rejoue });
  }
  await modifierBon(ctx, id, schemaBon.parse(corps));
  return reponse(ctx.tenantId, id, { ok: true });
});
