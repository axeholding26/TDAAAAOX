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
import { prisma } from "./prisma";
import { prixClient } from "./pricing";
import { formatMontant, slugify } from "./utils";
import { MANIFESTE_LIBRAIRIE } from "./axso-design-manifest";
import { fichierDepuisSlugTheme } from "./axso-design-library";
import { remplacerTokensCarte } from "./theme-import-clone";

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

/** En-tête et pied de page du design autour de la vue (.view) d'une page — la fiche produit y insère ses sections. */
export function decouperChrome(page: string | undefined): { avant: string; apres: string } | null {
  if (!page) return null;
  const racine = parse(page);
  const enfants = racine.childNodes.filter((n) => (n as ParsedElement).tagName) as ParsedElement[];
  const iVue = enfants.findIndex((el) => el.classList?.contains("view"));
  if (iVue < 0) return null;
  return {
    avant: enfants.slice(0, iVue).map((el) => el.outerHTML).join(""),
    apres: enfants.slice(iVue + 1).map((el) => el.outerHTML).join(""),
  };
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

const RE_GRILLE = /id="(homeGrid|plpGrid)"/;

type Catalogue = { cartes: string; nb: number; categories: { slug: string; label: string }[] };

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Filtres du catalogue : les designs livrent des catégories inventées
// (« Vêtements, Accessoires, Maison ») dont le script a été retiré à l'import.
// On les reconstruit avec les VRAIES catégories de la boutique, dans le style
// du design ; le filtrage au clic est fait par components/storefront/FiltresCatalogue.tsx.
function reconstruireFiltres(racine: ParsedElement, categories: Catalogue["categories"]) {
  // Convention commune aux designs de la bibliothèque : pastilles `[data-cat]`, « Tout » = data-cat="all".
  racine.querySelectorAll('[data-cat="all"]').forEach((tout) => {
    const conteneur = tout.parentNode as ParsedElement;
    if (!conteneur || conteneur.closest("#plpGrid, #homeGrid")) return;
    if (categories.length < 2) { conteneur.remove(); return; }
    const classe = (tout.getAttribute("class") ?? "").replace(/\bactive\b/, "").trim();
    conteneur.set_content(tout.outerHTML + categories.map((c) => `<div class="${esc(classe)}" data-cat="${esc(c.slug)}">${esc(c.label)}</div>`).join(""));
  });
}

function remplirGrilles(html: string | undefined, cat: Catalogue): string | undefined {
  if (!html || !RE_GRILLE.test(html)) return html;
  const racine = parse(html);
  racine.querySelectorAll("#homeGrid, #plpGrid").forEach((g) => g.set_content(cat.cartes));
  // Compteur figé dans le design (« 8 pièces ») → vrai nombre, même mot.
  racine.querySelectorAll("#plpCount").forEach((el) => {
    const mot = el.text.trim().match(/^\d+\s+(.+?)s?$/)?.[1];
    if (mot) el.set_content(`${cat.nb} ${mot}${cat.nb > 1 ? "s" : ""}`);
  });
  if (racine.querySelector("#plpGrid")) reconstruireFiltres(racine, cat.categories);
  return racine.toString();
}

function remplirGrillesArbre(nodes: BlockNode[], cat: Catalogue): BlockNode[] {
  return nodes.map((n) => ({
    ...n,
    ...(n.type === "embed-html" && n.config?.html ? { config: { ...n.config, html: remplirGrilles(n.config.html, cat) } } : {}),
    ...(n.children ? { children: remplirGrillesArbre(n.children, cat) } : {}),
  }));
}

// Les grilles produits des designs AXSO (accueil #homeGrid, boutique #plpGrid)
// sont figées au provisionnement : on les régénère à chaque rendu avec les
// produits actuels et la DEVISE ACTUELLE de la boutique — sinon un changement
// de pays/devise (ou un nouveau produit) n'apparaît jamais sur la vitrine.
async function rafraichirGrillesProduits(cfg: ThemeConfig, themeId: string, tenantId: string): Promise<ThemeConfig> {
  const tree = cfg.builderTree ?? [];
  if (!RE_GRILLE.test((cfg.builderHtml ?? "") + (cfg.builderHtmlProduits ?? "") + JSON.stringify(tree))) return cfg;
  const [theme, tenant, produits] = await Promise.all([
    prisma.theme.findUnique({ where: { id: themeId }, select: { slug: true } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true, devise: true, commissionRate: true } }),
    prisma.produit.findMany({ where: { tenantId, actif: true }, orderBy: { createdAt: "desc" }, take: 24 }),
  ]);
  const fichier = theme ? fichierDepuisSlugTheme(theme.slug) : null;
  const carte = MANIFESTE_LIBRAIRIE.find((e) => e.fichier === fichier)?.carteTemplate;
  // Sans produit, on garde les cartes de démonstration du design.
  if (!tenant || !carte || produits.length === 0) return cfg;
  const taux = tenant.commissionRate ?? 0.06;
  const categories = [...new Map(produits.filter((p) => p.categorie?.trim()).map((p) => [slugify(p.categorie!), p.categorie!.trim()])).entries()]
    .map(([slug, label]) => ({ slug, label }));
  // Catégorie sur chaque carte : de quoi filtrer dans le navigateur.
  const cartes = produits.map((p) => {
    const prix = prixClient(p.prix, taux);
    const html = remplacerTokensCarte(carte, { id: p.id, nom: p.nom, prixAffiche: formatMontant(prix, tenant.devise), image: p.images[0] ?? null, description: p.description }, tenant.slug);
    return html.replace(/^(\s*<[a-zA-Z0-9]+)/, `$1 data-cat="${esc(slugify(p.categorie ?? ""))}"`);
  }).join("");
  const cat: Catalogue = { cartes, nb: produits.length, categories };
  return {
    ...cfg,
    builderHtml: remplirGrilles(cfg.builderHtml, cat),
    builderHtmlProduits: remplirGrilles(cfg.builderHtmlProduits, cat),
    ...(tree.length ? { builderTree: remplirGrillesArbre(tree, cat) } : {}),
  };
}

/** À utiliser par toutes les pages de la vitrine à la place de resolveThemeConfigAsync. */
export async function resolveConfigVitrine(themeId: string, tenantId: string, savedConfig: Record<string, any> = {}): Promise<ThemeConfig> {
  const cfg = await resolveThemeConfigAsync(themeId, tenantId, savedConfig);
  return appliquerConstructeur(await rafraichirGrillesProduits(cfg, themeId, tenantId));
}
