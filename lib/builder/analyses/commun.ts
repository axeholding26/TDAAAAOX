// Socle des analyses du Builder (mobile, SEO, accessibilité, performance, conversion…).
// Tout est PUR : une config de boutique (déjà résolue) + des données de boutique → une liste
// de problèmes. Chaque problème peut porter une correction = une étape { op, args } d'une
// opération EXISTANTE du registre, applicable telle quelle par axso_builder_apply.
// Pour analyser une page, on la ramène à une liste plate d'« éléments » (titre, texte,
// bouton, lien, image…) qu'elle vienne de blocs du Constructeur, d'un design importé
// (embed-html) ou du socle (sections) : chaque analyseur ne lit que ces éléments.
import { parse, type HTMLElement } from "node-html-parser";
import type { BlockNode, ThemeConfig } from "@/lib/theme-config";
import { ordonnerParZone, zoneDe, type Zone } from "@/lib/block-tree";
import { OPERATIONS_PAR_NOM } from "@/lib/builder/operations";
import type { EtapeOperation } from "@/lib/builder/types";

export type Gravite = "info" | "attention" | "critique";
export type Domaine = "mobile" | "seo" | "accessibilite" | "performance" | "conversion" | "design" | "ux";

/** Format partagé avec la boucle d'auto-correction : ne pas changer ses clés. */
export interface Probleme { gravite: Gravite; domaine: Domaine; cible: string; message: string; correction: EtapeOperation | null }

/** Données de boutique lues par les analyses (jamais de secret : les scripts de suivi ne sont qu'une taille). */
export interface Boutique {
  nom: string; slug: string; devise?: string;
  description?: string | null; metaTitle?: string | null; metaDescription?: string | null;
  logoUrl?: string | null; bannerUrl?: string | null; whatsapp?: string | null;
  livraison?: Record<string, any> | null;
  /** Taille (caractères) des scripts de suivi personnalisés, et nombre de pixels (Meta, TikTok, Snap, GTM). */
  scripts?: { octets: number; pixels: number };
  produits: { id: string; nom: string; slug?: string | null; description?: string | null; metaTitle?: string | null; metaDesc?: string | null; images: string[]; prix: number; prixCompare?: number | null; actif?: boolean }[];
  collections: { slug: string; nom: string }[];
  avisApprouves?: number;
  /** Médias connus (médiathèque IA) : poids et dimensions quand on les a. */
  medias?: { url: string; octets?: number | null; largeur?: number | null; hauteur?: number | null }[];
}

export type Sorte = "titre" | "texte" | "bouton" | "lien" | "image" | "produits" | "preuve" | "confiance" | "video" | "formulaire" | "champ";

export interface Element {
  page: string;      // « accueil » ou « p/<slug> »
  bloc: string;      // id du bloc (ou de la section du socle : « hero »…)
  section: string;   // section racine qui le contient
  zone: Zone;
  sorte: Sorte;
  source: "bloc" | "design" | "socle";
  typeBloc?: string; // type du bloc du Constructeur qui le rend
  niveau?: number;   // titres : 1 à 6
  texte?: string;
  lien?: string | null;  // null = élément cliquable sans adresse
  url?: string;      // image, vidéo
  alt?: string | null;   // null = attribut absent
  dimensionne?: boolean; // ratio ou largeur/hauteur connus : pas de décalage de mise en page
  differe?: boolean;     // chargement différé (loading=lazy)
  taille?: string;       // bouton du Constructeur : sm | md | lg
  police?: string;       // taille de police réglée (ex. « 56px »)
  policeMobile?: string; // surcharge mobile
  largeur?: string; largeurMobile?: string;
  couleur?: string; fond?: string;
  elId?: string;         // data-axs-el d'un élément de design
  nombre?: number;       // produits affichés, images d'une galerie…
}

export interface PageAnalysee { cle: string; nom: string; sections: BlockNode[]; elements: Element[]; seo?: Record<string, any>; htmlOctets: number }

// ─── Corrections ─────────────────────────────────────────────────────────────
/**
 * Première étape candidate dont l'opération existe dans le registre ET accepte exactement
 * ces paramètres (schéma de l'opération) ; sinon null. Les noms des opérations des autres
 * parties du Builder ne sont pas figés : on ne propose jamais une étape qui échouerait.
 */
