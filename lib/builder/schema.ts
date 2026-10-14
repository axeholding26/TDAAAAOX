// AXSO BUILDER — représentation machine de la boutique et schéma explicite de chaque type
// de composant, DÉRIVÉS de ce qui existe vraiment (BLOCK_CATALOG, BlockStyleOverrides,
// sections du socle, sections de fiche produit). Pur : aucune base, aucun rendu. Compact :
// jamais le HTML d'un design importé (résumé), textes tronqués, sections paginées.
import { createHash } from "crypto";
import type { BlockNode, BlockStyleOverrides, ProductPageSectionStyle, ThemeAnimations } from "@/lib/theme-config";
import { THEME_DEFAULTS } from "@/lib/theme-config";
import { BLOCK_CATALOG, getCatalogEntry } from "@/lib/block-catalog";
import { peutDeposer, zoneDe } from "@/lib/block-tree";
import { SECTIONS_FICHE } from "@/lib/fiche-produit";
import { BREAKPOINT_MOBILE, BREAKPOINT_TABLETTE } from "@/lib/element-styles";

// ─── Styles d'un bloc : miroir de BlockStyleOverrides (le typage oblige à couvrir chaque clé) ───
type Champs = Record<string, string>;
const STYLE_BASE: Record<keyof Omit<BlockStyleOverrides, "responsive" | "customClass" | "visibility">, Champs | string> = {
  spacing: { pt: "marge intérieure haut (ex. 48px)", pb: "intérieure bas", pl: "intérieure gauche", pr: "intérieure droite", mt: "marge extérieure haut", mb: "extérieure bas", ml: "extérieure gauche", mr: "extérieure droite" },
  background: { color: "couleur", image: "URL d'image", gradient: "dégradé CSS (linear-gradient…)" },
  typography: { color: "couleur", taille: "ex. 18px", poids: "400-900", align: "left|center|right", police: "id de police (lib/theme-fonts)", interligne: "ex. 1.5", espacement: "ex. 0.02em" },
  hover: { color: "couleur du texte au survol (ordinateur)", background: "fond au survol" },
  border: { radius: "ex. 12px", width: "ex. 1px", color: "couleur" },
  width: "largeur (colonne : ex. 50%)",
};
export const STYLE_SCHEMA = { ...STYLE_BASE, visibility: { desktop: "booléen", tablet: "booléen", mobile: "booléen" } satisfies Record<keyof NonNullable<BlockStyleOverrides["visibility"]>, string> };
export const RESPONSIVE = {
  appareils: { desktop: `> ${BREAKPOINT_TABLETTE}px (valeurs de base)`, tablet: `≤ ${BREAKPOINT_TABLETTE}px`, mobile: `≤ ${BREAKPOINT_MOBILE}px` },
  // Ce que BlockStyleOverrides.responsive accepte réellement : tout le style SAUF visibilité et classe.
  surchargeable: Object.keys(STYLE_BASE),
  visibilite: "par appareil via style.visibility (desktop/tablet/mobile), pas dans style.responsive",
  mecanisme: "container queries CSS (styleUtils.ts) : un appareil ne redéfinit que ce qu'il change, le reste hérite du desktop",
};

const ANIMATIONS_GLOBALES: ThemeAnimations["global"][] = ["none", "fade-in", "slide-up", "slide-left", "zoom-in", "flip", "blur-in"];
export const ANIMATIONS = {
  global: ANIMATIONS_GLOBALES,
  vitesse: ["fast", "normal", "slow"] satisfies ThemeAnimations["vitesse"][],
  preset: ["luxury", "dynamic", "elegant", "playful", "none"] satisfies NonNullable<ThemeAnimations["preset"]>[],
  options: ["parallax", "smoothScroll", "stagger"],
  parSection: "animations.sectionAnimations[<section du socle>] = une valeur de global",
};

