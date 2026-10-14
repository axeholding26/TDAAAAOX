// Opérations pures du Builder — design system, thème, marque et gabarits. Elles changent le
// BROUILLON (le moteur valide puis enregistre). Les valeurs permises sont celles des menus du
// Constructeur (lib/axia/reglages-theme.ts) : une valeur hors liste est refusée, jamais
// « arrangée ». Une marque fixée par le marchand l'emporte : conflit → POLICY_BLOCKED.
import type { BlockNode, ThemeConfig } from "@/lib/theme-config";
import { reglagesTheme } from "@/lib/axia/reglages-theme";
import { FONTS } from "@/lib/theme-fonts";
import { BLOCK_CATALOG, createDefaultNode, getCatalogEntry } from "@/lib/block-catalog";
import { zoneDe } from "@/lib/block-tree";
import { MANIFESTE_LIBRAIRIE } from "@/lib/axso-design-manifest";
import { generateStoreConfig, type CategoryType } from "@/lib/generate-store-config";
import { BREAKPOINT_MOBILE, BREAKPOINT_TABLETTE } from "@/lib/element-styles";
import { conflitsMarque, marqueDe, VERROUS, type Marque } from "../marque";
import { ErreurBuilder, type DonneesBoutique, type OperationBuilder } from "../types";

const COULEURS = ["accent", "accentSecondaire", "fond", "texte", "surface", "texteMuted", "bordure"] as const;
const HEX = /^#[0-9a-f]{6}$/i;
const GROUPES = ["couleurs", "polices", "arrondi", "miseEnPage", "boutons", "navigation", "animations"];
const IDS_POLICES = FONTS.map((f) => f.v as string);
const objet = (properties: Record<string, any>, required: string[] = []) => ({ type: "object" as const, properties, required });

export interface Reglages {
  couleurs?: Record<string, unknown>; polices?: Record<string, unknown>; arrondi?: unknown;
  miseEnPage?: Record<string, unknown>; boutons?: Record<string, unknown>; navigation?: Record<string, unknown>; animations?: Record<string, unknown>;
}

/**
 * Applique des réglages de thème (mêmes règles et même fusion que modifier_theme / modifier_couleurs),
 * en tout ou rien, puis vérifie la marque.
 */
export function appliquerReglages(cfg: ThemeConfig, r: Reglages, donnees: Pick<DonneesBoutique, "nom">): ThemeConfig {
  const { bordureWidth, ...boutons } = (r.boutons ?? {}) as Record<string, unknown>;
  const { patch, refus } = reglagesTheme({ ...r, boutons });
  for (const k of Object.keys(r)) if (!GROUPES.includes(k)) refus.push(`${k} (groupe inconnu)`);
  const couleurs: Record<string, string> = {};
  for (const [k, v] of Object.entries(r.couleurs ?? {})) {
    if ((COULEURS as readonly string[]).includes(k) && typeof v === "string" && HEX.test(v.trim())) couleurs[k] = v.trim();
    else refus.push(`couleurs.${k}=${JSON.stringify(v)}`);
  }
  if (bordureWidth !== undefined) {
    if (typeof bordureWidth === "string" && /^[0-4]px$/.test(bordureWidth)) (patch.boutons ??= {}).bordureWidth = bordureWidth;
    else refus.push(`boutons.bordureWidth=${JSON.stringify(bordureWidth)} (0px à 4px)`);
  }
  if (refus.length) throw new ErreurBuilder("INVALID_INPUT", `valeurs refusées : ${refus.join(", ")}. Valeurs permises : axso_builder_get_design_system.`);
  if (!Object.keys(patch).length && !Object.keys(couleurs).length) throw new ErreurBuilder("INVALID_INPUT", "aucun réglage reçu.");
  const c = cfg as any;
  const suivant = {
    ...c,
    ...(Object.keys(couleurs).length && { colors: { ...c.colors, ...couleurs } }),
    ...(patch.fonts && { fonts: { ...c.fonts, ...patch.fonts } }),
    ...(patch.radius && { radius: patch.radius }),
    ...(patch.layout && { layout: { ...c.layout, ...patch.layout } }),
    ...(patch.boutons && { boutons: { ...c.boutons, ...patch.boutons } }),
    ...(patch.navigationStyle && { navigationStyle: { ...c.navigationStyle, ...patch.navigationStyle } }),
    ...(patch.animations && { animations: { ...c.animations, ...patch.animations } }),
    // Comme le Constructeur : ces panneaux s'appliquent aussi au design importé (lib/reglages-design.ts).
    ...((patch.boutons || patch.navigationStyle || patch.animations) && { reglagesDesign: {
      ...c.reglagesDesign, ...(patch.boutons && { boutons: true }), ...(patch.navigationStyle && { navigation: true }), ...(patch.animations && { animations: true }),
    } }),
  };
  const conflits = conflitsMarque(cfg, suivant, marqueDe(cfg, { nom: donnees.nom }));
  if (conflits.length) {
    throw new ErreurBuilder("POLICY_BLOCKED", `contraire à la marque fixée par le marchand : ${conflits.join(" ; ")}. Rien n'a été appliqué. Propose une valeur de la palette, ou demande au marchand de faire évoluer sa marque (axso_builder_update_brand).`);
  }
  return suivant as ThemeConfig;
}

