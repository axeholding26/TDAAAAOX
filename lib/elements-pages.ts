// Éléments des pages sans sections (catalogue, commande, À propos, contact,
// fiche produit) : n'importe quel titre, bouton, texte, image… se règle depuis
// le Constructeur. Ces pages sont rendues par du code (pas du HTML enregistré)
// : un élément y est donc repéré par son chemin CSS depuis la racine de la
// page, et ses réglages vivent dans themeConfig.elementsPages[page] — styles
// en CSS (lib/element-styles.ts, rendu dès le serveur), contenus (texte, lien,
// image) réappliqués dans le navigateur.
// ponytail: chemin par rang (nth-of-type) — un réglage peut glisser si la
// structure de la page change (autre thème, section ajoutée avant).
import { cssElements, type ElementStyles } from "./element-styles";

export interface ContenuPage { texte?: string; lien?: string; image?: string; alt?: string; placeholder?: string }
export interface ElementsPage { styles?: ElementStyles; contenus?: Record<string, ContenuPage> }
export type ElementsPages = Record<string, ElementsPage>;

// Racine d'une page : la fiche produit porte data-axs-page (même composant dans
// l'aperçu et en ligne) ; les autres partent de la vitrine (.axs-store du layout).
export const RACINE_PAGE = "[data-axs-page]";
const RACINE_VITRINE = ".axs-store";

export function racinePage(el: Element): Element | null {
  return el.closest(RACINE_PAGE) ?? el.ownerDocument.querySelector(RACINE_VITRINE);
}

const prefixe = (racine: Element) =>
  racine.matches(RACINE_PAGE) ? `[data-axs-page="${racine.getAttribute("data-axs-page")}"]` : RACINE_VITRINE;

const rang = (el: Element) => {
  let n = 1;
  for (let s = el.previousElementSibling; s; s = s.previousElementSibling) if (s.tagName === el.tagName) n++;
  return n;
};
const aDesJumeaux = (el: Element) => [...(el.parentElement?.children ?? [])].some((s) => s !== el && s.tagName === el.tagName);

/**
 * Sélecteur de `el` : `exact` (lui seul) et `groupe` (lui et ses semblables, ex. le titre de
 * toutes les cartes produit : le rang est retiré au plus proche niveau répété). null hors page.
 */
export function selecteurDe(el: Element): { exact: string; groupe: string | null } | null {
  const racine = racinePage(el);
  if (!racine || el === racine || !racine.contains(el)) return null;
  const etapes: { tag: string; rang: number; jumeaux: boolean }[] = [];
  for (let e: Element = el; e !== racine; e = e.parentElement!) {
    etapes.unshift({ tag: e.tagName.toLowerCase(), rang: rang(e), jumeaux: aDesJumeaux(e) });
  }
  const chemin = (sansRang = -1) => [prefixe(racine), ...etapes.map((s, i) => (i === sansRang ? s.tag : `${s.tag}:nth-of-type(${s.rang})`))].join(">");
  const niveau = etapes.map((s) => s.jumeaux).lastIndexOf(true);
  return { exact: chemin(), groupe: niveau >= 0 ? chemin(niveau) : null };
}

const SANS_TEXTE = ["img", "input", "textarea", "select", "svg"];

/** Contenu modifiable de l'élément (null = champ absent). Texte : seulement s'il ne contient que du texte. */
export function lireContenu(el: Element) {
  const tag = el.tagName.toLowerCase();
  return {
    texte: !SANS_TEXTE.includes(tag) && el.children.length === 0 ? el.textContent ?? "" : null,
    lien: tag === "a" ? el.getAttribute("href") ?? "" : null,
    image: tag === "img" ? el.getAttribute("src") ?? "" : null,
    alt: tag === "img" ? el.getAttribute("alt") ?? "" : null,
    placeholder: tag === "input" || tag === "textarea" ? el.getAttribute("placeholder") ?? "" : null,
  };
}

/** Réapplique les contenus de la page. Le texte change dans son nœud existant (React garde ses références). */
export function appliquerContenus(doc: Document, contenus?: Record<string, ContenuPage>) {
  for (const [sel, c] of Object.entries(contenus ?? {})) {
    let els: Element[];
    try { els = [...doc.querySelectorAll(sel)]; } catch { continue; }
    for (const el of els) {
      const txt = el.childNodes.length === 1 && el.firstChild!.nodeType === 3 ? el.firstChild! : null;
      if (c.texte != null && txt && txt.nodeValue !== c.texte) txt.nodeValue = c.texte;
      const attr = (nom: string, v?: string) => { if (v != null && el.getAttribute(nom) !== v) el.setAttribute(nom, v); };
      if (!/^\s*(javascript|data|vbscript):/i.test(c.lien ?? "")) attr("href", c.lien); // jamais de script dans un lien
      if (c.image != null) { el.removeAttribute("srcset"); attr("src", c.image); }
      attr("alt", c.alt);
      attr("placeholder", c.placeholder);
    }
  }
}

export const cssElementsPage = (p?: ElementsPage) => cssElements(p?.styles, "", true, true);