const STYLE_FICHE: Record<keyof ProductPageSectionStyle, string> = {
  bgColor: "couleur de fond", textColor: "couleur du texte", paddingY: "none|sm|md|lg|xl", marginY: "none|sm|md|lg",
  maxWidth: "full|medium|narrow", align: "left|center", fontScale: "sm|md|lg|xl",
};

// Valeurs permises des sections du socle (unions de lib/theme-config.ts, non lisibles à l'exécution).
const ENUMS_SOCLE: Record<string, Record<string, (string | number)[]>> = {
  hero: { style: ["centered", "split", "fullscreen", "minimal", "video", "slideshow", "magazine"], hauteur: ["50vh", "60vh", "70vh", "80vh", "100vh"], textPosition: ["left", "center", "right"] },
  vedettes: { triPar: ["ventes", "recent", "featured"], layout: ["grid", "carousel", "masonry"] },
  collections: { layout: ["grid", "masonry", "carousel", "cards"] },
  promo: { style: ["gradient", "solid", "image", "split"] },
  avis: { layout: ["cards", "carousel", "list", "masonry"] },
  newsletter: { style: ["centered", "split", "banner"] },
  confiance: { layout: ["icons", "cards", "bar", "marquee"] },
  about: { layout: ["image-left", "image-right", "centered", "fullwidth"] },
  faq: { layout: ["accordion", "grid", "columns"] },
};
export const SECTIONS_SOCLE = Object.keys(THEME_DEFAULTS["terre-et-or"].sections);

// ─── Schéma d'un type de composant ─────────────────────────────────────────────
type Prop = { type: string; enum?: (string | number)[]; defaut?: unknown; items?: unknown };

function enumDe(champs: string, cle: string): (string | number)[] | undefined {
  const m = champs.match(new RegExp(`\\b${cle}\\??:\\s*((?:"[^"]+"\\s*\\|\\s*)+"[^"]+"|\\d+(?:\\|\\d+)+)`));
  return m ? m[1].split("|").map((v) => (v.trim().startsWith('"') ? v.trim().slice(1, -1) : Number(v))) : undefined;
}

function propDe(v: unknown, enumeration?: (string | number)[]): Prop {
  if (Array.isArray(v)) {
    const premier = v[0];
    return { type: "array", items: premier && typeof premier === "object" ? Object.fromEntries(Object.entries(premier).map(([k, x]) => [k, typeof x])) : typeof (premier ?? "string") };
  }
  return { type: typeof v, ...(enumeration && { enum: enumeration }), defaut: typeof v === "string" ? tronquer(v, 60) : v };
}

const MEDIA = /url|image|logo|video/i;
const MISE_EN_PAGE = /colonnes|layout|style|align|ratio|niveau|taille|hauteur|textPosition|overlay/i;

/** Répartit des propriétés en contenu / média / mise en page / données, comme l'exemple Hero du cahier. */
function repartir(config: Record<string, any>, enumDeCle: (k: string) => (string | number)[] | undefined, liaisons: string[] = []) {
  const out = { content: {} as Record<string, Prop>, media: {} as Record<string, Prop>, layout: {} as Record<string, Prop>, data: {} as Record<string, Prop> };
  for (const [k, v] of Object.entries(config)) {
    const p = propDe(v, enumDeCle(k));
    (liaisons.includes(k) ? out.data : MEDIA.test(k) ? out.media : MISE_EN_PAGE.test(k) ? out.layout : out.content)[k] = p;
  }
  return out;
}

export interface SchemaComposant {
  type: string; label: string; source: "catalogue" | "socle" | "fiche_produit" | "design_importe";
  content: Record<string, Prop>; media: Record<string, Prop>; layout: Record<string, Prop>; data: Record<string, Prop>;
  style: unknown; responsive: unknown; enfants?: string[]; notes?: string[];
}

