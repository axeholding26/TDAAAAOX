// Un inventaire.
// GET   /api/pos/inventaire/[id]?q=&filtre=&curseur=&limite= — filtre : tous | comptes | non_comptes | ecarts.
//   Réponse : { inventaire, resume: { lignes, comptees, nonComptees, enEcart, ecartPlus, ecartMoins, valeurEcart, plafondEcarts },
//   lignes: [{ …, quantiteTheorique, quantiteComptee, ecart, mouvementsDepuis }], curseurSuivant, droits }.
//   valeurEcart est null sans le droit voir_couts. Droit : voir_stock ou inventaire_compter.
// PATCH /api/pos/inventaire/[id] — { cle, action: cloturer | rouvrir | zero_non_comptes | valider | annuler, motif? }.
//   valider applique les écarts au stock (mouvements « inventaire »), une seule fois.
//   Réponse : { ok, comptageId, statut, appliquees, plafonnees, ignorees, misesAZero, rejoue }.
//   Droits : inventaire_valider pour valider et zero_non_comptes ; inventaire_compter sinon. Audité.
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { actionInventaire, lireInventaire, schemaActionInventaire } from "@/lib/pos/operations/inventaire";

export const GET = routePos<{ id: string }>(async (ctx, req, { id }) => {
  exigerUnDroit(ctx, "voir_stock", "inventaire_compter", "inventaire_valider");
  const p = new URL(req.url).searchParams;
  const r = await lireInventaire(ctx, id, { q: p.get("q"), filtre: p.get("filtre"), curseur: p.get("curseur"), limite: Number(p.get("limite")) || undefined });
  return { ...r, droits: { compter: aDroit(ctx, "inventaire_compter"), valider: aDroit(ctx, "inventaire_valider") } };
});

export const PATCH = routePos<{ id: string }>(async (ctx, req, { id }) => {
  const corps = await req.json();
  const r = await actionInventaire(ctx, id, schemaActionInventaire.parse({ ...corps, cle: cleIdempotence(req, corps) }));
  return { ok: true, ...r, ...(r.rejoue && r.statut === "valide" ? { message: "Cet inventaire a déjà été validé. Les écarts n'ont pas été appliqués une seconde fois." } : {}) };
});
