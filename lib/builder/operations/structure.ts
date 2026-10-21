// Opérations pures du Builder — pages libres, sections, composants, contenu, liaisons
// produits, fiche produit. Chacune reçoit une copie de la config (brouillon) et la rend
// modifiée, ou lève ErreurBuilder : le moteur n'enregistre alors rien.
// Arbre : lib/block-tree.ts ; types de blocs : lib/block-catalog.ts ; sections de design
// importé (embed-html) : lib/design-accueil.ts — leur HTML ne s'écrit qu'élément par élément.
import { THEME_DEFAULTS, type BlockNode, type BlockNodeType, type ThemeConfig } from "@/lib/theme-config";
import { findNode, genBlockId, insertNode, moveNode, removeNode, duplicateNode, updateNodeStyle, updateNodeResponsiveStyle, zoneDe, ZONES, type Zone } from "@/lib/block-tree";
import { BLOCK_CATALOG, createDefaultNode, getCatalogEntry } from "@/lib/block-catalog";
import { appliquerActionDesign, decrireAccueil, type ActionDesign } from "@/lib/design-accueil";
import { appliquerActionFiche, SECTIONS_FICHE, type ActionFiche } from "@/lib/fiche-produit";
import { slugify } from "@/lib/utils";
import { REGLES, TRIS } from "../liaisons";
import { DANGEREUX } from "../validation";
import { ErreurBuilder, type DonneesBoutique, type OperationBuilder } from "../types";

// ─── Erreurs et bornes ────────────────────────────────────────────────────────
const invalide = (m: string): never => { throw new ErreurBuilder("INVALID_INPUT", m); };
const introuvable = (m: string): never => { throw new ErreurBuilder("NOT_FOUND", m); };
const borne = (v: unknown, min: number, max: number, defaut: number) => {
  const n = Math.round(Number(v));
  return v == null || !Number.isFinite(n) ? defaut : Math.min(max, Math.max(min, n));
};
const sur = (v: unknown, quoi: string) => { if (DANGEREUX.test(JSON.stringify(v ?? ""))) invalide(`${quoi} : code non autorisé (script, gestionnaire d'événement ou lien javascript).`); return v; };

// ─── Pages libres : themeConfig.pagesPerso[slug] ──────────────────────────────
export interface PagePerso {
  nom: string; slug: string; gabarit?: string;
  seo?: { titre?: string; description?: string; image?: string; noindex?: boolean };
  builderTree: BlockNode[];
  /** Page importée seule (fichier HTML) : son CSS, confiné à ses sections (lib/scope-css.ts::cssPageImportee). */
  css?: string;
  /** lien : accessible par son adresse mais pas indexée (noindex). */
  visibilite: "publique" | "lien";
  statut: "brouillon" | "publiee";
  ordre: number;
}

/** Pages fixes de la vitrine (non supprimables) et l'outil qui les modifie. */
export const PAGES_FIXES = [
  { cle: "accueil", nom: "Accueil", chemin: "", outil: "outils de sections/composants (page vide ou « accueil »)" },
  { cle: "produits", nom: "Catalogue", chemin: "produits", outil: "design importé (non modifiable par une IA) ou layout du thème" },
  { cle: "fiche-produit", nom: "Fiche produit", chemin: "produits/<id>", outil: "axso_builder_update_product_page" },
  { cle: "a-propos", nom: "À propos", chemin: "a-propos", outil: "modifier_page (AXIA)" },
  { cle: "contact", nom: "Contact", chemin: "contact", outil: "modifier_page (AXIA)" },
];

export const pagesDe = (cfg: ThemeConfig): Record<string, PagePerso> => (cfg as any).pagesPerso ?? {};