export function correction(...candidats: [string, Record<string, any>][]): EtapeOperation | null {
  for (const [op, args] of candidats) {
    const o = OPERATIONS_PAR_NOM.get(op);
    if (!o) continue;
    const props = o.parameters.properties ?? {};
    if (Object.keys(args).every((k) => k in props) && (o.parameters.required ?? []).every((k) => k in args)) return { op, args };
  }
  return null;
}

// Opérations des autres parties du Builder (lib/builder/operations), avec leurs paramètres.
// `page` : « accueil » ou « p/<slug> », comme les clés de PageAnalysee.
export const corr = {
  configBloc: (page: string, id: string, config: Record<string, any>) => correction(["axso_builder_update_component", { page, component_id: id, config }]),
  styleBloc: (page: string, id: string, style: Record<string, any>) => correction(["axso_builder_update_style", { page, node_id: id, style }]),
  styleMobile: (page: string, id: string, style: Record<string, any>) => correction(["axso_builder_update_responsive_style", { page, node_id: id, appareil: "mobile", style }]),
  couleurs: (colors: Record<string, string>) => correction(["axso_builder_update_colors", colors]),
  miseEnPage: (miseEnPage: Record<string, any>) => correction(["axso_builder_update_theme", { miseEnPage }]),
  styleElement: (page: string, elId: string, style: Record<string, any>, etat: "base" | "mobile" = "base") =>
    correction(["axso_builder_update_design_element", { page, actions: [{ action: "style", element: elId, style, etat }] }]),
  supprimerSection: (page: string, id: string) => correction(["axso_builder_delete_section", { page, section_id: id }]),
};

export const pb = (gravite: Gravite, domaine: Domaine, cible: string, message: string, correction: EtapeOperation | null = null): Probleme =>
  ({ gravite, domaine, cible, message, correction });

// ─── Couleurs et contraste (WCAG 2.x) ────────────────────────────────────────
const NOMMEES: Record<string, string> = { white: "#ffffff", black: "#000000", red: "#ff0000", gray: "#808080", grey: "#808080" };

/** [r, g, b] 0-255, ou null si la couleur n'est pas calculable (variable CSS, dégradé…). */
export function rgb(c: string | undefined | null): [number, number, number] | null {
  if (!c) return null;
  let s = c.trim().toLowerCase();
  s = NOMMEES[s] ?? s;
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((x) => x + x).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

const lin = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
export const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);

/** Rapport de contraste WCAG (1 à 21), ou null si une couleur n'est pas calculable. */
export function contraste(a: string | undefined | null, b: string | undefined | null): number | null {
  const x = rgb(a), y = rgb(b);
  if (!x || !y) return null;
  const [l1, l2] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return Math.round(((l1 + 0.05) / (l2 + 0.05)) * 100) / 100;
}

const hex = (c: [number, number, number]) => "#" + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");

/** La couleur la plus proche de `texte` (même teinte, assombrie ou éclaircie) qui atteint `cible` sur `fond`. */
export function ajusterContraste(texte: string, fond: string, cible = 4.5): string | null {
  const t = rgb(texte), f = rgb(fond);
  if (!t || !f) return null;
  const vers = luminance(f) > 0.4 ? 0 : 255;
  for (let k = 0; k <= 1.0001; k += 0.05) {
    const c = hex(t.map((v) => v + (vers - v) * k) as [number, number, number]);
    if ((contraste(c, fond) ?? 0) >= cible) return c;
  }
  return null;
}

// ─── Tailles ─────────────────────────────────────────────────────────────────
/** Valeur en px d'une taille CSS simple (px, rem, em) ; null sinon (%, vw, clamp…). */
export function px(v: string | undefined | null): number | null {
  const m = /^\s*([\d.]+)\s*(px|rem|em)?\s*$/i.exec(v ?? "");
  if (!m) return null;
  return Number(m[1]) * (m[2] && m[2].toLowerCase() !== "px" ? 16 : 1);
}

// ─── Pages → éléments ────────────────────────────────────────────────────────
const NIVEAUX: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
const texteDe = (el: HTMLElement) => el.textContent.replace(/\s+/g, " ").trim();
const styleInline = (el: HTMLElement, prop: string) => new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i").exec(el.getAttribute("style") ?? "")?.[1]?.trim();