/**
 * Schéma explicite d'un type : bloc du catalogue (« heading », « products »…), section du
 * socle (« hero », « annonce »… — seulement si la boutique est sur le socle), section de fiche
 * produit (« fiche:gallery »…) ou « embed-html ». null si le type n'existe pas.
 */
export function schemaComposant(type: string, opts: { socle?: boolean } = {}): SchemaComposant | null {
  if (type === "embed-html") {
    return { type, label: "Section du design importé", source: "design_importe", content: {}, media: {}, layout: {}, data: {}, style: null, responsive: null,
      notes: ["HTML du design : jamais écrit par une IA. Déplacer, masquer, dupliquer, supprimer la section ; ses éléments (data-axs-el) se modifient avec modifier_design_accueil."] };
  }
  const entree = getCatalogEntry(type as BlockNode["type"]);
  if (entree) {
    const conteneur = entree.categorie === "structure";
    const enfants = BLOCK_CATALOG.map((e) => e.type as string).filter((t) => peutDeposer(type as BlockNode["type"], t as BlockNode["type"]));
    return {
      type, label: entree.label, source: "catalogue",
      ...repartir(entree.defaultConfig ?? {}, (k) => enumDe(entree.champs, k), type === "products" ? ["tri", "nombre"] : []),
      style: STYLE_SCHEMA, responsive: { tablet: STYLE_BASE, mobile: STYLE_BASE, ...RESPONSIVE },
      ...(conteneur && { enfants }),
      notes: [entree.champs, ...(type === "products" ? ["Affiche les VRAIS produits de la boutique (liaison : tri, nombre)."] : [])],
    };
  }
  if (type.startsWith("fiche:")) {
    const s = SECTIONS_FICHE[type.slice(6)];
    if (!s) return null;
    return { type, label: s.label, source: "fiche_produit", ...repartir(s.defaut(), () => undefined), style: STYLE_FICHE, responsive: null,
      notes: [s.base ? "Section de base de la fiche : masquable, jamais supprimée." : "Section ajoutable à la fiche produit."] };
  }
  const defaut = (THEME_DEFAULTS["terre-et-or"].sections as Record<string, any>)[type];
  if (defaut && opts.socle) {
    const { actif: _a, ...config } = defaut;
    return { type, label: `Section « ${type} » du socle`, source: "socle", ...repartir(config, (k) => ENUMS_SOCLE[type]?.[k]), style: { animation: ANIMATIONS_GLOBALES }, responsive: null,
      notes: ["Section de l'accueil du socle : actif (affichée ou non), ordre dans sectionOrder, animation dans animations.sectionAnimations. Pas de style par appareil."] };
  }
  return null;
}

// ─── Représentation machine de la boutique ─────────────────────────────────────
export function tronquer(v: unknown, max = 160): any {
  if (typeof v === "string") return v.length > max ? `${v.slice(0, max)}…` : v;
  if (Array.isArray(v)) return v.length > 12 ? [...v.slice(0, 12).map((x) => tronquer(x, max)), `… ${v.length - 12} de plus`] : v.map((x) => tronquer(x, max));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tronquer(x, max)]));
  return v;
}

export const versionDe = (v: unknown) => createHash("sha1").update(JSON.stringify(v ?? null)).digest("hex").slice(0, 8);

const texte = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** Résumé d'un HTML importé : jamais le HTML lui-même. */
export function resumerHtml(html = "") {
  const titres = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => tronquer(texte(m[1]), 80)).filter(Boolean).slice(0, 5);
  return {
    taille: html.length,
    elements_editables: (html.match(/data-axs-el=/g) ?? []).length || (html.match(/<(h[1-6]|p|a|button|img)\b/gi) ?? []).length,
    textes_principaux: titres,
  };
}

export interface NoeudSchema {
  id: string; type: string; version: string; position: number; zone?: string;
  children: NoeudSchema[] | { tronque: number } | null;
  properties: unknown; styles: unknown; responsiveStyles: unknown;
  visibility: { actif: boolean; desktop: boolean; tablet: boolean; mobile: boolean };
  conditions: null; dataBindings: unknown; events: unknown; permissions: Record<string, boolean | string>;
}

