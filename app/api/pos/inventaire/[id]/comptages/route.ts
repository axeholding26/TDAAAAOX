// Comptage d'un article dans un inventaire en cours (scan → comptage → suivant).
// POST /api/pos/inventaire/[id]/comptages
//   Corps : schemaComptage { cle, code? | produitId?, varianteId?, quantite?, mode?: "ajouter" | "fixer" }.
//   « ajouter » (défaut, quantité 1 ou le poids de l'étiquette) : s'ajoute au compté. « fixer » : quantité exacte.
//   `cle` = identifiant du scan : un scan renvoyé ne compte pas deux fois.
//   Réponse : { ok, ligne: { ligneId, nom, variante, quantiteTheorique, quantiteComptee, ecart, ajoute }, rejoue }.
//   404 « inconnu » (code sans article), 422 « variante_requise » (details.variantes), 409 si l'inventaire n'est plus en cours.
//   Droit : inventaire_compter. Accepte un téléphone appairé.
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { compterArticle, schemaComptage } from "@/lib/pos/operations/inventaire";

export const POST = routePos<{ id: string }>(async (ctx, req, { id }) => {
  const corps = await req.json();
  const { rejoue, ...ligne } = await compterArticle(ctx, id, schemaComptage.parse({ ...corps, cle: cleIdempotence(req, corps) }));
  return { ok: true, ligne, rejoue };
});
