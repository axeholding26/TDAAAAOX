// Config de la VITRINE (server-only) : la config résolue, plus tout ce que le
// Constructeur applique à l'aperçu, pour que la boutique en ligne montre
// exactement la même chose sur TOUTES ses pages :
//  - CSS du design avec les couleurs et polices choisies : chaque rendu du
//    design passe par lib/scope-css.ts::cssDesignPersonnalise ;
//  - en-tête / pied de page tels que modifiés dans le Constructeur (sections
//    des zones En-tête / Pied de page) sur le catalogue, la fiche produit, le
//    panier, la commande et la confirmation — qui gardaient sinon la copie
//    d'origine faite au provisionnement.
// Jamais enregistré en base : calculé à chaque rendu de la vitrine.
import { parse, type HTMLElement as ParsedElement } from "node-html-parser";
import type { BlockNode, ThemeConfig } from "./theme-config";
import { ordonnerParZone, zoneDe, type Zone } from "./block-tree";
import { resolveThemeConfigAsync } from "./theme-config-server";

function htmlEmbeds(node: BlockNode): string {
  if (node.actif === false) return "";
  if (node.type === "embed-html") return node.config?.html || "";
  return (node.children ?? []).map(htmlEmbeds).join("");
}

// ponytail: seules les sections issues du design (embed-html) sont reprises
// sur les autres pages ; un bloc React ajouté dans l'en-tête (ex. « Texte »)
// n'apparaît que sur l'accueil — à rendre côté serveur si le besoin se présente.
function htmlZone(tree: BlockNode[], zone: Zone): string {
  return tree.filter((n) => zoneDe(n) === zone).map(htmlEmbeds).join("");
}

// Remplace ce qui entoure la vue (.view) d'une page du design par l'en-tête et
// le pied de page du Constructeur. Les <svg> de <symbol> d'origine sont gardés :
// la vue peut s'en servir (<use>).
function remplacerChrome(page: string | undefined, entete: string, pied: string): string | undefined {
  if (!page) return page;
  const racine = parse(page);
  const enfants = racine.childNodes.filter((n) => (n as ParsedElement).tagName) as ParsedElement[];
  const iVue = enfants.findIndex((el) => el.classList?.contains("view"));
  if (iVue < 0) return page;
  const defs = enfants.slice(0, iVue).filter((el) => el.tagName.toLowerCase() === "svg").map((el) => el.outerHTML).join("");
  return defs + entete + enfants[iVue].outerHTML + pied;
}

export function appliquerConstructeur(cfg: ThemeConfig): ThemeConfig {
  const tree = ordonnerParZone(cfg.builderTree ?? []);
  // Arbre pas encore découpé en zones (Constructeur jamais ouvert) : rien à reporter.
  if (!tree.some((n) => zoneDe(n) !== "template")) return cfg;

  const entete = htmlZone(tree, "header");
  const pied = htmlZone(tree, "footer");
  return {
    ...cfg,
    builderHtmlProduits: remplacerChrome(cfg.builderHtmlProduits, entete, pied),
    builderHtmlProduit: remplacerChrome(cfg.builderHtmlProduit, entete, pied),
    builderHtmlPanierChrome: remplacerChrome(cfg.builderHtmlPanierChrome, entete, pied),
    builderHtmlCheckoutChrome: remplacerChrome(cfg.builderHtmlCheckoutChrome, entete, pied),
    builderHtmlConfirmationChrome: remplacerChrome(cfg.builderHtmlConfirmationChrome, entete, pied),
  };
}

/** À utiliser par toutes les pages de la vitrine à la place de resolveThemeConfigAsync. */
export async function resolveConfigVitrine(themeId: string, tenantId: string, savedConfig: Record<string, any> = {}): Promise<ThemeConfig> {
  return appliquerConstructeur(await resolveThemeConfigAsync(themeId, tenantId, savedConfig));
}