/** Éléments d'un HTML de design (embed-html ou design importé entier). */
export function elementsDesign(html: string, base: Omit<Element, "sorte" | "source">, styles: Record<string, any> = {}): Element[] {
  const out: Element[] = [];
  const racine = parse(html);
  // Grilles de produits du design : remplies à l'affichage avec les vrais produits (lib/vitrine-design.ts) —
  // leurs cartes d'origine ne sont pas analysées.
  for (const g of racine.querySelectorAll("#homeGrid, #plpGrid")) out.push({ ...base, sorte: "produits", source: "design", nombre: 8, elId: g.getAttribute("data-axs-el") ?? undefined });
  for (const el of racine.querySelectorAll("h1,h2,h3,h4,h5,h6,p,a,button,img,video,iframe,form,input,textarea,select")) {
    if (el.closest("svg") || el.closest("#homeGrid") || el.closest("#plpGrid")) continue;
    const tag = el.rawTagName.toLowerCase();
    const elId = el.getAttribute("data-axs-el") ?? undefined;
    const st = elId ? styles[elId] ?? {} : {};
    const commun = {
      ...base, source: "design" as const, elId,
      police: st.base?.taille ?? styleInline(el, "font-size"), policeMobile: st.mobile?.taille,
      largeur: st.base?.largeur ?? styleInline(el, "width"), largeurMobile: st.mobile?.largeur,
      couleur: st.base?.couleur ?? styleInline(el, "color"), fond: st.base?.fond ?? styleInline(el, "background-color") ?? styleInline(el, "background"),
    };
    if (NIVEAUX[tag]) out.push({ ...commun, sorte: "titre", niveau: NIVEAUX[tag], texte: texteDe(el) });
    else if (tag === "p") { const t = texteDe(el); if (t) out.push({ ...commun, sorte: "texte", texte: t }); }
    else if (tag === "a" || tag === "button") {
      const href = el.getAttribute("href");
      const nom = texteDe(el) || el.getAttribute("aria-label") || el.getAttribute("title") || el.querySelector("img")?.getAttribute("alt") || "";
      const bouton = tag === "button" || /\b(btn|button|cta)\b/i.test(el.getAttribute("class") ?? "");
      out.push({ ...commun, sorte: bouton ? "bouton" : "lien", texte: nom, lien: tag === "a" ? (href ?? null) : href ?? "" });
    } else if (tag === "img") {
      out.push({
        ...commun, sorte: "image", url: el.getAttribute("src") ?? "", alt: el.getAttribute("alt") ?? null,
        dimensionne: !!(el.getAttribute("width") && el.getAttribute("height")) || /aspect-ratio/i.test(el.getAttribute("style") ?? ""),
        differe: el.getAttribute("loading") === "lazy",
      });
    } else if (tag === "video" || tag === "iframe") out.push({ ...commun, sorte: "video", url: el.getAttribute("src") ?? "" });
    else if (tag === "form") out.push({ ...commun, sorte: "formulaire" });
    else if (el.getAttribute("type") !== "hidden" && el.getAttribute("type") !== "submit") {
      const id = el.getAttribute("id");
      const libelle = el.getAttribute("aria-label") || el.getAttribute("title") || (id && racine.querySelector(`label[for="${id}"]`)?.textContent) || (el.closest("label") ? "label" : "");
      out.push({ ...commun, sorte: "champ", texte: libelle || "", alt: el.getAttribute("placeholder") });
    }
  }
  return out;
}