/** `page` : vide / « accueil » = accueil (null) ; « p/<slug> » ou « <slug> » = page libre (slug). */
export function cleDePage(cfg: ThemeConfig, page: unknown): string | null {
  const p = String(page ?? "").trim().replace(/^\/+|\/+$/g, "").replace(/^p\//, "");
  if (!p || p === "accueil") return null;
  if (pagesDe(cfg)[p]) return p;
  if (PAGES_FIXES.some((f) => f.cle === p)) invalide(`« ${p} » est une page fixe sans sections libres : passe par ${PAGES_FIXES.find((f) => f.cle === p)!.outil}.`);
  return introuvable(`Page « ${p} » introuvable. Pages libres : ${Object.keys(pagesDe(cfg)).join(", ") || "aucune"} (axso_builder_list_pages).`);
}

export function arbreDePage(cfg: ThemeConfig, page: unknown): { cle: string | null; tree: BlockNode[] } {
  const cle = cleDePage(cfg, page);
  const tree = cle ? pagesDe(cfg)[cle].builderTree ?? [] : cfg.builderTree ?? [];
  // Design jamais découpé en sections (Constructeur jamais ouvert) : y ajouter un bloc ferait disparaître le design.
  if (!cle && !tree.length && cfg.builderHtml) throw new ErreurBuilder("CONFLICT", "L'accueil est un design importé pas encore découpé en sections : ouvre-le une fois dans le Constructeur (ou utilise modifier_design_accueil), puis recommence.");
  return { cle, tree };
}

function surArbre(cfg: ThemeConfig, page: unknown, f: (tree: BlockNode[]) => BlockNode[]): ThemeConfig {
  const { cle, tree } = arbreDePage(cfg, page);
  const neuf = f(tree);
  if (cle) { pagesDe(cfg)[cle].builderTree = neuf; return cfg; }
  return { ...cfg, builderTree: neuf };
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function slugLibre(cfg: ThemeConfig, voulu: string): string {
  const base = slugify(voulu).slice(0, 50) || "page";
  if (!SLUG.test(base) || base === "accueil") invalide(`Adresse de page invalide : « ${voulu} ».`);
  let s = base;
  for (let i = 2; pagesDe(cfg)[s]; i++) s = `${base}-${i}`;
  return s;
}

function seoValide(seo: any): PagePerso["seo"] {
  if (seo == null) return undefined;
  if (typeof seo !== "object") return invalide("`seo` : { titre, description, image }.");
  const r: Record<string, string> = {};
  for (const [k, max] of [["titre", 120], ["description", 320], ["image", 1000]] as const) {
    if (seo[k] == null) continue;
    if (typeof seo[k] !== "string" || seo[k].length > max) invalide(`seo.${k} : texte de ${max} caractères au plus.`);
    if (k === "image" && seo[k] && !/^(https:\/\/|\/)/.test(seo[k])) invalide("seo.image : URL https:// attendue.");
    r[k] = seo[k];
  }
  sur(r, "seo");
  return r;
}

const ENUM = <T extends string>(v: unknown, valeurs: readonly T[], quoi: string): T | undefined =>
  v == null ? undefined : (valeurs as readonly unknown[]).includes(v) ? (v as T) : invalide(`${quoi} : ${valeurs.join(" | ")}.`);

const nouveauxIds = (n: BlockNode): BlockNode => ({ ...JSON.parse(JSON.stringify(n)), id: genBlockId(n.type), children: n.children?.map(nouveauxIds) });

// ─── Arbre : sections, emplacements ───────────────────────────────────────────
const STRUCTURE = new Set(["section", "row", "column"]);
const WIDGETS = BLOCK_CATALOG.filter((e) => e.categorie === "widget").map((e) => e.type);
const embedDe = (s: BlockNode) => s.children?.[0]?.children?.[0]?.children?.[0];
export const estDesign = (s: BlockNode) => embedDe(s)?.type === "embed-html";

function noeud(tree: BlockNode[], id: unknown, quoi: string): BlockNode {
  const n = typeof id === "string" && id ? findNode(tree, id) : null;
  return n ?? introuvable(`${quoi} « ${String(id ?? "")} » introuvable sur cette page (relis-la avec axso_builder_list_sections).`);
}
function section(tree: BlockNode[], id: unknown): BlockNode {
  const n = noeud(tree, id, "Section");
  return tree.includes(n) ? n : invalide(`« ${String(id)} » n'est pas une section (racine de la page) mais un ${n.type}.`);
}
function composant(tree: BlockNode[], id: unknown): BlockNode {
  const n = noeud(tree, id, "Composant");
  if (STRUCTURE.has(n.type)) invalide(`« ${String(id)} » est un conteneur (${n.type}), pas un composant.`);
  if (n.type === "embed-html") invalide("Ce bloc est un design importé : modifie ses éléments avec axso_builder_update_design_element.");
  return n;
}

/** Parent (null = racine) et rang d'un nœud. */
export function emplacement(tree: BlockNode[], id: string, parent: BlockNode | null = null): { parent: BlockNode | null; index: number } | null {
  const i = tree.findIndex((n) => n.id === id);
  if (i >= 0) return { parent, index: i };
  for (const n of tree) { const r = n.children && emplacement(n.children, id, n); if (r) return r; }
  return null;
}

/** Place une section dans sa zone, au rang `position` (défaut : à la fin de la zone). */
function placer(tree: BlockNode[], s: BlockNode, position?: unknown): BlockNode[] {
  const zone = zoneDe(s);
  const meme = tree.filter((n) => zoneDe(n) === zone);
  const pos = borne(position, 0, meme.length, meme.length);
  const idx = pos < meme.length ? tree.indexOf(meme[pos]) : meme.length ? tree.indexOf(meme[meme.length - 1]) + 1 : zone === "header" ? 0 : tree.length;
  return [...tree.slice(0, idx), s, ...tree.slice(idx)];
}

function nouvelleSection(composants: BlockNode[], colonnes = 1, config: Record<string, any> = {}): BlockNode {
  const cols: BlockNode[] = Array.from({ length: Math.max(1, Math.min(4, colonnes)) }, () => ({ id: genBlockId("col"), type: "column", children: [] }));
  composants.forEach((c, i) => cols[Math.min(i, cols.length - 1)].children!.push(c));
  return { id: genBlockId("section"), type: "section", config, children: [{ id: genBlockId("row"), type: "row", children: cols }] };
}

// ─── Validateur de config d'un bloc, dérivé du catalogue ──────────────────────
// Clés et types : defaultConfig + champs (`cle: "a"|"b"`, `cle: 2|3|4`, `cle: number (1-24)`).
type Champ = { type: "string" | "number" | "boolean" | "array" | "object"; valeurs?: (string | number)[]; min?: number; max?: number };
const SCHEMAS = new Map<string, Record<string, Champ>>();

export function schemaDe(type: string): Record<string, Champ> {
  const e = getCatalogEntry(type as BlockNodeType);
  if (!e || e.categorie !== "widget") return invalide(`Type de composant inconnu « ${type} ». Types : ${WIDGETS.join(", ")}.`);
  if (SCHEMAS.has(type)) return SCHEMAS.get(type)!;
  const s: Record<string, Champ> = {};
  for (const [k, v] of Object.entries(e.defaultConfig ?? {})) s[k] = { type: Array.isArray(v) ? "array" : (typeof v as Champ["type"]) };
  // Les champs des éléments de liste ([{ … }]) ne sont pas des clés de premier niveau.
  for (const m of e.champs.replace(/\[[^\]]*\]/g, "[]").matchAll(/(\w+)\??:\s*([^,}(]*)(?:\((\d+)-(\d+)\))?/g)) {
    const [, k, brut, min, max] = m;
    const seg = brut.trim();
    const c: Champ = s[k] ?? { type: /^\d|^number/.test(seg) ? "number" : seg === "boolean" ? "boolean" : /\[\]$|^\[/.test(seg) ? "array" : "string" };
    if (/^"[^"]*"(\s*\|\s*"[^"]*")+$/.test(seg)) c.valeurs = seg.split("|").map((x) => x.trim().slice(1, -1));
    else if (/^\d+(\s*\|\s*\d+)+$/.test(seg)) c.valeurs = seg.split("|").map(Number);
    if (min) { c.min = Number(min); c.max = Number(max); }
    s[k] = c;
  }
  SCHEMAS.set(type, s);
  return s;
}

const scalaire = (v: unknown) => v == null || ["string", "number", "boolean"].includes(typeof v);

/** Valide (et normalise) un patch de config pour un type de composant ; lève INVALID_INPUT. */
export function validerConfigBloc(type: string, patch: unknown): Record<string, any> {
  const schema = schemaDe(type);
  if (patch == null) return {};
  if (typeof patch !== "object" || Array.isArray(patch)) return invalide("`config` doit être un objet.");
  const r: Record<string, any> = {};
  for (const [k, v] of Object.entries(patch)) {
    const c = schema[k];
    const non = (attendu: string): never => invalide(`${type}.${k} : ${attendu} attendu.`);
    if (!c) invalide(`${type} : champ inconnu « ${k} ». Champs : ${Object.keys(schema).join(", ")}.`);
    if (c.type === "number") {
      const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
      if (!Number.isFinite(n)) non("un nombre");
      if (c.valeurs && !c.valeurs.includes(n)) non(c.valeurs.join(" | "));
      if (c.min != null && (n < c.min || n > c.max!)) non(`un nombre entre ${c.min} et ${c.max}`);
      r[k] = n;
    } else if (c.type === "string") {
      if (typeof v !== "string" || v.length > 5000) non("un texte (5000 caractères max)");
      if (c.valeurs && !c.valeurs.includes(v as string)) non(c.valeurs.join(" | "));
      r[k] = v;
    } else if (c.type === "boolean") {
      if (typeof v !== "boolean") non("true ou false");
      r[k] = v;
    } else {
      // Listes : textes (URLs, certifications) ou objets plats (items, onglets — leurs `blocs` restent vides).
      if (!Array.isArray(v) || v.length > 50) non("une liste (50 éléments max)");
      for (const x of v as unknown[]) {
        const ok = typeof x === "string" ? x.length <= 2000 : !!x && typeof x === "object" && !Array.isArray(x) &&
          Object.values(x).every((y) => (scalaire(y) && String(y ?? "").length <= 5000) || (Array.isArray(y) && y.length === 0));
        if (!ok) non("une liste de textes ou d'objets simples (sans blocs imbriqués)");
      }
      r[k] = v;
    }
  }
  return sur(r, `config ${type}`) as Record<string, any>;
}

/** Cohérence d'une liaison produits une fois la config fusionnée. */
export function verifierLiaison(c: Record<string, any>, donnees: DonneesBoutique) {
  if (c.regle === "collection" && !donnees.collections.some((x) => x.slug === c.collection)) {
    invalide(`Collection « ${c.collection ?? ""} » inconnue. Collections actives : ${donnees.collections.map((x) => x.slug).join(", ") || "aucune"}.`);
  }
  if (c.regle === "categorie" && !String(c.categorie ?? "").trim()) invalide("La règle « categorie » demande `categorie`.");
  if (c.regle === "recherche" && !String(c.motCle ?? "").trim()) invalide("La règle « recherche » demande `mot_cle`.");
}

function configurer(tree: BlockNode[], id: unknown, patch: unknown, donnees: DonneesBoutique): BlockNode[] {
  const n = composant(tree, id);
  const config = { ...n.config, ...validerConfigBloc(n.type, patch) };
  if (n.type === "products") verifierLiaison(config, donnees);
  const arbre = JSON.parse(JSON.stringify(tree)) as BlockNode[];
  findNode(arbre, n.id)!.config = config;
  return arbre;
}

// ─── Styles (BlockStyleOverrides) ─────────────────────────────────────────────
const STYLE_CHAMPS: Record<string, string[] | null> = {
  spacing: ["pt", "pb", "pl", "pr", "mt", "mb", "ml", "mr"], background: ["color", "image", "gradient"],
  typography: ["color", "taille", "poids", "align", "police", "interligne", "espacement"], hover: ["color", "background"],
  border: ["radius", "width", "color"], visibility: ["desktop", "tablet", "mobile"], width: null,
};
// Valeur CSS : jamais de quoi sortir de la déclaration (le style responsive est écrit dans une balise <style>).
const VALEUR_CSS = /^[^;{}<>"`\\]{0,300}$/;

export function validerStyle(style: unknown, responsive = false): Record<string, any> {
  if (!style || typeof style !== "object" || Array.isArray(style)) return invalide("`style` doit être un objet (spacing, background, typography, hover, border, visibility, width).");
  const r: Record<string, any> = {};
  for (const [g, v] of Object.entries(style)) {
    const sous = STYLE_CHAMPS[g];
    if (sous === undefined || (responsive && g === "visibility")) invalide(`style : groupe inconnu « ${g} ». Groupes : ${Object.keys(STYLE_CHAMPS).filter((k) => !responsive || k !== "visibility").join(", ")}.`);
    if (sous === null) { if (typeof v !== "string" || !VALEUR_CSS.test(v)) invalide(`style.${g} : valeur CSS simple attendue.`); r[g] = v; continue; }
    if (!v || typeof v !== "object") invalide(`style.${g} : objet attendu (${sous.join(", ")}).`);
    for (const [k, x] of Object.entries(v as object)) {
      if (!sous.includes(k)) invalide(`style.${g}.${k} inconnu (${sous.join(", ")}).`);
      if (g === "visibility" ? typeof x !== "boolean" : typeof x !== "string" || !VALEUR_CSS.test(x)) invalide(`style.${g}.${k} : ${g === "visibility" ? "true/false" : "valeur CSS simple"} attendue.`);
      if (g === "background" && k === "image" && x && !/^(https:\/\/|\/)/.test(x as string)) invalide("style.background.image : URL https:// attendue.");
    }
    r[g] = v;
  }
  return sur(r, "style") as Record<string, any>;
}

// ─── Contenu du socle (themeConfig.sections) ──────────────────────────────────
// Mêmes champs « texte » que CHAMPS_COPY_PAR_SECTION (lib/theme-config.ts), sans les médias.
const SOCLE: Record<string, string[]> = {
  annonce: ["texte"], hero: ["titre", "sousTitre", "ctaTexte", "ctaLien", "badgeTexte", "secondCtaTexte", "secondCtaLien"],
  vedettes: ["titre"], collections: ["titre"], promo: ["titre", "texte", "ctaTexte"], avis: ["titre"],
  newsletter: ["titre", "texte", "placeholder", "ctaTexte"], confiance: ["items"], about: ["titre", "texte", "badgeTexte", "stats"], faq: ["titre", "items"],
};
const ELEMENTS_SOCLE: Record<string, string[]> = { "confiance.items": ["icone", "titre", "texte"], "about.stats": ["valeur", "label"], "faq.items": ["question", "reponse"] };

function contenuSocle(cfg: ThemeConfig, cle: string, champs: Record<string, any>): ThemeConfig {
  const permis = SOCLE[cle] ?? invalide(`Section du socle inconnue « ${cle} » (${Object.keys(SOCLE).join(", ")}).`);
  for (const [k, v] of Object.entries(champs)) {
    if (!permis.includes(k)) invalide(`socle.${cle} : champ de texte inconnu « ${k} » (${permis.join(", ")}).`);
    const el = ELEMENTS_SOCLE[`${cle}.${k}`];
    const ok = el ? Array.isArray(v) && v.length <= 20 && v.every((x) => x && typeof x === "object" && Object.entries(x).every(([a, b]) => el.includes(a) && typeof b === "string" && b.length <= 2000))
      : typeof v === "string" && v.length <= 2000;
    if (!ok) invalide(`socle.${cle}.${k} : ${el ? `liste d'objets { ${el.join(", ")} } (textes)` : "texte (2000 caractères max)"} attendu.`);
  }
  sur(champs, `socle.${cle}`);
  // confiance/about/faq sont remplacées en entier à la résolution : on part de l'existant ou du défaut.
  const base = (cfg.sections as any)?.[cle] ?? (["confiance", "about", "faq"].includes(cle) ? (THEME_DEFAULTS["terre-et-or"].sections as any)[cle] : {});
  return { ...cfg, sections: { ...(cfg.sections ?? {}), [cle]: { ...base, ...champs } } as any };
}

// ─── Liaisons produits ────────────────────────────────────────────────────────
const LIAISON_PROPS = {
  regle: { type: "string", enum: REGLES, description: "meilleures_ventes | nouveautes | mis_en_avant | collection | categorie | forte_marge (prix - coût) | stock_bas | dormants (peu de ventes sur `jours`) | marge_peu_vendus | recherche" },
  collection: { type: "string", description: "Slug de collection (règle collection)" },
  categorie: { type: "string", description: "Catégorie (règle categorie)" },
  mot_cle: { type: "string", description: "Mot-clé (règle recherche)" },
  jours: { type: "integer", minimum: 7, maximum: 365, description: "Période des ventes (dormants, marge_peu_vendus), défaut 30" },
  seuil_stock: { type: "integer", minimum: 1, maximum: 100, description: "Stock bas : au plus N pièces (défaut 5)" },
  nombre: { type: "integer", minimum: 1, maximum: 24 },
  colonnes: { type: "integer", enum: [2, 3, 4], description: "Colonnes sur ordinateur" },
  colonnes_tablette: { type: "integer", enum: [2, 3, 4] },
  colonnes_mobile: { type: "integer", enum: [1, 2] },
  tri: { type: "string", enum: TRIS, description: "Ordre pour collection/categorie/recherche/mis_en_avant (sans règle : ancien comportement)" },
  titre: { type: "string" },
};
const CLES_LIAISON: Record<string, string> = { regle: "regle", collection: "collection", categorie: "categorie", mot_cle: "motCle", jours: "jours", seuil_stock: "seuilStock", nombre: "nombre", colonnes: "colonnes", colonnes_tablette: "colonnesTablette", colonnes_mobile: "colonnesMobile", tri: "tri", titre: "titre" };
const configLiaison = (args: Record<string, any>) => Object.fromEntries(Object.entries(CLES_LIAISON).filter(([a]) => args[a] !== undefined).map(([a, c]) => [c, args[a]]));

// ─── Plans de page (création par objectif ou par intention) ───────────────────
export interface OptionsPlan { nom: string; titre?: string; sousTitre?: string; collection?: { slug: string; nom: string }; whatsapp?: string; dateFin?: string }
const w = (type: BlockNodeType, config: Record<string, any>) => createDefaultNode(type, config);
const sec = (nom: string, ...c: BlockNode[]) => nouvelleSection(c, 1, { nom, zone: "template" });

/** CTA : WhatsApp quand la boutique a un numéro (habitude d'achat locale), sinon le catalogue. */
function cta(o: OptionsPlan, d: DonneesBoutique, message: string) {
  const wa = (o.whatsapp ?? "").replace(/\D/g, "");
  return wa.length >= 8 ? { texte: "Commander sur WhatsApp", lien: `https://wa.me/${wa}?text=${encodeURIComponent(`Bonjour ${d.nom}, ${message}`)}` } : { texte: "Voir les produits", lien: "produits" };
}
const entete = (titre: string, sousTitre: string, bouton: { texte: string; lien: string }) => sec("En-tête de page",
  w("heading", { texte: titre, niveau: "h1", align: "center" }), w("text", { texte: sousTitre, style: "sous-titre", align: "center" }),
  w("button", { texte: bouton.texte, lien: bouton.lien, style: "primary", taille: "lg", align: "center" }));
const grille = (o: OptionsPlan, titre: string, regle: string, nombre = 8) => sec("Produits", w("products", {
  titre, nombre, colonnes: 4, ...(o.collection ? { regle: "collection", collection: o.collection.slug } : { regle }),
}));
const bande = (titre: string, texte: string, b: { texte: string; lien: string }) => sec("Appel à l'action", w("cta-band", { titre, texte, ctaTexte: b.texte, ctaLien: b.lien, style: "gradient" }));
const enJours = (j: number) => new Date(Date.now() + j * 86_400_000).toISOString().slice(0, 16);

// Aucun chiffre, avis ou label inventé : seulement des textes génériques à relire et les vrais produits.
export const PLANS: Record<string, { label: string; construire: (o: OptionsPlan, d: DonneesBoutique) => BlockNode[] }> = {
  vide: { label: "Page vide (titre seul)", construire: (o) => [sec("Titre", w("heading", { texte: o.titre ?? o.nom, niveau: "h1", align: "center" }))] },
  presentation: {
    label: "Présentation (en-tête, produits, texte)",
    construire: (o, d) => [entete(o.titre ?? o.nom, o.sousTitre ?? `Découvrez la sélection ${d.nom}.`, { texte: "Découvrir", lien: "produits" }),
      grille(o, "La sélection", "meilleures_ventes"), sec("Texte", w("richtext", { titre: `À propos de ${o.titre ?? o.nom}`, texte: `Prix affichés en ${d.devise}. Une question ? Contactez-nous.` }))],
  },
  collection: {
    label: "Page de collection (en-tête, grille de la collection, texte SEO)",
    construire: (o, d) => {
      const nom = o.collection?.nom ?? o.titre ?? o.nom;
      return [entete(o.titre ?? nom, o.sousTitre ?? `Toute la collection ${nom}, prix en ${d.devise}.`, cta(o, d, `je souhaite des informations sur la collection ${nom}.`)),
        grille(o, nom, "nouveautes", 12),
        sec("Texte SEO", w("richtext", { titre: `La collection ${nom}`, texte: `Découvrez la collection ${nom} de ${d.nom} : une sélection pensée pour vous, prix affichés en ${d.devise}.` }))];
    },
  },
  campagne: {
    label: "Campagne saisonnière (en-tête, produits, avantages, CTA)",
    construire: (o, d) => [entete(o.titre ?? o.nom, o.sousTitre ?? `Notre sélection spéciale ${o.titre ?? o.nom}.`, { texte: "Voir la sélection", lien: "produits" }),
      grille(o, "La sélection", "mis_en_avant"),
      sec("Avantages", w("features", { titre: "Pourquoi commander chez nous", colonnes: 3, items: [{ icone: "✓", titre: "Sélection soignée", texte: "Des produits choisis pour l'occasion." }, { icone: "→", titre: "Commande simple", texte: "Commandez en quelques clics." }, { icone: "★", titre: `Prix en ${d.devise}`, texte: "Pas de surprise au moment de payer." }] })),
      bande(`${o.titre ?? o.nom}`, "Faites-vous plaisir et faites plaisir.", cta(o, d, `je suis intéressé(e) par votre offre ${o.titre ?? o.nom}.`))],
  },
  lancement: {
    label: "Lancement produit (en-tête, bénéfices, nouveautés, CTA)",
    construire: (o, d) => [entete(o.titre ?? o.nom, o.sousTitre ?? "Découvrez notre nouveauté.", { texte: "Découvrir", lien: "produits" }),
      sec("Bénéfices", w("features", { titre: "Ce qui change", colonnes: 3, items: [{ icone: "★", titre: "Bénéfice 1", texte: "À compléter." }, { icone: "✓", titre: "Bénéfice 2", texte: "À compléter." }, { icone: "→", titre: "Bénéfice 3", texte: "À compléter." }] })),
      grille(o, "Nouveautés", "nouveautes", 4),
      bande("Disponible maintenant", `Prix en ${d.devise}.`, cta(o, d, "je souhaite commander la nouveauté."))],
  },
  promotion: {
    label: "Promotion (compte à rebours, produits, CTA)",
    construire: (o, d) => [sec("Compte à rebours", w("countdown", { titre: o.titre ?? o.nom, texte: o.sousTitre ?? `Des prix réduits en ${d.devise}, pour une durée limitée.`, dateFin: o.dateFin ?? enJours(7), ctaTexte: "J'en profite" })),
      grille(o, "En promotion", "mis_en_avant"),
      bande("Ne la manquez pas", "L'offre se termine bientôt.", cta(o, d, `je veux profiter de la promotion ${o.titre ?? o.nom}.`))],
  },
  leads: {
    label: "Collecte de contacts (en-tête, avantages, CTA WhatsApp ou contact)",
    construire: (o, d) => {
      const b = (o.whatsapp ?? "").replace(/\D/g, "").length >= 8 ? cta(o, d, "je souhaite être recontacté(e).") : { texte: "Nous écrire", lien: "contact" };
      return [entete(o.titre ?? o.nom, o.sousTitre ?? "Laissez-nous vos coordonnées, on vous recontacte rapidement.", b),
        sec("Avantages", w("features", { titre: "Ce que vous recevez", colonnes: 3, items: [{ icone: "✓", titre: "Réponse rapide", texte: "On vous recontacte vite." }, { icone: "★", titre: "Offres réservées", texte: "Nos nouveautés en avant-première." }, { icone: "→", titre: "Sans engagement", texte: "Vous restez libre." }] })),
        bande("On en parle ?", "Écrivez-nous, on vous répond.", b)];
    },
  },
  evenement: {
    label: "Événement (titre, compte à rebours, texte, CTA)",
    construire: (o, d) => [sec("Événement", w("heading", { texte: o.titre ?? o.nom, niveau: "h1", align: "center" }), w("text", { texte: o.sousTitre ?? "Date, lieu et programme à compléter.", style: "sous-titre", align: "center" })),
      sec("Compte à rebours", w("countdown", { titre: "Rendez-vous dans", texte: "", dateFin: o.dateFin ?? enJours(14), ctaTexte: "Je réserve" })),
      bande("Réservez votre place", "Places limitées.", cta(o, d, `je souhaite participer à ${o.titre ?? o.nom}.`))],
  },
  acquisition: {
    label: "Acquisition (en-tête, meilleures ventes, avantages, CTA)",
    construire: (o, d) => [entete(o.titre ?? o.nom, o.sousTitre ?? `Les produits préférés de nos clients, prix en ${d.devise}.`, { texte: "Je découvre", lien: "produits" }),
      grille(o, "Nos meilleures ventes", "meilleures_ventes"),
      sec("Avantages", w("features", { titre: "Commander, c'est simple", colonnes: 3, items: [{ icone: "→", titre: "Choisissez", texte: "Parcourez le catalogue." }, { icone: "✓", titre: "Commandez", texte: "En quelques clics." }, { icone: "★", titre: "Recevez", texte: "Suivez votre commande." }] })),
      bande("Prêt à commander ?", "", cta(o, d, "je souhaite passer commande."))],
  },
};

const sansAccents = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Choix d'un plan selon une intention en langage courant (« page pour présenter notre collection Ramadan »). */
export function planPourIntention(intention: string, collections: { slug: string; nom: string }[]): { gabarit: string; collection?: { slug: string; nom: string } } {
  const t = sansAccents(intention);
  const collection = collections.find((c) => t.includes(sansAccents(c.nom)) || t.includes(c.slug.replace(/-/g, " ")));
  const gabarit =
    /\b(lead|inscri|contact|devis|rappel|coordonnees)/.test(t) ? "leads" :
    /\b(evenement|salon|atelier|soiree|live|lancement d'un evenement)/.test(t) ? "evenement" :
    /\b(lancement|lancer|nouveau produit|nouveaute)/.test(t) ? "lancement" :
    /\b(promo|solde|reduc|black friday|destockage|offre)/.test(t) ? "promotion" :
    collection && /\b(collection|presente|decouvr|gamme)/.test(t) ? "collection" :
    /\b(campagne|ramadan|noel|tabaski|fete|saint-valentin|rentree|korite|paques)/.test(t) ? "campagne" :
    /\b(acquisition|nouveaux clients|publicite|pub)\b/.test(t) ? "acquisition" :
    collection ? "collection" : "presentation";
  return { gabarit, collection };
}

// ─── Opérations ───────────────────────────────────────────────────────────────
const objet = (properties: Record<string, any>, required: string[] = []) => ({ type: "object" as const, properties, required });
const PAGE = { type: "string", description: "Page : vide ou « accueil » (défaut), « p/<slug> » pour une page libre" };
const ZONE = { type: "string", enum: ZONES };
const op = (o: OperationBuilder): OperationBuilder => o;

export const OPERATIONS: OperationBuilder[] = [
  // Pages
  op({
    nom: "axso_builder_create_page", capacite: "builder_structure",
    description: "Crée une page libre (adresse /<boutique>/p/<slug>), en brouillon par défaut (invisible du public même après publication tant que statut ≠ publiee). `gabarit` : plan de départ (vide, presentation, collection, campagne, lancement, promotion, leads, evenement, acquisition).",
    parameters: objet({
      nom: { type: "string" }, slug: { type: "string" }, gabarit: { type: "string", enum: Object.keys(PLANS) },
      collection: { type: "string", description: "Slug de collection liée (grille dynamique)" }, titre: { type: "string" }, sous_titre: { type: "string" },
      date_fin: { type: "string", description: "Fin d'une promotion / date d'un événement (ISO)" }, whatsapp: { type: "string", description: "Numéro WhatsApp de la boutique pour les CTA" },
      seo: objet({ titre: { type: "string" }, description: { type: "string" }, image: { type: "string" } }),
      visibilite: { type: "string", enum: ["publique", "lien"] }, statut: { type: "string", enum: ["brouillon", "publiee"] },
    }, ["nom"]),
    appliquer: (cfg, a, d) => {
      const nom = typeof a.nom === "string" && a.nom.trim() ? a.nom.trim().slice(0, 80) : invalide("`nom` requis.");
      const slug = slugLibre(cfg, a.slug || nom);
      const gabarit = a.gabarit ?? "vide";
      const plan = PLANS[gabarit] ?? invalide(`Gabarit inconnu « ${gabarit} » (${Object.keys(PLANS).join(", ")}).`);
      const collection = a.collection ? d.collections.find((c) => c.slug === a.collection) ?? invalide(`Collection « ${a.collection} » inconnue (${d.collections.map((c) => c.slug).join(", ") || "aucune"}).`) : undefined;
      if (gabarit === "collection" && !collection) invalide("Le gabarit « collection » demande `collection`.");
      const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
      const dateFin = a.date_fin != null ? (Number.isNaN(Date.parse(a.date_fin)) ? invalide("`date_fin` : date ISO attendue.") : String(a.date_fin).slice(0, 16)) : undefined;
      const builderTree = plan.construire({ nom, titre: str(a.titre, 120), sousTitre: str(a.sous_titre, 300), collection, whatsapp: str(a.whatsapp, 30) || d.whatsapp, dateFin }, d);
      sur(builderTree, "contenu de la page");
      const pages: Record<string, PagePerso> = ((cfg as any).pagesPerso ??= {});
      pages[slug] = {
        nom, slug, gabarit, seo: seoValide(a.seo) ?? { titre: `${nom} — ${d.nom}` }, builderTree,
        visibilite: ENUM(a.visibilite, ["publique", "lien"] as const, "visibilite") ?? "publique",
        statut: ENUM(a.statut, ["brouillon", "publiee"] as const, "statut") ?? "brouillon",
        ordre: Object.keys(pages).length,
      };
      return cfg;
    },
  }),
  op({
    nom: "axso_builder_update_page", capacite: "builder_structure",
    description: "Modifie une page libre : nom, adresse (nouveau_slug), SEO, visibilité (publique | lien = non indexée), statut (brouillon | publiee : une page ne devient visible du public que publiee ET boutique publiée).",
    parameters: objet({ page: PAGE, nom: { type: "string" }, nouveau_slug: { type: "string" }, seo: objet({ titre: { type: "string" }, description: { type: "string" }, image: { type: "string" } }), visibilite: { type: "string", enum: ["publique", "lien"] }, statut: { type: "string", enum: ["brouillon", "publiee"] } }, ["page"]),
    appliquer: (cfg, a) => {
      const cle = cleDePage(cfg, a.page) ?? invalide("L'accueil n'a pas de réglages de page libre (SEO de la boutique : outils SEO).");
      const pages = pagesDe(cfg);
      const p = pages[cle];
      if (a.nom != null) p.nom = typeof a.nom === "string" && a.nom.trim() ? a.nom.trim().slice(0, 80) : invalide("`nom` : texte attendu.");
      if (a.seo != null) p.seo = { ...p.seo, ...seoValide(a.seo) };
      p.visibilite = ENUM(a.visibilite, ["publique", "lien"] as const, "visibilite") ?? p.visibilite;
      p.statut = ENUM(a.statut, ["brouillon", "publiee"] as const, "statut") ?? p.statut;
      if (a.nouveau_slug != null && a.nouveau_slug !== cle) {
        delete pages[cle];
        const s = slugLibre(cfg, String(a.nouveau_slug));
        pages[s] = { ...p, slug: s };
      }
      return cfg;
    },
  }),
  op({
    nom: "axso_builder_duplicate_page", capacite: "builder_structure",
    description: "Duplique une page libre (nouvelle adresse, statut brouillon). Pour partir de l'accueil, crée plutôt une page avec un gabarit.",
    parameters: objet({ page: PAGE, nouveau_slug: { type: "string" }, nom: { type: "string" } }, ["page"]),
    appliquer: (cfg, a) => {
      const cle = cleDePage(cfg, a.page) ?? invalide("L'accueil ne se duplique pas en page libre : crée une page avec un gabarit.");
      const pages = pagesDe(cfg);
      const src = pages[cle];
      const nom = typeof a.nom === "string" && a.nom.trim() ? a.nom.trim().slice(0, 80) : `${src.nom} (copie)`;
      const slug = slugLibre(cfg, a.nouveau_slug || `${cle}-copie`);
      pages[slug] = { ...JSON.parse(JSON.stringify(src)), nom, slug, statut: "brouillon", ordre: Object.keys(pages).length, builderTree: (src.builderTree ?? []).map(nouveauxIds) };
      return cfg;
    },
  }),
  op({
    nom: "axso_builder_delete_page", capacite: "builder_structure", risque: "moyen",
    description: "Supprime une page libre (jamais une page fixe : accueil, catalogue, fiche produit, À propos, Contact). Les liens vers elle mèneront à une page introuvable après publication.",
    parameters: objet({ page: PAGE }, ["page"]),
    appliquer: (cfg, a) => {
      const cle = cleDePage(cfg, a.page) ?? invalide("L'accueil est une page fixe : elle ne se supprime pas.");
      delete pagesDe(cfg)[cle];
      return cfg;
    },
  }),
  op({
    nom: "axso_builder_reorder_pages", capacite: "builder_structure",
    description: "Ordre des pages libres (slugs dans l'ordre voulu ; celles non citées gardent leur ordre, après).",
    parameters: objet({ ordre: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 100 } }, ["ordre"]),
    appliquer: (cfg, a) => {
      const pages = pagesDe(cfg);
      const ordre: string[] = Array.isArray(a.ordre) ? a.ordre.map((s: unknown) => String(s).replace(/^p\//, "")) : invalide("`ordre` : liste de slugs.");
      for (const s of ordre) if (!pages[s]) introuvable(`Page « ${s} » introuvable.`);
      const reste = Object.values(pages).filter((p) => !ordre.includes(p.slug)).sort((x, y) => x.ordre - y.ordre).map((p) => p.slug);
      [...ordre, ...reste].forEach((s, i) => { pages[s].ordre = i; });
      return cfg;
    },
  }),

  // Sections
  op({
    nom: "axso_builder_add_section", capacite: "builder_structure",
    description: "Ajoute une section (zone header/template/footer) avec 1 à 4 colonnes et, en option, des composants du catalogue (un par colonne, dans l'ordre). Ex. : une section « Meilleures ventes » avec un composant products.",
    parameters: objet({
      page: PAGE, nom: { type: "string" }, zone: ZONE, position: { type: "integer", minimum: 0, description: "Rang dans la zone (défaut : à la fin)" },
      colonnes: { type: "integer", minimum: 1, maximum: 4 },
      composants: { type: "array", maxItems: 8, items: objet({ type: { type: "string", enum: WIDGETS }, config: { type: "object" } }, ["type"]) },
    }),
    appliquer: (cfg, a, d) => surArbre(cfg, a.page, (tree) => {
      const zone: Zone = ENUM(a.zone, ZONES, "zone") ?? "template";
      const comps = (Array.isArray(a.composants) ? a.composants : []).slice(0, 8).map((c: any) => {
        const config = validerConfigBloc(c?.type, c?.config);
        const n = createDefaultNode(c.type, config);
        if (n.type === "products") verifierLiaison(n.config!, d);
        return n;
      });
      const nom = typeof a.nom === "string" && a.nom.trim() ? a.nom.trim().slice(0, 80) : comps[0] ? getCatalogEntry(comps[0].type)!.label : "Section";
      return placer(tree, nouvelleSection(comps, borne(a.colonnes, 1, 4, 1), { nom, zone }), a.position);
    }),
  }),
  op({
    nom: "axso_builder_update_section", capacite: "builder_structure",
    description: "Renomme une section, la change de zone, l'affiche ou la masque (actif). Styles : axso_builder_update_style ; contenu : composants ou éléments de design.",
    parameters: objet({ page: PAGE, section_id: { type: "string" }, nom: { type: "string" }, zone: ZONE, actif: { type: "boolean" } }, ["section_id"]),
    appliquer: (cfg, a) => surArbre(cfg, a.page, (tree) => {
      const s = section(tree, a.section_id);
      const config = { ...s.config };
      if (a.nom != null) config.nom = typeof a.nom === "string" ? a.nom.slice(0, 80) : invalide("`nom` : texte attendu.");
      if (a.zone != null) config.zone = ENUM(a.zone, ZONES, "zone");
      return tree.map((n) => (n === s ? { ...n, config, ...(typeof a.actif === "boolean" ? { actif: a.actif } : {}) } : n));
    }),
  }),
  op({
    nom: "axso_builder_duplicate_section", capacite: "builder_structure",
    description: "Duplique une section juste après elle (aussi une section de design importé, à l'identique).",
    parameters: objet({ page: PAGE, section_id: { type: "string" } }, ["section_id"]),
    appliquer: (cfg, a) => surArbre(cfg, a.page, (tree) => duplicateNode(tree, section(tree, a.section_id).id)),
  }),
  op({
    nom: "axso_builder_delete_section", capacite: "builder_structure",
    description: "Supprime une section du brouillon (retour possible tant que rien n'est publié : axso_builder_discard_draft).",
    parameters: objet({ page: PAGE, section_id: { type: "string" } }, ["section_id"]),
    appliquer: (cfg, a) => surArbre(cfg, a.page, (tree) => removeNode(tree, section(tree, a.section_id).id)),
  }),
  op({
    nom: "axso_builder_move_section", capacite: "builder_structure",
    description: "Déplace une section à un rang de sa zone (0 = en haut), ou dans une autre zone (header, template, footer).",
    parameters: objet({ page: PAGE, section_id: { type: "string" }, position: { type: "integer", minimum: 0 }, zone: ZONE }, ["section_id", "position"]),
    appliquer: (cfg, a) => surArbre(cfg, a.page, (tree) => {
      const s = section(tree, a.section_id);
      const zone = ENUM(a.zone, ZONES, "zone");
      return placer(tree.filter((n) => n !== s), zone ? { ...s, config: { ...s.config, zone } } : s, a.position);
    }),
  }),
  op({
    nom: "axso_builder_update_design_element", capacite: "builder_contenu",
    description: "Modifie les éléments d'une section de design importé (titre, texte, lien, image, style), repérés par leur identifiant data-axs-el (axso_builder_get_section). Le HTML ne se réécrit jamais en entier. Avec `actions: []`, pose seulement les identifiants manquants.",
    parameters: objet({
      page: PAGE,
      actions: {
        type: "array", maxItems: 30, items: objet({
          action: { type: "string", enum: ["texte", "lien", "image", "style"] }, element: { type: "string" }, valeur: { type: "string" }, alt: { type: "string" },
          style: { type: "object", description: "police, taille, graisse, couleur, fond, alignement, padding*, marge*, rayon, masque…" }, etat: { type: "string", enum: ["base", "hover", "tablet", "mobile"] },
        }, ["action", "element"]),
      },
    }, ["actions"]),
    appliquer: (cfg, a) => surArbre(cfg, a.page, (tree) => {
      let arbre = tree;
      for (const x of (Array.isArray(a.actions) ? a.actions : []) as ActionDesign[]) {
        if (!["texte", "lien", "image", "style"].includes((x as any)?.action)) invalide("action : texte | lien | image | style (sections : outils de sections).");
        try { arbre = appliquerActionDesign(arbre, x); } catch (e) { invalide(e instanceof Error ? e.message : "action impossible."); }
      }
      return decrireAccueil(arbre).tree; // identifiants posés, comme au premier clic dans le Constructeur
    }),
  }),

  // Composants
  op({
    nom: "axso_builder_add_component", capacite: "builder_structure",
    description: "Ajoute un composant du catalogue (heading, text, button, image, products, features, cta-band, countdown, richtext…) dans une colonne (parent_id) ou une section (une ligne/colonne est créée). Config validée contre le catalogue.",
    parameters: objet({ page: PAGE, parent_id: { type: "string", description: "Colonne ou section" }, type: { type: "string", enum: WIDGETS }, config: { type: "object" }, position: { type: "integer", minimum: 0 } }, ["parent_id", "type"]),
    appliquer: (cfg, a, d) => surArbre(cfg, a.page, (tree) => {
      const parent = noeud(tree, a.parent_id, "Parent");
      if (!STRUCTURE.has(parent.type) || parent.type === "row") invalide("`parent_id` : une colonne ou une section.");
      const n = createDefaultNode(a.type, validerConfigBloc(a.type, a.config));
      if (n.type === "products") verifierLiaison(n.config!, d);
      const r = insertNode(tree, parent.id, borne(a.position, 0, 1000, 1000), n);
      return r === tree ? invalide(`« ${a.type} » ne peut pas être placé dans « ${parent.type} ».`) : r;
    }),
  }),
  op({
    nom: "axso_builder_update_component", capacite: "builder_structure",
    description: "Modifie la config d'un composant (champs fusionnés, validés contre le catalogue : axso_builder_get_component montre les champs permis).",
    parameters: objet({ page: PAGE, component_id: { type: "string" }, config: { type: "object" } }, ["component_id", "config"]),
    appliquer: (cfg, a, d) => surArbre(cfg, a.page, (tree) => configurer(tree, a.component_id, a.config, d)),
  }),
  op({
    nom: "axso_builder_duplicate_component", capacite: "builder_structure",
    description: "Duplique un composant juste après lui.",
    parameters: objet({ page: PAGE, component_id: { type: "string" } }, ["component_id"]),
    appliquer: (cfg, a) => surArbre(cfg, a.page, (tree) => duplicateNode(tree, composant(tree, a.component_id).id)),
  }),
  op({
    nom: "axso_builder_delete_component", capacite: "builder_structure",
    description: "Supprime un composant.",
    parameters: objet({ page: PAGE, component_id: { type: "string" } }, ["component_id"]),
    appliquer: (cfg, a) => surArbre(cfg, a.page, (tree) => removeNode(tree, composant(tree, a.component_id).id)),
  }),
  op({
    nom: "axso_builder_move_component", capacite: "builder_structure",
    description: "Déplace un composant dans une colonne (parent_id = id de colonne), à un rang donné. Règle : section → ligne → colonne → composant.",
    parameters: objet({ page: PAGE, component_id: { type: "string" }, parent_id: { type: "string" }, position: { type: "integer", minimum: 0 } }, ["component_id", "parent_id"]),
    appliquer: (cfg, a) => surArbre(cfg, a.page, (tree) => {
      const n = composant(tree, a.component_id);
      const parent = noeud(tree, a.parent_id, "Colonne");
      if (parent.type !== "column") invalide(`Un composant se place dans une colonne, pas dans « ${parent.type} ».`);
      const r = moveNode(tree, n.id, parent.id, borne(a.position, 0, 1000, 1000));
      return r === tree ? invalide("Déplacement impossible (règle d'imbrication).") : r;
    }),
  }),
  op({
    nom: "axso_builder_replace_component", capacite: "builder_structure",
    description: "Remplace un composant par un autre type au même endroit, en gardant son style et le contenu compatible (titre → texte d'un titre, CTA → bouton…).",
    parameters: objet({ page: PAGE, component_id: { type: "string" }, type: { type: "string", enum: WIDGETS }, config: { type: "object" } }, ["component_id", "type"]),
    appliquer: (cfg, a, d) => surArbre(cfg, a.page, (tree) => {
      const ancien = composant(tree, a.component_id);
      const schema = schemaDe(a.type);
      const o = ancien.config ?? {};
      const repris: Record<string, any> = {};
      const alias: Record<string, unknown> = a.type === "heading" ? { texte: o.titre ?? o.texte } : a.type === "button" ? { texte: o.ctaTexte ?? o.texte, lien: o.ctaLien ?? o.lien } : {};
      for (const k of Object.keys(schema)) {
        const v = alias[k] ?? o[k];
        if (v === undefined) continue;
        try { Object.assign(repris, validerConfigBloc(a.type, { [k]: v })); } catch { /* incompatible : valeur par défaut */ }
      }
      const n = { ...createDefaultNode(a.type, { ...repris, ...validerConfigBloc(a.type, a.config) }), ...(ancien.style ? { style: ancien.style } : {}) };
      if (n.type === "products") verifierLiaison(n.config!, d);
      const e = emplacement(tree, ancien.id)!;
      const sans = removeNode(tree, ancien.id);
      return insertNode(sans, e.parent?.id ?? null, e.index, n);
    }),
  }),
  op({
    nom: "axso_builder_update_style", capacite: "builder_design",
    description: "Style d'une section, ligne, colonne ou d'un composant (style de base = ordinateur, hérité par tablette et mobile) : spacing {pt,pb,pl,pr,mt,mb,ml,mr}, background {color,image,gradient}, typography {color,taille,poids,align,police,interligne,espacement}, hover {color,background}, border {radius,width,color}, visibility {desktop,tablet,mobile: booléens}, width.",
    parameters: objet({ page: PAGE, node_id: { type: "string" }, style: { type: "object" } }, ["node_id", "style"]),
    appliquer: (cfg, a) => surArbre(cfg, a.page, (tree) => {
      const n = noeud(tree, a.node_id, "Bloc");
      const s = validerStyle(a.style);
      // Fusion par groupe : changer spacing.pt garde les autres marges.
      const patch = Object.fromEntries(Object.entries(s).map(([g, v]) => [g, typeof v === "object" ? { ...(n.style as any)?.[g], ...v } : v]));
      return updateNodeStyle(tree, n.id, patch);
    }),
  }),
  op({
    nom: "axso_builder_update_responsive_style", capacite: "builder_design",
    description: "Surcharge de style pour tablette ou mobile (mêmes groupes que axso_builder_update_style sauf visibility ; ce qui n'est pas redéfini hérite de l'ordinateur). Masquer sur un appareil : axso_builder_update_style visibility.",
    parameters: objet({ page: PAGE, node_id: { type: "string" }, appareil: { type: "string", enum: ["tablet", "mobile"] }, style: { type: "object" } }, ["node_id", "appareil", "style"]),
    appliquer: (cfg, a) => surArbre(cfg, a.page, (tree) => {
      const n = noeud(tree, a.node_id, "Bloc");
      const appareil = ENUM(a.appareil, ["tablet", "mobile"] as const, "appareil") ?? invalide("`appareil` : tablet | mobile (ordinateur = axso_builder_update_style).");
      const s = validerStyle(a.style, true);
      const actuel = (n.style?.responsive?.[appareil] ?? {}) as any;
      return updateNodeResponsiveStyle(tree, n.id, appareil, Object.fromEntries(Object.entries(s).map(([g, v]) => [g, typeof v === "object" ? { ...actuel[g], ...v } : v])));
    }),
  }),

  // Contenu
  op({
    nom: "axso_builder_update_content", capacite: "builder_contenu",
    description: "Réécrit des textes en une fois : titres, sous-titres, paragraphes, CTA, badges, FAQ, témoignages… sur des composants (cible = id) ou sur les sections du socle (cible = « socle.hero », « socle.annonce », « socle.faq »… — visibles seulement sur une boutique sans design importé). Textes d'un design importé : axso_builder_update_design_element.",
    parameters: objet({
      page: PAGE,
      modifications: { type: "array", minItems: 1, maxItems: 40, items: objet({ cible: { type: "string" }, champs: { type: "object" } }, ["cible", "champs"]) },
    }, ["modifications"]),
    appliquer: (cfg, a, d) => {
      const mods = Array.isArray(a.modifications) && a.modifications.length ? a.modifications : invalide("`modifications` : [{ cible, champs }].");
      let c = cfg;
      for (const m of mods) {
        if (!m?.champs || typeof m.champs !== "object") invalide("Chaque modification demande `champs` (objet).");
        const cible = String(m?.cible ?? "");
        c = cible.startsWith("socle.") ? contenuSocle(c, cible.slice(6), m.champs) : surArbre(c, a.page, (tree) => configurer(tree, cible, m.champs, d));
      }
      return c;
    },
  }),

  // Liaisons produits
  op({
    nom: "axso_builder_update_binding", capacite: "builder_liaisons",
    description: "Change la règle d'un bloc products (dynamique : la grille suit le catalogue, aucun produit copié) : meilleures ventes, nouveautés, mis en avant, collection, catégorie, forte marge, stock bas, dormants, forte marge peu vendus, recherche ; nombre, colonnes (ordinateur/tablette/mobile), tri.",
    parameters: objet({ page: PAGE, component_id: { type: "string" }, ...LIAISON_PROPS }, ["component_id"]),
    appliquer: (cfg, a, d) => surArbre(cfg, a.page, (tree) => {
      if (composant(tree, a.component_id).type !== "products") invalide("Ce composant n'est pas une grille de produits (type products).");
      return configurer(tree, a.component_id, configLiaison(a), d);
    }),
  }),
  op({
    nom: "axso_builder_manage_products_display", capacite: "builder_liaisons",
    description: "« Mets automatiquement les 8 meilleures ventes ici » : règle une grille de produits existante (component_id), en ajoute une dans une colonne (parent_id), ou crée une section dédiée au rang `position` de la page.",
    parameters: objet({ page: PAGE, component_id: { type: "string" }, parent_id: { type: "string" }, position: { type: "integer", minimum: 0 }, ...LIAISON_PROPS }, ["regle"]),
    appliquer: (cfg, a, d) => surArbre(cfg, a.page, (tree) => {
      if (a.component_id) {
        if (composant(tree, a.component_id).type !== "products") invalide("Ce composant n'est pas une grille de produits.");
        return configurer(tree, a.component_id, configLiaison(a), d);
      }
      const n = createDefaultNode("products", validerConfigBloc("products", configLiaison(a)));
      verifierLiaison(n.config!, d);
      if (a.parent_id) {
        const p = noeud(tree, a.parent_id, "Parent");
        const r = insertNode(tree, p.id, 1000, n);
        return r === tree ? invalide("`parent_id` : une colonne ou une section.") : r;
      }
      return placer(tree, nouvelleSection([n], 1, { nom: String(a.titre ?? "Produits").slice(0, 80), zone: "template" }), a.position);
    }),
  }),

  // Fiche produit
  op({
    nom: "axso_builder_update_product_page", capacite: "builder_structure",
    description: `Fiche produit (gabarit commun, ou d'un seul produit avec produit_id) : ajouter, masquer, déplacer, configurer, styliser des sections, changer la mise en page. Sections : ${Object.entries(SECTIONS_FICHE).map(([k, v]) => `${k} (${v.label})`).join(", ")}. Les sections de base se masquent, ne se suppriment pas.`,
    parameters: objet({
      produit_id: { type: "string", description: "Fiche propre à ce produit (sinon le gabarit commun)" },
      actions: {
        type: "array", minItems: 1, maxItems: 30, items: objet({
          action: { type: "string", enum: ["ajouter", "supprimer", "deplacer", "afficher", "masquer", "configurer", "styliser", "mise_en_page"] },
          type: { type: "string" }, section: { type: "string" }, index: { type: "integer" }, config: { type: "object" }, style: { type: "object" }, layout: { type: "string" },
        }, ["action"]),
      },
    }, ["actions"]),
    appliquer: (cfg, a, d) => {
      const actions = Array.isArray(a.actions) && a.actions.length ? (a.actions as ActionFiche[]) : invalide("`actions` : liste d'actions.");
      sur(actions, "fiche produit");
      const id = a.produit_id ? (d.produits.some((p) => p.id === a.produit_id) ? String(a.produit_id) : introuvable(`Produit « ${a.produit_id} » introuvable.`)) : null;
      let pp = id ? cfg.productPagesParProduit?.[id] ?? cfg.productPage : cfg.productPage;
      for (const x of actions) {
        try { pp = appliquerActionFiche(pp, x).pp; } catch (e) { invalide(e instanceof Error ? e.message : "action impossible."); }
      }
      return id ? { ...cfg, productPagesParProduit: { ...cfg.productPagesParProduit, [id]: pp! } } : { ...cfg, productPage: pp };
    },
  }),
];