// ─── Design tokens ↔ vrais champs de ThemeConfig ───────────────────────────────
// chemin : groupe de réglages + champ ; null = le token n'a pas de champ réel (dit tel quel).
type Token = { groupe: keyof Reglages; champ?: string; valeurs: string } | { groupe: null; raison: string };
const RS = { groupe: null, raison: "pas de champ dans le thème : seulement par bloc (style.spacing) ou par élément" } as const;
export const TOKENS: Record<string, Token> = {
  "color.primary": { groupe: "couleurs", champ: "accent", valeurs: "#RRGGBB" },
  "color.secondary": { groupe: "couleurs", champ: "accentSecondaire", valeurs: "#RRGGBB" },
  "color.background": { groupe: "couleurs", champ: "fond", valeurs: "#RRGGBB" },
  "color.surface": { groupe: "couleurs", champ: "surface", valeurs: "#RRGGBB" },
  "color.text": { groupe: "couleurs", champ: "texte", valeurs: "#RRGGBB" },
  "color.text-muted": { groupe: "couleurs", champ: "texteMuted", valeurs: "#RRGGBB" },
  "color.border": { groupe: "couleurs", champ: "bordure", valeurs: "#RRGGBB" },
  "font.heading": { groupe: "polices", champ: "titre", valeurs: `id de police : ${IDS_POLICES.join("|")}` },
  "font.body": { groupe: "polices", champ: "corps", valeurs: "id de police" },
  "font.heading-weight": { groupe: "polices", champ: "poidsTitre", valeurs: "400|500|600|700|800|900" },
  "font.size-base": { groupe: "polices", champ: "tailleBase", valeurs: "13px à 18px" },
  "font.letter-spacing": { groupe: "polices", champ: "lettreEspacement", valeurs: "ex. 0.02em" },
  "font.line-height": { groupe: "polices", champ: "hauteurLigne", valeurs: "ex. 1.5" },
  "font.heading-transform": { groupe: "polices", champ: "transformTitre", valeurs: "none|uppercase|capitalize" },
  "radius.base": { groupe: "arrondi", valeurs: "0px|4px|8px|12px|16px|24px|9999px" },
  "radius.sm": { groupe: null, raison: "un seul arrondi global (radius.base) ; ailleurs par bloc (style.border.radius)" },
  "radius.lg": { groupe: null, raison: "un seul arrondi global (radius.base)" },
  "spacing.section": { groupe: "miseEnPage", champ: "paddingSection", valeurs: "sm|md|lg|xl" },
  "spacing.xs": RS, "spacing.sm": RS, "spacing.md": RS, "spacing.lg": RS, "spacing.xl": RS,
  "container.max-width": { groupe: "miseEnPage", champ: "largeurContainer", valeurs: "1024px|1280px|1440px|1600px|100%" },
  "grid.columns": { groupe: "miseEnPage", champ: "colonnesProduits", valeurs: "2 à 5" },
  "grid.columns-mobile": { groupe: "miseEnPage", champ: "colonnesMobile", valeurs: "1 ou 2" },
  "card.style": { groupe: "miseEnPage", champ: "styleCarte", valeurs: "shadow|bordered|flat|lifted" },
  "shadow.card": { groupe: "miseEnPage", champ: "ombre", valeurs: "none|sm|md|lg|xl" },
  "button.style": { groupe: "boutons", champ: "style", valeurs: "filled|outlined|ghost|pill|square" },
  "button.size": { groupe: "boutons", champ: "taille", valeurs: "sm|md|lg|xl" },
  "button.hover": { groupe: "boutons", champ: "hover", valeurs: "lighten|darken|scale|glow|slide" },
  "button.border-width": { groupe: "boutons", champ: "bordureWidth", valeurs: "0px à 4px" },
  "nav.type": { groupe: "navigation", champ: "type", valeurs: "classic|centered|floating|minimal|mega|transparent-scroll" },
  "nav.style": { groupe: "navigation", champ: "style", valeurs: "light|dark|glass|transparent" },
  "nav.height": { groupe: "navigation", champ: "hauteur", valeurs: "48px|64px|80px" },
  "nav.sticky": { groupe: "navigation", champ: "sticky", valeurs: "booléen" },
  "animation.preset": { groupe: "animations", champ: "preset", valeurs: "luxury|dynamic|elegant|playful|none" },
  "animation.global": { groupe: "animations", champ: "global", valeurs: "none|fade-in|slide-up|slide-left|zoom-in|flip|blur-in" },
  "animation.speed": { groupe: "animations", champ: "vitesse", valeurs: "fast|normal|slow" },
  "breakpoint.tablet": { groupe: null, raison: `fixe : ${BREAKPOINT_TABLETTE}px (lecture seule)` },
  "breakpoint.mobile": { groupe: null, raison: `fixe : ${BREAKPOINT_MOBILE}px (lecture seule)` },
  "input.*": { groupe: null, raison: "les champs de formulaire suivent couleurs, arrondi et polices du thème ; pas de réglage propre" },
  "badge.*": { groupe: null, raison: "pas de réglage de badge dans le thème" },
  "icon.*": { groupe: null, raison: "pas de jeu d'icônes réglable : émojis/textes dans les blocs (features, confiance)" },
  "border.width": { groupe: null, raison: "pas d'épaisseur de bordure globale : par bloc (style.border.width) ; boutons : button.border-width" },
};