const CONTENEURS = new Set(["section", "row", "column"]);

export function noeud(n: BlockNode, position: number, profondeur: number, racine = false): NoeudSchema {
  const { responsive, visibility, ...styles } = n.style ?? {};
  const design = n.type === "embed-html";
  const cfg = (n.config ?? {}) as Record<string, any>;
  const liens = Object.entries(cfg).filter(([k, v]) => /lien$/i.test(k) && typeof v === "string" && v);
  return {
    id: n.id, type: n.type, version: versionDe({ c: n.config, s: n.style, a: n.actif }), position,
    ...(racine && { zone: zoneDe(n) }),
    children: n.children?.length ? (profondeur > 1 ? n.children.map((c, i) => noeud(c, i, profondeur - 1)) : { tronque: n.children.length }) : null,
    properties: design ? { ...resumerHtml(cfg.html), styles_elements: Object.keys(cfg.elementStyles ?? {}).length } : tronquer(cfg),
    styles: Object.keys(styles).length ? styles : null,
    responsiveStyles: responsive ?? null,
    visibility: { actif: n.actif !== false, desktop: visibility?.desktop !== false, tablet: visibility?.tablet !== false, mobile: visibility?.mobile !== false },
    conditions: null,
    dataBindings: n.type === "products" ? { source: "produits de la boutique", tri: cfg.tri ?? "recent", nombre: cfg.nombre ?? 8 } : null,
    events: liens.length ? Object.fromEntries(liens.map(([k, v]) => [k, { clic: "aller_a", cible: v }])) : null,
    permissions: design
      ? { modifier_proprietes: false, deplacer: true, masquer: true, dupliquer: true, supprimer: true, elements: "modifier_design_accueil" }
      : { modifier_proprietes: !CONTENEURS.has(n.type), modifier_style: true, deplacer: true, masquer: true, dupliquer: true, supprimer: true },
  };
}

export interface OptionsSchema { page?: string; profondeur?: number; offset?: number; limite?: number }

function liste(nodes: BlockNode[], o: Required<Omit<OptionsSchema, "page">>, racine = true) {
  const tranche = nodes.slice(o.offset, o.offset + o.limite);
  return { total: nodes.length, offset: o.offset, nodes: tranche.map((n, i) => noeud(n, o.offset + i, o.profondeur, racine)), ...(o.offset + o.limite < nodes.length && { suite: o.offset + o.limite }) };
}

const sectionsListe = (sections: { id: string; type: string; actif?: boolean; config?: any; style?: unknown }[] = [], prefixe = "") =>
  sections.map((s, i) => ({ id: s.id, type: `${prefixe}${s.type}`, version: versionDe(s), position: i, properties: tronquer(s.config ?? {}), styles: s.style ?? null, visibility: { actif: s.actif !== false } }));

/**
 * Store → Theme, Global Styles, Header, Navigation, Pages, Footer. `cfg` : la configuration
 * EFFECTIVE (défauts du socle et design actif appliqués). `page` : ne rendre que cette page.
 */
