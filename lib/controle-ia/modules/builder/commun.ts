// Aide commune aux outils du Builder MCP : appliquer des opérations au brouillon (une
// transaction), traduire les erreurs du moteur, fabriquer le lien d'aperçu, publier les
// événements. Les droits, l'accord et le journal sont appliqués avant (lib/controle-ia/serveur.ts).
import { origineAxso } from "@/lib/origine-site";
import { publier, type TypeEvenement } from "@/lib/controle-ia/evenements";
import { appliquerOperations, type Auteur } from "@/lib/builder/moteur";
import { jetonApercu } from "@/lib/builder/apercu";
import { resumer } from "@/lib/builder/diff";
import { ErreurBuilder, type EtapeOperation, type OperationBuilder } from "@/lib/builder/types";
import { OPERATIONS_PAR_NOM } from "@/lib/builder/operations";
import type { CtxOutil, OutilIA, ResultatIA } from "../../types";

export const auteurDe = (ctx: CtxOutil): Auteur => ({ userId: ctx.userId, connexionId: ctx.connexionId, client: ctx.client });

export const ok = (resultat: string, donnees?: Record<string, unknown>): ResultatIA => ({ succes: true, resultat, donnees });
export const ko = (code: NonNullable<ResultatIA["code"]>, resultat: string, donnees?: Record<string, unknown>): ResultatIA => ({ succes: false, code, resultat: `${code} : ${resultat}`, donnees });

/** Erreur du moteur → résultat pour le modèle ; toute autre erreur remonte (le serveur répond sans détail interne). */
export function traduire(err: unknown): ResultatIA {
  if (err instanceof ErreurBuilder) return ko(err.code, err.message);
  throw err;
}

/** Lien d'aperçu du brouillon (1 h) ; `page` : chemin dans la boutique (« produits », « p/ramadan »…). */
export async function lienApercu(tenantId: string, page = ""): Promise<string | null> {
  const j = jetonApercu(tenantId);
  return j ? `${await origineAxso()}/api/builder/apercu?j=${encodeURIComponent(j)}${page ? `&page=${encodeURIComponent(page)}` : ""}` : null;
}

export const evenement = (ctx: CtxOutil, type: TypeEvenement, donnees: Record<string, unknown> = {}) =>
  publier(ctx.tenantId, type, { ...donnees, client: ctx.client, connexion: ctx.connexionId });

/** Applique des opérations au brouillon en une transaction et rend le résumé des changements. */
export async function modifier(ctx: CtxOutil, etapes: EtapeOperation[], quoi = "Brouillon modifié"): Promise<ResultatIA> {
  try {
    const r = await appliquerOperations(ctx.tenantId, etapes, OPERATIONS_PAR_NOM, auteurDe(ctx));
    evenement(ctx, "store.updated", { operations: etapes.map((e) => e.op), changements: r.changements.length });
    const apercu = await lienApercu(ctx.tenantId);
    return ok(
      `${quoi} (brouillon, rien n'est encore en ligne).\n${resumer(r.changements)}\n\nDepuis la version en ligne : ${r.depuisEnLigne.length} changement(s). Aperçu : ${apercu ?? "indisponible"}. Publie avec axso_builder_publish quand c'est prêt.`,
      { changes: r.changements, changes_since_live: r.depuisEnLigne.length, preview_url: apercu, draft: true },
    );
  } catch (err) { return traduire(err); }
}

/** Un outil MCP avancé pour une opération pure : il l'applique seule, en transaction. */
export function outilDeOperation(op: OperationBuilder, capacite: string, risque: OutilIA["risque"] = "faible"): OutilIA {
  return { name: op.nom, description: op.description, parameters: op.parameters, module: "boutique", niveau: "ecriture", risque, capacite, cache: true, sortie: "le résumé des changements du brouillon et un lien d'aperçu." };
}