const CHAMP_REEL: Record<string, string> = { couleurs: "colors", polices: "fonts", arrondi: "radius", miseEnPage: "layout", boutons: "boutons", navigation: "navigationStyle", animations: "animations" };
export const champReel = (t: Token) => (t.groupe ? `${CHAMP_REEL[t.groupe]}${t.groupe === "arrondi" ? "" : `.${t.champ}`}` : null);

/** { "color.primary": "#…" } → réglages. Token inconnu ou sans champ réel : refusé, avec la raison. */
export function reglagesDepuisTokens(tokens: Record<string, unknown>): Reglages {
  const r: Record<string, any> = {};
  const refus: string[] = [];
  for (const [nom, v] of Object.entries(tokens ?? {})) {
    const t = TOKENS[nom];
    if (!t) refus.push(`${nom} : token inconnu`);
    else if (!t.groupe) refus.push(`${nom} : ${t.raison}`);
    else if (t.groupe === "arrondi") r.arrondi = v;
    else (r[t.groupe] ??= {})[t.champ!] = v;
  }
  if (refus.length) throw new ErreurBuilder("INVALID_INPUT", `${refus.join(" ; ")}. Liste : axso_builder_get_design_system.`);
  return r;
}

// ─── Gabarits ──────────────────────────────────────────────────────────────────
export const LIBELLES_CATEGORIES: Record<CategoryType, string> = {
  fashion: "Mode", beauty: "Beauté & cosmétiques", food: "Alimentation", tech: "Électronique & tech", home: "Maison & déco",
  jewelry: "Bijoux & montres", kids: "Enfants", health: "Santé & bien-être", sport: "Sport", services: "Services & formations",
  agriculture: "Agriculture", artisan: "Artisanat", books: "Livres & culture", auto: "Auto & moto", general: "Généraliste",
};
// Mot que detectCategory ramène à la catégorie (generateStoreConfig ne prend qu'un libellé libre).
export const MOT_CATEGORIE: Record<CategoryType, string> = {
  fashion: "mode", beauty: "beauté", food: "alimentation", tech: "électronique", home: "maison", jewelry: "bijoux", kids: "enfant",
  health: "santé", sport: "fitness", services: "services", agriculture: "agriculture", artisan: "artisanat", books: "livres", auto: "auto", general: "général",
};

