// Découpe un design AXSO Design (config.builderHtml = en-tête + vue accueil +
// pied de page, voir lib/axso-design-library.ts) en vraies sections
// déplaçables/masquables/supprimables une à une, comme dans Shopify — au lieu
// d'un seul bloc "embed-html" monolithique. Chaque section reste un bloc
// embed-html (HTML d'origine intact) ; le CSS du design est commun, injecté
// une fois (lib/scope-css.ts::cssSectionsDesign). Le Constructeur l'utilise
// dans le navigateur (DOMParser) ; AXIA côté serveur avec node-html-parser.
import type { BlockNode, ThemeConfig } from "@/lib/theme-config";
import { genBlockId, type Zone } from "@/lib/block-tree";

// Le strict nécessaire commun à un Element du DOM et à node-html-parser.
export interface ElementDesign {
  tagName: string;
  id: string;
  outerHTML: string;
  children: ArrayLike<ElementDesign>;
  classList: { contains(c: string): boolean };
  getAttribute(nom: string): string | null | undefined;
  querySelector(sel: string): { textContent: string | null } | null;
}
/** Éléments de premier niveau d'un fragment HTML. */
export type Analyseur = (html: string) => ElementDesign[];

const analyseurNavigateur: Analyseur = (html) =>
  Array.from(new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, "text/html").body.children);

function nomSection(el: ElementDesign): string {
  const tag = el.tagName.toLowerCase();
  const cls = String(el.getAttribute("class") || "").toLowerCase();
  if (tag === "header") return "En-tête";
  if (tag === "footer") return "Pied de page";
  if (/promo|stripe|annonce|announce/.test(cls)) return "Barre d'annonces";
  if (/hero|intro/.test(cls)) return "Bannière principale";
  if (el.querySelector("#homeGrid")) return "Collection en vedette";
  if (/timer|countdown/.test(cls)) return "Compte à rebours";
  if (/strip/.test(cls)) return "Bandeau";
  if (/feature/.test(cls)) return "Mise en avant";
  const titre = el.querySelector("h1,h2,h3")?.textContent?.trim().replace(/\s+/g, " ");
  return titre ? titre.slice(0, 40) : "Section";
}

function sectionDesign(zone: Zone, nom: string, html: string): BlockNode {
  const embed: BlockNode = { id: genBlockId("embed-html"), type: "embed-html", config: { html } };
  return {
    id: genBlockId("section"),
    type: "section",
    config: { zone, nom },
    children: [{ id: genBlockId("row"), type: "row", children: [{ id: genBlockId("col"), type: "column", children: [embed] }] }],
  };
}

export function decouperDesign(builderHtml: string, analyser: Analyseur = analyseurNavigateur): BlockNode[] {
  const enfants = analyser(builderHtml);
  const iVue = enfants.findIndex((e) => e.classList.contains("view"));
  if (iVue < 0) return [];

  // <svg> de <symbol> partagés : recopiés dans chaque section qui s'en sert
  // (<use>), pour qu'aucune ne dépende d'une autre qu'on pourrait supprimer.
  const defs = enfants.slice(0, iVue).filter((e) => e.tagName.toLowerCase() === "svg").map((e) => e.outerHTML).join("");
  const avecDefs = (html: string) => (defs && html.includes("<use") ? defs + html : html);

  const vue = enfants[iVue];
  // Chaque section garde son conteneur .view d'origine : les règles du design
  // du type `#view-home .hero` continuent de s'appliquer.
  const ouvrirVue = `<div id="${vue.id}" class="${vue.getAttribute("class") || "view active"}">`;

  const sections: BlockNode[] = [];
  for (const el of enfants.slice(0, iVue)) {
    if (el.tagName.toLowerCase() === "svg") continue;
    sections.push(sectionDesign("header", nomSection(el), avecDefs(el.outerHTML)));
  }
  for (const el of Array.from(vue.children)) {
    sections.push(sectionDesign("template", nomSection(el), avecDefs(`${ouvrirVue}${el.outerHTML}</div>`)));
  }
  for (const el of enfants.slice(iVue + 1)) {
    // Toast/notifications JS : sans script, jamais visibles — inutiles ici.
    if (el.id === "toast" || el.classList.contains("toast") || el.classList.contains("live-notif")) continue;
    sections.push(sectionDesign("footer", nomSection(el), avecDefs(el.outerHTML)));
  }
  return sections;
}

/**
 * Remplace l'ancien bloc unique "Design importé" (CSS embarqué) par les
 * sections découpées, en gardant les sections ajoutées autour. Idempotent :
 * renvoie `p` inchangé s'il n'y a rien à convertir — à appeler DANS un
 * setter fonctionnel (état le plus frais, jamais de double conversion).
 */
export function convertirDesignEnSections(p: ThemeConfig, analyser: Analyseur = analyseurNavigateur): ThemeConfig {
  const arbre = p.builderTree ?? [];
  if (arbre.length === 0) {
    if (!p.builderHtml) return p;
    const sections = decouperDesign(p.builderHtml, analyser);
    return sections.length ? { ...p, builderTree: sections } : p;
  }

  const iAncien = arbre.findIndex((n) => {
    const embed = n.children?.[0]?.children?.[0]?.children?.[0];
    return n.type === "section" && embed?.type === "embed-html" && !!embed.config?.css;
  });
  if (iAncien < 0) return p;

  const embed = arbre[iAncien].children![0].children![0].children![0];
  const sections = decouperDesign(embed.config!.html || "", analyser);
  if (!sections.length) return p;
  return {
    ...p,
    builderCss: p.builderCss || embed.config!.css,
    builderTree: [...arbre.slice(0, iAncien), ...sections, ...arbre.slice(iAncien + 1)],
  };
}
