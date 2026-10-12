// Un transfert de stock.
// GET   /api/pos/transferts/[id] — { transfert, lignes: [{ …, quantiteDemandee, quantiteExpediee, quantiteRecue, stockSource }], actions }.
//   `actions` : ce que la personne peut faire dans l'état courant. Droit : voir_stock ou l'un des droits de transfert.
// GET   /api/pos/transferts/[id]?code= — ligne du transfert désignée par un code lu : { ligneId, nom, variante, quantite }.
//   404 « inconnu » (aucun article) ou « hors_transfert » (article absent du transfert).
// PATCH /api/pos/transferts/[id] — { cle, action, lignes?: [{ ligneId, quantite }], tout?, sort?, motif? }.
//   demander (transfert_creer) · approuver (transfert_approuver) · preparer, preparation, expedier (transfert_creer ou
//   transfert_approuver) · recevoir (transfert_recevoir) · cloturer (transfert_approuver, motif + sort) · annuler.
//   expedier sort le stock de la source ; recevoir l'entre à destination (réception partielle possible).
//   Réponse : { ok, transfertId, numero, statut, ecarts, rejoue }. Audité.
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { resoudreCode } from "@/lib/pos/catalogue";
import { exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { actionTransfert, lireTransfert, schemaActionTransfert } from "@/lib/pos/operations/transferts";
import { cleArticle } from "@/lib/pos/types";

export const GET = routePos<{ id: string }>(async (ctx, req, { id }) => {
  exigerUnDroit(ctx, "voir_stock", "transfert_creer", "transfert_approuver", "transfert_recevoir");
  const detail = await lireTransfert(ctx, id);
  const code = new URL(req.url).searchParams.get("code")?.trim();
  if (!code) return detail;
  // Scan de préparation ou de réception : quelle ligne du transfert ce code désigne-t-il ?
  const article = await resoudreCode(ctx.tenantId, code);
  if (!article) throw new ErreurPos("inconnu", 404, `Aucun article ne porte le code ${code} dans cette boutique.`, { code });
  const duProduit = detail.lignes.filter((l) => l.produitId === article.produitId);
  // Code du produit (pas d'une variante) : accepté seulement si le transfert n'en contient qu'une ligne.
  const ligne = duProduit.find((l) => l.cleArticle === cleArticle(article.produitId, article.varianteId)) ?? (!article.varianteId && duProduit.length === 1 ? duProduit[0] : null);
  if (!ligne) throw new ErreurPos("hors_transfert", 404, duProduit.length ? `« ${article.nom} » : scannez le code de la variante transférée.` : `« ${article.nom} » ne fait pas partie de ce transfert.`, { code });
  return { ligneId: ligne.id, nom: ligne.nom, variante: ligne.variante, quantite: article.poidsGrammes ?? 1 };
});

export const PATCH = routePos<{ id: string }>(async (ctx, req, { id }) => {
  const corps = await req.json();
  const r = await actionTransfert(ctx, id, schemaActionTransfert.parse({ ...corps, cle: cleIdempotence(req, corps) }));
  return { ok: true, ...r, ...(r.rejoue ? { message: "Cette action a déjà été enregistrée. Rien n'a été appliqué une seconde fois." } : {}) };
});