export interface Gabarit {
  id: string; nom: string; source: "design" | "socle"; categories: { id: CategoryType; libelle: string }[];
  ambiance: string[]; couleurs: Record<string, string | undefined>; polices: Record<string, string | undefined>; application: string;
}

export function listerGabarits(): Gabarit[] {
  const cat = (c: CategoryType) => ({ id: c, libelle: LIBELLES_CATEGORIES[c] });
  return [
    ...MANIFESTE_LIBRAIRIE.map((e) => ({
      id: `design:${e.fichier.replace(/\.html$/, "")}`, nom: e.nom, source: "design" as const, categories: e.categories.map(cat), ambiance: e.ambiance,
      couleurs: e.couleurs, polices: e.polices,
      application: "Design AXSO complet (HTML) : appliqué par le marchand (Thèmes / Constructeur). Une IA peut en reprendre la palette et les polices (style_seulement: true).",
    })),
    ...(Object.keys(LIBELLES_CATEGORIES) as CategoryType[]).map((c) => ({
      id: `socle:${c}`, nom: `Socle ${LIBELLES_CATEGORIES[c]}`, source: "socle" as const, categories: [cat(c)], ambiance: [],
      couleurs: {}, polices: {},
      application: "Sections de l'accueil, fiche produit, À propos et Contact calibrés pour la catégorie (textes en français, devise de la boutique). Couleurs, polices et marque gardées. Seulement pour une boutique sans design importé.",
    })),
  ];
}

export const TYPES_GENERABLES = BLOCK_CATALOG.filter((e) => e.categorie === "widget" && !["tabs", "columns"].includes(e.type)).map((e) => e.type as string);

/** Blocs proposés (par un modèle) → sections du Constructeur, champs du catalogue seulement. */
export function arbreDepuisBlocs(blocs: unknown): BlockNode[] {
  if (!Array.isArray(blocs) || !blocs.length || blocs.length > 14) throw new ErreurBuilder("INVALID_INPUT", "proposition.blocs : 1 à 14 blocs.");
  return blocs.map((b: any, i: number) => {
    if (!TYPES_GENERABLES.includes(b?.type)) throw new ErreurBuilder("INVALID_INPUT", `bloc ${i + 1} : type « ${b?.type} » absent du catalogue (${TYPES_GENERABLES.join(", ")}).`);
    const permis = Object.keys(getCatalogEntry(b.type)!.defaultConfig ?? {});
    const config = Object.fromEntries(Object.entries(b.config ?? {}).filter(([k]) => permis.includes(k)).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 600) : Array.isArray(v) ? v.slice(0, 12) : v]));
    const widget = createDefaultNode(b.type, config);
    const colonne = { ...createDefaultNode("column"), children: [widget] };
    const ligne = { ...createDefaultNode("row"), children: [colonne] };
    return { ...createDefaultNode("section"), config: { nom: getCatalogEntry(b.type)!.label, zone: "template" }, children: [ligne] };
  });
}

