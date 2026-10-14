// AXSO BUILDER MCP — construire, modifier, vérifier, prévisualiser et publier une boutique.
// Parties : chaque fichier exporte OUTILS et executer ; les opérations pures du registre
// (lib/builder/operations) deviennent des outils avancés, appliqués au brouillon en transaction.
import { INCONNU, type ModuleIA, type OutilIA, type ResultatIA, type CtxOutil } from "../../types";
import { OPERATIONS } from "@/lib/builder/operations";
import { modifier, outilDeOperation } from "./commun";
import * as publication from "./publication";
import * as decouverte from "./decouverte";
import * as design from "./design";
import * as structure from "./structure";
import * as navigation from "./navigation";
import * as assets from "./assets";
import * as analyses from "./analyses";
import * as orchestration from "./orchestration";
import * as experiences from "./experiences";

type Partie = { OUTILS: OutilIA[]; executer: (nom: string, args: Record<string, any>, ctx: CtxOutil) => Promise<ResultatIA> };
const PARTIES: Partie[] = [publication, decouverte, design, structure, navigation, assets, analyses, orchestration, experiences];

const parNom = new Map<string, Partie>();
for (const p of PARTIES) for (const o of p.OUTILS) parNom.set(o.name, p);

// Économie d'outils : seuls les outils de haut niveau sont listés d'office au modèle ; les autres
// sont découverts (axso_builder_get_capabilities, axso_decouvrir) et appelés par axso_outil.
const VISIBLES = new Set([
  "get_capabilities", "get_store_context", "get_schema", "get_draft_status", "analyze_store", "get_health_score", "validate",
  "plan_design_goal", "execute_design_goal", "customize_store", "optimize_conversion", "optimize_mobile",
  "manage_theme", "manage_navigation", "manage_products_display", "manage_assets",
  "create_page_from_intent", "create_landing_page", "create_store_from_brief",
  "apply", "preview", "publish", "rollback",
].map((n) => `axso_builder_${n}`));
const economiser = (o: OutilIA): OutilIA => ({ ...o, cache: !VISIBLES.has(o.name) });

export const MODULE: ModuleIA = {
  id: "builder",
  nom: "Builder",
  outils: [...PARTIES.flatMap((p) => p.OUTILS), ...OPERATIONS.filter((o) => !parNom.has(o.nom)).map((o) => outilDeOperation(o, o.capacite, o.risque))].map(economiser),
  executer: async (nom, args, ctx) => {
    const partie = parNom.get(nom);
    if (partie) return partie.executer(nom, args, ctx);
    if (OPERATIONS.some((o) => o.nom === nom)) return modifier(ctx, [{ op: nom, args }], `« ${nom.replace(/^axso_builder_/, "").replace(/_/g, " ")} » appliqué`);
    return INCONNU;
  },
};
