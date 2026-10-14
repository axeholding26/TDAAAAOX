// Module « commerce » d'AXSO CONTROL : ce qui manquait aux outils d'AXIA (lib/axia/tools.ts,
// lib/axia/pos-tools.ts) pour piloter catalogue, stock, commandes, clients, pages et analyses.
// Les outils déjà couverts en français (prix, statut et livraison des commandes, design,
// thème, pages À propos/Contact, publication…) ne sont pas refaits ici.
// Le détail est rangé par domaine dans ./commerce/.
import { ErreurPos } from "@/lib/pos/erreurs";
import type { CodeErreur, ModuleIA, ResultatIA } from "../types";
import { INCONNU } from "../types";
import { Refus, type Outil } from "./commerce/commun";
import { OUTILS_CATALOGUE } from "./commerce/catalogue";
import { OUTILS_VENTES } from "./commerce/ventes";
import { OUTILS_BOUTIQUE } from "./commerce/boutique";
import { OUTILS_ANALYTICS } from "./commerce/analytics";

const OUTILS: Outil[] = [...OUTILS_CATALOGUE, ...OUTILS_VENTES, ...OUTILS_BOUTIQUE, ...OUTILS_ANALYTICS];

const erreur = (code: CodeErreur, message: string): ResultatIA => ({ succes: false, code, resultat: `${code} : ${message}` });

/** Refus métier de la caisse (stock insuffisant, transfert déjà expédié…) : des phrases prêtes à dire, avec leur code. */
function depuisPos(e: ErreurPos): ResultatIA {
  const code: CodeErreur = e.status === 404 ? "NOT_FOUND" : e.status === 409 || e.status === 423 ? "CONFLICT" : e.status === 403 ? "UNAVAILABLE" : "INVALID_INPUT";
  return erreur(code, e.message);
}

export const MODULE: ModuleIA = {
  id: "commerce",
  nom: "commerce",
  outils: OUTILS.map(({ run: _run, ...o }) => o),
  executer: async (nom, args, ctx) => {
    const outil = OUTILS.find((o) => o.name === nom);
    if (!outil) return INCONNU;
    try {
      return await outil.run(args ?? {}, ctx);
    } catch (e) {
      if (e instanceof Refus) return erreur(e.code, e.message);
      if (e instanceof ErreurPos) return depuisPos(e);
      // Code-barres ou référence déjà pris (contrainte unique de la base).
      if ((e as any)?.code === "P2002") return erreur("CONFLICT", "un autre élément de la boutique utilise déjà cette valeur (code-barres, slug…). Rien n'a été modifié.");
      throw e; // le serveur le journalise et répond UNAVAILABLE, sans détail interne
    }
  },
};