function depuisGabarit(cfg: ThemeConfig, args: Record<string, any>, donnees: DonneesBoutique): ThemeConfig {
  const c = cfg as any;
  const id = String(args.template_id ?? "");
  if (id === "genere") {
    const p = args.proposition ?? {};
    // Le design importé garde son en-tête et son pied de page seulement s'ils sont déjà des sections.
    const garde = (c.builderTree ?? []).filter((n: any) => zoneDe(n) !== "template");
    if (c.builderHtml && !garde.length) throw new ErreurBuilder("POLICY_BLOCKED", "le design importé n'est pas découpé en sections : remplacer l'accueil effacerait aussi son en-tête et son pied de page. Le marchand ouvre une fois le Constructeur (Importer mon design actuel), puis recommence.");
    const definis = (o: unknown) => (o && typeof o === "object" ? Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")) : {});
    const couleurs = definis(p.couleurs), polices = definis(p.polices);
    const avecStyle = Object.keys(couleurs).length || Object.keys(polices).length ? appliquerReglages(cfg, { couleurs, polices }, donnees) : cfg;
    return { ...avecStyle, builderTree: [...garde.filter((n: any) => zoneDe(n) === "header"), ...arbreDepuisBlocs(p.blocs), ...garde.filter((n: any) => zoneDe(n) === "footer")] };
  }
  const g = listerGabarits().find((x) => x.id === id);
  if (!g) throw new ErreurBuilder("NOT_FOUND", `gabarit « ${id} » introuvable (axso_builder_list_templates).`);
  if (g.source === "design") {
    if (args.style_seulement !== true) throw new ErreurBuilder("POLICY_BLOCKED", `${g.nom} est un design HTML complet : l'appliquer réécrit le design importé (builderHtml), ce qu'aucune IA ne peut faire. Le marchand l'applique depuis Thèmes ; ou reprends seulement sa palette et ses polices avec style_seulement: true.`);
    return appliquerReglages(cfg, { couleurs: Object.fromEntries(Object.entries(g.couleurs).filter(([, v]) => v)), polices: Object.fromEntries(Object.entries(g.polices).filter(([, v]) => v)) }, donnees);
  }
  if (c.builderHtml) throw new ErreurBuilder("POLICY_BLOCKED", "la boutique affiche un design importé : les sections du socle n'y apparaîtraient pas. Gabarit socle indisponible ici.");
  const categorie = g.categories[0].id;
  const { themeConfig } = generateStoreConfig({ categorie: MOT_CATEGORIE[categorie], nomBoutique: donnees.nom, devise: donnees.devise, modeBoutique: c.modeBoutique });
  // Couleurs, polices, marque, pages libres et réglages restent ceux de la boutique.
  return { ...c, sections: themeConfig.sections, sectionOrder: themeConfig.sectionOrder, customSections: themeConfig.customSections, productPage: themeConfig.productPage, aboutPage: themeConfig.aboutPage, contactPage: themeConfig.contactPage };
}

// ─── Marque ────────────────────────────────────────────────────────────────────
const court = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const listeTextes = (v: unknown, max = 20) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, max).map((x) => x.trim().slice(0, 300)) : undefined);
const URL_IMAGE = /^https:\/\/[^\s"'<>]+$/i;

/** Normalise une mise à jour de marque ; lève INVALID_INPUT sur toute valeur douteuse. */
export function majMarque(actuelle: Record<string, any> | undefined, args: Record<string, any>): Partial<Marque> {
  const m: Record<string, any> = { ...(actuelle ?? {}) };
  const refus: string[] = [];
  if (args.nom !== undefined) m.nom = court(args.nom, 80);
  if (args.logo !== undefined) {
    const principal = args.logo?.principal, variantes = args.logo?.variantes ?? m.logo?.variantes ?? [];
    if (principal !== undefined && principal !== null && !(typeof principal === "string" && URL_IMAGE.test(principal))) refus.push("logo.principal (URL https)");
    if (!Array.isArray(variantes) || variantes.length > 10 || variantes.some((u: unknown) => typeof u !== "string" || !URL_IMAGE.test(u))) refus.push("logo.variantes (URL https, 10 max)");
    m.logo = { principal: principal === undefined ? m.logo?.principal ?? null : principal, variantes };
  }
  if (args.couleurs !== undefined) {
    const ok = (l: unknown) => Array.isArray(l) && l.length <= 12 && l.every((x) => typeof x === "string" && HEX.test(x));
    if (args.couleurs.principales !== undefined && !ok(args.couleurs.principales)) refus.push("couleurs.principales (#RRGGBB, 12 max)");
    if (args.couleurs.secondaires !== undefined && !ok(args.couleurs.secondaires)) refus.push("couleurs.secondaires (#RRGGBB, 12 max)");
    m.couleurs = { ...m.couleurs, ...args.couleurs };
  }
  if (args.polices !== undefined) {
    if (!Array.isArray(args.polices) || args.polices.length > 6 || args.polices.some((p: unknown) => !IDS_POLICES.includes(p as string))) refus.push(`polices (ids de la liste : ${IDS_POLICES.join(", ")})`);
    m.polices = args.polices;
  }
  for (const k of ["ton", "stylePhoto", "styleVisuel", "styleIcones"]) if (args[k] !== undefined) m[k] = court(args[k]);
  for (const k of ["regles", "interdits"]) if (args[k] !== undefined) m[k] = listeTextes(args[k]);
  if (args.verrous !== undefined) {
    if (!Array.isArray(args.verrous) || args.verrous.some((v: unknown) => !(VERROUS as readonly string[]).includes(v as string))) refus.push(`verrous (${VERROUS.join(", ")})`);
    m.verrous = args.verrous;
  }
  if (refus.length) throw new ErreurBuilder("INVALID_INPUT", `marque : valeurs refusées — ${refus.join(", ")}.`);
  return m;
}

/** Ce que la mise à jour lève ou touche de verrouillé (rend la décision au marchand, quel que soit le mode). */
export function changementsSensiblesMarque(actuelle: Partial<Marque> | undefined, args: Record<string, any>): string[] {
  const verrous = actuelle?.verrous ?? [];
  const out: string[] = [];
  if (args.verrous !== undefined) for (const v of verrous) if (!args.verrous.includes(v)) out.push(`lève le verrou « ${v} »`);
  if (verrous.includes("logo") && args.logo?.principal !== undefined && args.logo.principal !== actuelle?.logo?.principal) out.push("change le logo principal verrouillé");
  if (verrous.includes("couleurs") && args.couleurs !== undefined) out.push("change la palette verrouillée");
  if (verrous.includes("polices") && args.polices !== undefined) out.push("change les typographies verrouillées");
  if (verrous.includes("ton") && args.ton !== undefined) out.push("change le ton verrouillé");
  return out;
}

// ─── Opérations ────────────────────────────────────────────────────────────────
const P_COULEURS = Object.fromEntries(COULEURS.map((k) => [k, { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }]));
const P_POLICES = {
  titre: { type: "string", enum: IDS_POLICES }, corps: { type: "string", enum: IDS_POLICES },
  poidsTitre: { type: "string", enum: ["400", "500", "600", "700", "800", "900"] }, tailleBase: { type: "string", description: "13px à 18px" },
  lettreEspacement: { type: "string", description: "ex. 0.02em" }, hauteurLigne: { type: "string", description: "ex. 1.5" }, transformTitre: { type: "string", enum: ["none", "uppercase", "capitalize"] },
};
const P_ARRONDI = { type: "string", enum: ["0px", "4px", "8px", "12px", "16px", "24px", "9999px"] };
const P_BOUTONS = { style: { type: "string", enum: ["filled", "outlined", "ghost", "pill", "square"] }, taille: { type: "string", enum: ["sm", "md", "lg", "xl"] }, hover: { type: "string", enum: ["lighten", "darken", "scale", "glow", "slide"] }, bordureWidth: { type: "string", enum: ["0px", "1px", "2px", "3px", "4px"] } };
const P_MISE_EN_PAGE = {
  largeurContainer: { type: "string", enum: ["1024px", "1280px", "1440px", "1600px", "100%"] }, paddingSection: { type: "string", enum: ["sm", "md", "lg", "xl"] },
  colonnesProduits: { type: "integer", minimum: 2, maximum: 5 }, colonnesMobile: { type: "integer", minimum: 1, maximum: 2 },
  styleCarte: { type: "string", enum: ["shadow", "bordered", "flat", "lifted"] }, ombre: { type: "string", enum: ["none", "sm", "md", "lg", "xl"] },
};
const choisir = (args: Record<string, any>, cles: string[]) => Object.fromEntries(Object.entries(args).filter(([k]) => cles.includes(k)));

export const OPERATIONS: OperationBuilder[] = [
  {
    nom: "axso_builder_update_theme", capacite: "builder_design", risque: "moyen",
    description: "Change plusieurs réglages GLOBAUX du thème d'un coup dans le brouillon (couleurs, polices, arrondi, mise en page, boutons, navigation, animations). Tout ou rien : une valeur hors liste refuse l'ensemble. Respecte la marque.",
    parameters: objet({
      couleurs: objet(P_COULEURS), polices: objet(P_POLICES), arrondi: P_ARRONDI, miseEnPage: objet(P_MISE_EN_PAGE), boutons: objet(P_BOUTONS),
      navigation: { type: "object", description: "type (classic|centered|floating|minimal|mega|transparent-scroll), style (light|dark|glass|transparent), hauteur (48px|64px|80px), sticky, showSearch, showWishlist" },
      animations: { type: "object", description: "preset (luxury|dynamic|elegant|playful|none) ou global, vitesse (fast|normal|slow), stagger, parallax, smoothScroll" },
    }),
    appliquer: (cfg, args, d) => appliquerReglages(cfg, args, d),
  },
  {
    nom: "axso_builder_update_colors", capacite: "builder_design", risque: "moyen",
    description: "Change les couleurs globales (toute la boutique, designs importés compris) dans le brouillon : accent (boutons, prix, liens), accentSecondaire, fond, texte, surface (cartes), texteMuted, bordure. #RRGGBB. Refusé si hors de la palette de la marque.",
    parameters: objet(P_COULEURS),
    appliquer: (cfg, args, d) => appliquerReglages(cfg, { couleurs: args }, d),
  },
  {
    nom: "axso_builder_update_typography", capacite: "builder_design", risque: "moyen",
    description: "Change la typographie globale dans le brouillon : polices des titres et du texte (catalogue Axso uniquement), graisse des titres, taille de base, interlettrage, interligne, casse des titres. Refusé si la police n'est pas autorisée par la marque.",
    parameters: objet(P_POLICES),
    appliquer: (cfg, args, d) => appliquerReglages(cfg, { polices: args }, d),
  },
  {
    nom: "axso_builder_update_spacing", capacite: "builder_design",
    description: "Change les espacements globaux dans le brouillon : marge verticale des sections (paddingSection) et largeur du conteneur. Pour un bloc précis, utilise son style (spacing).",
    parameters: objet(choisir(P_MISE_EN_PAGE, ["largeurContainer", "paddingSection"])),
    appliquer: (cfg, args, d) => appliquerReglages(cfg, { miseEnPage: choisir(args, ["largeurContainer", "paddingSection"]) }, d),
  },
  {
    nom: "axso_builder_update_radius", capacite: "builder_design",
    description: "Change l'arrondi global (boutons, cartes, champs) dans le brouillon.",
    parameters: objet({ arrondi: P_ARRONDI }, ["arrondi"]),
    appliquer: (cfg, args, d) => appliquerReglages(cfg, { arrondi: args.arrondi }, d),
  },
  {
    nom: "axso_builder_update_shadows", capacite: "builder_design",
    description: "Change les ombres et le style des cartes produits dans le brouillon (ombre : none→xl ; carte : shadow, bordered, flat, lifted).",
    parameters: objet(choisir(P_MISE_EN_PAGE, ["ombre", "styleCarte"])),
    appliquer: (cfg, args, d) => appliquerReglages(cfg, { miseEnPage: choisir(args, ["ombre", "styleCarte"]) }, d),
  },
  {
    nom: "axso_builder_update_buttons", capacite: "builder_design",
    description: "Change le style global des boutons dans le brouillon (forme, taille, effet au survol, épaisseur de bordure) ; s'applique aussi aux designs importés.",
    parameters: objet(P_BOUTONS),
    appliquer: (cfg, args, d) => appliquerReglages(cfg, { boutons: args }, d),
  },
  {
    nom: "axso_builder_update_tokens", capacite: "builder_design", risque: "moyen",
    description: "Change des DESIGN TOKENS par leur nom (color.primary, font.heading, radius.base, spacing.section, button.style…) dans le brouillon. Un token sans champ réel est refusé avec la raison : liste dans axso_builder_get_design_system.",
    parameters: objet({ tokens: { type: "object", description: "{ \"color.primary\": \"#B5522E\", \"font.heading\": \"fraunces\" }", additionalProperties: true } }, ["tokens"]),
    appliquer: (cfg, args, d) => appliquerReglages(cfg, reglagesDepuisTokens(args.tokens), d),
  },
  {
    nom: "axso_builder_update_brand", capacite: "builder_marque", risque: "moyen",
    description: "Fixe ou fait évoluer la MARQUE (brouillon) : nom, logo et variantes, palette approuvée (principales, secondaires), polices autorisées, ton de voix, styles photo / visuel / icônes, règles, modifications interdites, verrous (logo, couleurs, polices, ton). Une fois fixée, la marque bloque les changements de thème contraires. C'est le marchand qui décide de sa marque.",
    parameters: objet({
      nom: { type: "string" },
      logo: objet({ principal: { type: "string", description: "URL https" }, variantes: { type: "array", items: { type: "string" } } }),
      couleurs: objet({ principales: { type: "array", items: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } }, secondaires: { type: "array", items: { type: "string" } } }),
      polices: { type: "array", items: { type: "string", enum: IDS_POLICES } },
      ton: { type: "string", description: "ex. « chaleureux, vouvoiement, sans superlatifs »" }, stylePhoto: { type: "string" }, styleVisuel: { type: "string" }, styleIcones: { type: "string" },
      regles: { type: "array", items: { type: "string" } }, interdits: { type: "array", items: { type: "string" } },
      verrous: { type: "array", items: { type: "string", enum: [...VERROUS] } },
    }),
    appliquer: (cfg, args) => ({ ...cfg, marque: majMarque((cfg as any).marque, args) } as ThemeConfig),
  },
  {
    nom: "axso_builder_create_from_template", capacite: "builder_design", risque: "moyen",
    description: "Applique un gabarit au brouillon (remplace le design de l'accueil et des pages annexes ; marque, couleurs et polices gardées pour un gabarit « socle »). Gabarits : axso_builder_list_templates.",
    parameters: objet({
      template_id: { type: "string", description: "« socle:<catégorie> », « design:<nom> » (avec style_seulement) ; « genere » est réservé à axso_builder_generate_template" },
      style_seulement: { type: "boolean", description: "Design AXSO : n'en reprendre que la palette et les polices" },
      proposition: { type: "object", description: "Réservé à axso_builder_generate_template : { couleurs, polices, blocs: [{ type, config }] }" },
    }, ["template_id"]),
    appliquer: depuisGabarit,
  },
];