/** Éléments d'un bloc du Constructeur (selon le rendu de components/storefront/blocks). */
function elementsBloc(n: BlockNode, base: Omit<Element, "sorte" | "source" | "bloc">): Element[] {
  const c = n.config ?? {}, s = n.style ?? {};
  const b = {
    ...base, bloc: n.id, source: "bloc" as const, typeBloc: n.type,
    police: s.typography?.taille, policeMobile: s.responsive?.mobile?.typography?.taille,
    largeur: s.width, largeurMobile: (s.responsive?.mobile as any)?.width,
    couleur: s.typography?.color, fond: s.background?.color,
  };
  const titre = (t?: string, niveau = 2): Element[] => (t ? [{ ...b, sorte: "titre", niveau, texte: t }] : []);
  const cta = (texte?: string, lien?: string): Element[] => (texte ? [{ ...b, sorte: "bouton", texte, lien: lien ?? "" }] : []);
  switch (n.type) {
    case "embed-html": return elementsDesign(c.html ?? "", { ...base, bloc: n.id }, c.elementStyles);
    case "heading": return titre(c.texte ?? "Titre", NIVEAUX[c.niveau] ?? 2);
    case "text": return c.texte ? [{ ...b, sorte: "texte", texte: c.texte }] : [];
    case "richtext": return [...titre(c.titre), ...(c.texte ? [{ ...b, sorte: "texte" as const, texte: c.texte }] : []), ...cta(c.ctaTexte, c.ctaLien)];
    case "button": return [{ ...b, sorte: "bouton", texte: c.texte ?? "", lien: c.lien ?? "", taille: c.taille ?? "md" }];
    case "image": return [{ ...b, sorte: "image", url: c.url ?? "", alt: c.alt ?? "", dimensionne: !!c.ratio && c.ratio !== "auto", differe: false, lien: c.lien || undefined }];
    case "gallery": return [...titre(c.titre), ...(c.images ?? []).filter(Boolean).map((url: string) => ({ ...b, sorte: "image" as const, url, alt: "", dimensionne: true, differe: true }))];
    case "products": return [...titre(c.titre), { ...b, sorte: "produits", nombre: Number(c.nombre) || 8 }];
    case "cta-band": return [...titre(c.titre), ...cta(c.ctaTexte, c.ctaLien)];
    case "countdown": return [...titre(c.titre), ...cta(c.ctaTexte, "")];
    case "social-proof": return [{ ...b, sorte: "preuve", texte: [c.note, c.nbClients, ...(c.certifications ?? [])].join(" ") }];
    case "features": return [...titre(c.titre), { ...b, sorte: "confiance", texte: (c.items ?? []).map((i: any) => `${i.titre} ${i.texte}`).join(" ") }];
    case "stats": return [...titre(c.titre), { ...b, sorte: "preuve", texte: (c.items ?? []).map((i: any) => `${i.valeur} ${i.label}`).join(" ") }];
    case "brands": return [...titre(c.titre), { ...b, sorte: "preuve", texte: "logos" }];
    case "video": return [...titre(c.titre), { ...b, sorte: "video", url: c.videoUrl ?? "" }];
    case "tabs": case "columns": return titre(c.titre);
    default: return [];
  }
}

function elementsArbre(tree: BlockNode[], page: string): Element[] {
  const out: Element[] = [];
  const visiter = (n: BlockNode, section: string, zone: Zone) => {
    if (n.actif === false || (n.style?.visibility?.desktop === false && n.style?.visibility?.mobile === false)) return;
    out.push(...elementsBloc(n, { page, section, zone }));
    for (const e of n.children ?? []) visiter(e, section, zone);
  };
  for (const s of ordonnerParZone(tree ?? [])) visiter(s, s.id, zoneDe(s));
  return out;
}

const ORDRE_SOCLE = ["hero", "confiance", "vedettes", "collections", "about", "promo", "faq", "avis", "newsletter"];

/** Accueil du socle (ni Constructeur ni design importé) : sections fixes rendues par app/(storefront)/[slug]/page.tsx. */
function elementsSocle(cfg: ThemeConfig, b: Boutique): Element[] {
  const out: Element[] = [];
  const sec = cfg.sections as any;
  for (const id of cfg.sectionOrder?.length ? cfg.sectionOrder : ORDRE_SOCLE) {
    const s = sec?.[id];
    if (!s?.actif) continue;
    const base = { page: "accueil", bloc: id, section: id, zone: "template" as Zone, source: "socle" as const };
    if (id === "hero") {
      out.push({ ...base, sorte: "titre", niveau: 1, texte: s.titre }, { ...base, sorte: "bouton", texte: s.ctaTexte, lien: s.ctaLien || "produits" });
      if (b.bannerUrl) out.push({ ...base, sorte: "image", url: b.bannerUrl, alt: "", dimensionne: true });
    } else {
      if (s.titre) out.push({ ...base, sorte: "titre", niveau: 2, texte: s.titre });
      if (id === "vedettes") out.push({ ...base, sorte: "produits", nombre: s.nombre || 8 });
      if (id === "avis") out.push({ ...base, sorte: "preuve", texte: "avis" });
      if (id === "confiance") out.push({ ...base, sorte: "confiance", texte: (s.items ?? []).map((i: any) => `${i.titre} ${i.texte}`).join(" ") });
      if (id === "newsletter") out.push({ ...base, sorte: "formulaire" });
      if (s.ctaTexte && id !== "newsletter") out.push({ ...base, sorte: "bouton", texte: s.ctaTexte, lien: "produits" });
    }
  }
  return out;
}