export function schemaBoutique(cfg: Record<string, any>, opts: OptionsSchema = {}) {
  const o = { profondeur: Math.min(6, Math.max(1, opts.profondeur ?? 4)), offset: Math.max(0, opts.offset ?? 0), limite: Math.min(50, Math.max(1, opts.limite ?? 20)) };
  const arbre: BlockNode[] = cfg.builderTree ?? [];
  const zone = (z: string) => arbre.filter((n) => zoneDe(n) === z);
  const importe = typeof cfg.builderHtml === "string" && cfg.builderHtml.length > 0;
  const habillage = (cle: string, standard: string) => (cfg[cle] ? { source: "design_importe", modifiable: false, resume: resumerHtml(cfg[cle]) } : { source: "standard", modifiable: false, note: standard });

  const accueil = () => {
    if (zone("template").length) return { source: "constructeur", ...liste(zone("template"), o) };
    if (importe) return { source: "design_importe_non_decoupe", resume: resumerHtml(cfg.builderHtml), note: "Le design n'est pas encore découpé en sections : le marchand l'importe une fois dans le Constructeur (ou modifier_design_accueil le fait)." };
    const ordre: string[] = (cfg.sectionOrder?.length ? cfg.sectionOrder : SECTIONS_SOCLE).filter((k: string) => cfg.sections?.[k]);
    return {
      source: "socle",
      nodes: ordre.map((k, i) => ({ id: k, type: k, version: versionDe(cfg.sections[k]), position: i, properties: tronquer(cfg.sections[k]), visibility: { actif: cfg.sections[k].actif !== false }, animation: cfg.animations?.sectionAnimations?.[k] ?? null })),
      sections_personnalisees: sectionsListe(cfg.customSections),
    };
  };

  const pages: Record<string, () => unknown> = {
    accueil,
    produits: () => (cfg.builderHtmlProduits ? { source: "design_importe", resume: resumerHtml(cfg.builderHtmlProduits) } : { source: "socle", note: "grille des produits du thème (colonnes : layout.colonnesProduits)" }),
    "fiche-produit": () => ({ layout: cfg.productPage?.layout ?? "amazon", sections: sectionsListe(cfg.productPage?.sections, "fiche:"), fiches_par_produit: Object.keys(cfg.productPagesParProduit ?? {}).length, habillage: cfg.builderHtmlProduit ? "design_importe" : "socle" }),
    collections: () => ({ source: "socle", note: "page de collection standard (même grille que le catalogue)" }),
    panier: () => habillage("builderHtmlPanierChrome", "panier standard Axso"),
    commande: () => habillage("builderHtmlCheckoutChrome", "tunnel de commande standard Axso (jamais modifiable par une IA)"),
    "a-propos": () => ({ actif: cfg.aboutPage?.actif ?? false, sections: sectionsListe(cfg.aboutPage?.sections) }),
    contact: () => ({ actif: cfg.contactPage?.actif ?? false, intro: tronquer(cfg.contactPage?.intro ?? ""), formulaire: cfg.contactPage?.afficherFormulaire ?? true, sections: sectionsListe(cfg.contactPage?.sections) }),
    ...Object.fromEntries(Object.entries((cfg.pagesPerso ?? {}) as Record<string, any>).map(([slug, p]) => [`p/${slug}`, () => ({
      nom: p?.nom ?? slug, slug, statut: p?.statut ?? null, seo: tronquer(p?.seo ?? null), ...liste(p?.builderTree ?? [], o),
    })])),
  };

  if (opts.page) {
    const f = pages[opts.page];
    return f ? { page: opts.page, ...(f() as object) } : null;
  }
  const zoneOuSource = (z: string) => (zone(z).length ? { source: "constructeur", ...liste(zone(z), o) } : { source: importe ? "design_importe" : "socle" });
  return {
    store: {
      theme: { design_importe: importe, constructeur_libre: arbre.length > 0, mode: cfg.modeBoutique ?? "catalogue", designs_proposes: cfg.designsOrigine ?? [] },
      globalStyles: { colors: cfg.colors, fonts: cfg.fonts, radius: cfg.radius, layout: cfg.layout, boutons: cfg.boutons, animations: cfg.animations && { global: cfg.animations.global, vitesse: cfg.animations.vitesse, preset: cfg.animations.preset } },
      header: zoneOuSource("header"),
      navigation: cfg.navigationStyle ?? null,
      pages: Object.fromEntries(Object.entries(pages).map(([k, f]) => [k, f()])),
      footer: zoneOuSource("footer"),
    },
  };
}