/** Pages analysables de la config : l'accueil (selon ce que la vitrine rend vraiment) et les pages libres. */
export function pagesDe(cfg: ThemeConfig, b: Boutique): PageAnalysee[] {
  const pages: PageAnalysee[] = [];
  const tree = cfg.builderTree ?? [];
  if (tree.length) pages.push({ cle: "accueil", nom: "Accueil", sections: ordonnerParZone(tree), elements: elementsArbre(tree, "accueil"), htmlOctets: JSON.stringify(tree).length });
  else if (cfg.builderHtml) pages.push({ cle: "accueil", nom: "Accueil", sections: [], elements: elementsDesign(cfg.builderHtml, { page: "accueil", bloc: "builderHtml", section: "builderHtml", zone: "template" }), htmlOctets: cfg.builderHtml.length });
  else pages.push({ cle: "accueil", nom: "Accueil", sections: [], elements: elementsSocle(cfg, b), htmlOctets: 0 });
  for (const [slug, p] of Object.entries(((cfg as any).pagesPerso ?? {}) as Record<string, any>)) {
    if (!p || p.actif === false) continue;
    const t: BlockNode[] = p.builderTree ?? [];
    const cle = `p/${slug}`;
    pages.push({ cle, nom: p.nom ?? slug, sections: t, elements: elementsArbre(t, cle), seo: p.seo, htmlOctets: JSON.stringify(t).length });
  }
  return pages;
}

/** Tous les nœuds (avec leur page), pour les analyses qui lisent le style des blocs. */
export function noeuds(cfg: ThemeConfig): { page: string; n: BlockNode; fond?: string }[] {
  const out: { page: string; n: BlockNode; fond?: string }[] = [];
  const visiter = (n: BlockNode, page: string, fond?: string) => {
    if (n.actif === false) return;
    const f = n.style?.background?.color ?? fond;
    out.push({ page, n, fond: f });
    for (const e of n.children ?? []) visiter(e, page, f);
  };
  for (const n of cfg.builderTree ?? []) visiter(n, "accueil");
  for (const [slug, p] of Object.entries(((cfg as any).pagesPerso ?? {}) as Record<string, any>)) for (const n of p?.builderTree ?? []) visiter(n, `p/${slug}`);
  return out;
}

// ─── Liens ───────────────────────────────────────────────────────────────────
const PAGES_FIXES = new Set(["", "produits", "a-propos", "contact", "panier", "checkout", "wishlist", "mon-compte", "collections"]);

/** Lien interne d'une boutique ramené à son chemin (« produits », « p/ete »…), null si externe ou spécial. */
export function cheminInterne(lien: string, slug: string): string | null {
  const l = lien.trim();
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(l) || l.startsWith("#")) return null;
  let c = l.replace(/[?#].*$/, "");
  if (c === "/" ) return "";
  if (c.startsWith(`/${slug}/`) || c === `/${slug}`) c = c.slice(slug.length + 1);
  else if (c.startsWith("/")) return null; // autre page d'Axso : hors boutique
  return c.replace(/^\/+|\/+$/g, "");
}

/** Raison pour laquelle un lien est cassé, ou null s'il mène bien quelque part. */
export function lienCasse(lien: string | null | undefined, cfg: ThemeConfig, b: Boutique): string | null {
  if (lien === null) return "élément cliquable sans adresse";
  if (lien === undefined) return null;
  if (!lien.trim() || lien.trim() === "#") return "lien vide";
  const c = cheminInterne(lien, b.slug);
  if (c === null || PAGES_FIXES.has(c)) return null;
  const [tete, suite] = [c.split("/")[0], c.split("/").slice(1).join("/")];
  if (tete === "p") return (cfg as any).pagesPerso?.[suite] ? null : `page libre « ${suite} » inexistante`;
  if (tete === "collections") return b.collections.some((x) => x.slug === suite) ? null : `collection « ${suite} » inexistante ou inactive`;
  if (tete === "produits") return b.produits.some((p) => p.id === suite || p.slug === suite) || !suite ? null : `produit « ${suite} » introuvable`;
  if (["tracking", "confirmation", "facture", "formation", "livreur", "commande-confirmee"].includes(tete)) return null;
  return `page « ${c} » inexistante`;
}

export const tronquer = (s: string | undefined | null, n = 60) => { const t = (s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
