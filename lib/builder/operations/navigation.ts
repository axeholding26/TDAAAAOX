// Opérations pures du Builder — navigation, en-tête, pied de page, placement des médias.
// Deux sources de menus :
//  - design importé : les liens sont des <a> du HTML des sections En-tête / Pied de page
//    (blocs embed-html du builderTree) ; on les modifie sur place, un lien ajouté est le
//    clone d'un lien frère (même style), jamais du code écrit par l'IA ;
//  - socle : themeConfig.navigation = { principal: [{ libelle, lien }], pied: [{ titre, liens }] },
//    rendu par StorefrontNavbar (menu principal) et le layout de la vitrine (colonnes du pied) ;
//    vide = liens par défaut de la vitrine.
// Liens enregistrés : chemin interne SANS le slug (« produits », « collections/ete »), ou adresse complète.
import { parse, type HTMLElement as El } from "node-html-parser";
import type { BlockNode, ThemeConfig } from "@/lib/theme-config";
import { findNode, zoneDe } from "@/lib/block-tree";
import { appliquerActionDesign } from "@/lib/design-accueil";
import { ErreurBuilder, type DonneesBoutique, type OperationBuilder } from "../types";
import { adresseImageSure, remplacerImage } from "../images";

export interface LienMenu { libelle: string; lien: string }
export interface ColonnePied { titre: string; liens: LienMenu[] }
export interface NavigationSocle { principal?: LienMenu[]; pied?: ColonnePied[] }

const invalide = (m: string) => new ErreurBuilder("INVALID_INPUT", m);
const introuvable = (m: string) => new ErreurBuilder("NOT_FOUND", m);
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ─── Liens autorisés ─────────────────────────────────────────────────────────
const INTERNE = /^(produits(\/[\w-]{1,64})?|collections\/[a-z0-9-]{1,80}|p\/[a-z0-9-]{1,60}|a-propos|contact|mon-compte|wishlist|panier)?$/;
const PLATEFORME = /^\/(suivi|legal\/[a-z-]{1,30})$/; // pages d'Axso communes à toutes les boutiques

/** Forme enregistrée d'un lien ; lève si le lien n'est pas autorisé (javascript:, data:, http:, autre boutique…). */
export function normaliserLien(brut: unknown, slug: string): string {
  if (typeof brut !== "string" || !brut.trim()) throw invalide("Lien manquant (« / » pour l'accueil).");
  const l = brut.trim();
  const refus = invalide(`Lien refusé : « ${l.slice(0, 80)} ». Autorisés : pages de la boutique (produits, collections/<slug>, p/<page>, a-propos, contact, mon-compte, wishlist, panier, produits/<id>), #ancre, https://…, https://wa.me/…, tel:+…, mailto:…`);
  if (l.length > 500 || /[\s"'<>`\\]/.test(l)) throw refus;
  if (/^#[\w-]{1,80}$/.test(l) || PLATEFORME.test(l)) return l;
  if (/^https:\/\//i.test(l)) { try { if (new URL(l).hostname.includes(".")) return l; } catch {} throw refus; }
  if (/^tel:\+?\d[\d-]{5,19}$/.test(l) || /^mailto:[^@?]+@[^@?]+\.[a-z]{2,}$/i.test(l)) return l;
  let chemin = l.replace(/^\/+/, "").replace(/\/+$/, "");
  if (chemin === slug || chemin.startsWith(`${slug}/`)) chemin = chemin.slice(slug.length).replace(/^\//, "");
  if (chemin === "accueil") chemin = "";
  if (INTERNE.test(chemin)) return chemin;
  throw refus;
}

/** Adresse rendue dans la vitrine. */
export const hrefDe = (lien: string, slug: string) => (/^(https:|mailto:|tel:|#|\/)/.test(lien) ? lien : `/${slug}${lien ? `/${lien}` : ""}`);

export interface VerifLien { lien: string | null; cible: string; valide: boolean; raison?: string }

/** Cible résolue d'un lien et sa validité (collection, page libre, produit existants). */
export function verifierLien(href: string | undefined, d: DonneesBoutique, cfg: Record<string, any>): VerifLien {
  const h = (href ?? "").trim();
  if (!h || h === "#") return { lien: null, cible: "aucune", valide: false, raison: "lien sans destination" };
  let lien: string;
  try { lien = normaliserLien(h, d.slug); } catch {
    const autre = /^\/([a-z0-9-]+)(\/|$)/.exec(h);
    return { lien: null, cible: h.slice(0, 120), valide: false, raison: autre ? `adresse d'une autre boutique ou page inconnue (/${autre[1]})` : "lien non autorisé" };
  }
  if (lien.startsWith("#")) return { lien, cible: `ancre ${lien} de la page`, valide: true };
  if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(lien)) return { lien, cible: "WhatsApp", valide: true };
  if (/^(https:|mailto:|tel:)/.test(lien)) return { lien, cible: lien.startsWith("https:") ? "site externe (non vérifié)" : lien.split(":")[0] === "tel" ? "téléphone" : "e-mail", valide: true };
  if (PLATEFORME.test(lien)) return { lien, cible: lien === "/suivi" ? "suivi de commande" : "mentions légales", valide: true };
  const [type, cle] = lien.split("/");
  if (type === "collections") {
    const c = d.collections.find((x) => x.slug === cle);
    return c ? { lien, cible: `collection « ${c.nom} »`, valide: true } : { lien, cible: `collection ${cle}`, valide: false, raison: "collection inexistante ou inactive" };
  }
  if (type === "p") return cfg.pagesPerso?.[cle] ? { lien, cible: `page « ${cfg.pagesPerso[cle].titre ?? cle} »`, valide: true } : { lien, cible: `page ${cle}`, valide: false, raison: "page libre inexistante" };
  if (type === "produits" && cle) {
    const p = d.produits.find((x) => x.id === cle);
    if (p) return { lien, cible: `produit « ${p.nom} »`, valide: true };
    // ponytail: donneesBoutique ne charge que 200 produits ; au-delà, un produit absent n'est pas forcément supprimé.
    return d.produits.length < 200 ? { lien, cible: `produit ${cle}`, valide: false, raison: "produit inexistant" } : { lien, cible: `produit ${cle} (non vérifié)`, valide: true };
  }
  const NOMS: Record<string, string> = { "": "accueil", produits: "catalogue", "a-propos": "à propos", contact: "contact", "mon-compte": "espace client", wishlist: "favoris", panier: "panier" };
  return { lien, cible: NOMS[lien] ?? lien, valide: true };
}

// ─── Menus du design importé ─────────────────────────────────────────────────
const premierEmbed = (n: BlockNode): BlockNode | undefined => (n.type === "embed-html" ? n : n.children?.map(premierEmbed).find(Boolean));

/** Sections de design qui portent l'en-tête ou le pied de page (zone, ou balise <header>/<footer> d'un arbre non découpé). */
export function sectionsChrome(cfg: Record<string, any>): { section: BlockNode; embed: BlockNode; zone: "header" | "footer" }[] {
  return ((cfg.builderTree ?? []) as BlockNode[]).flatMap((s) => {
    const embed = premierEmbed(s);
    const html: string = embed?.config?.html ?? "";
    if (!embed || !html) return [];
    const z = zoneDe(s);
    if (z !== "template") return [{ section: s, embed, zone: z }];
    return /<header\b/i.test(html) ? [{ section: s, embed, zone: "header" as const }] : /<footer\b/i.test(html) ? [{ section: s, embed, zone: "footer" as const }] : [];
  });
}

const conteneur = (a: El) => { const p = a.parentNode as El; return (p?.tagName === "LI" ? p.parentNode : p) as El; };
const unite = (a: El) => { const p = a.parentNode as El; return p?.tagName === "LI" ? p : a; };

/** Liens regroupés par conteneur (le <ul> d'une colonne, le <nav> de l'en-tête…), dans l'ordre du document. */
export function groupesLiens(racine: El): El[][] {
  const groupes = new Map<El, El[]>();
  for (const a of racine.querySelectorAll("a")) {
    if (a.closest("svg")) continue;
    const c = conteneur(a);
    groupes.set(c, [...(groupes.get(c) ?? []), a]);
  }
  return [...groupes.values()];
}

function titreGroupe(groupe: El[]): string | null {
  const c = conteneur(groupe[0]);
  const prec = c.previousElementSibling;
  if (prec && /^H[1-6]$/.test(prec.tagName)) return prec.text.trim().slice(0, 60);
  return c.tagName === "NAV" ? "menu" : null;
}

export interface Menu {
  id: string; source: "design" | "socle"; zone: "header" | "footer"; titre: string | null;
  /** Socle sans menu configuré : liens par défaut de la vitrine. */
  par_defaut?: boolean;
  liens: { index: number; libelle: string; href: string }[];
}

/** Liens par défaut du menu principal du socle (ceux de StorefrontNavbar). */
function principalParDefaut(cfg: Record<string, any>, d: DonneesBoutique): LienMenu[] {
  return [
    { libelle: "Produits", lien: "produits" },
    ...(cfg.aboutPage?.actif ? [{ libelle: "À propos", lien: "a-propos" }] : []),
    ...(cfg.contactPage?.actif ? [{ libelle: "Contact", lien: "contact" }] : []),
    ...d.collections.slice(0, 4).map((c) => ({ libelle: c.nom, lien: `collections/${c.slug}` })),
  ];
}

/** Tous les menus : ceux du design (en-tête, colonnes du pied) et ceux du socle. Identifiants stables tant que la structure ne change pas. */
export function lireMenus(cfg: Record<string, any>, d: DonneesBoutique): Menu[] {
  const menus: Menu[] = [];
  for (const { section, embed, zone } of sectionsChrome(cfg)) {
    groupesLiens(parse(embed.config!.html)).forEach((g, i) => menus.push({
      id: `${section.id}~${i}`, source: "design", zone, titre: titreGroupe(g),
      liens: g.map((a, index) => ({ index, libelle: a.text.trim().replace(/\s+/g, " ").slice(0, 60), href: a.getAttribute("href") ?? "" })),
    }));
  }
  const nav = (cfg.navigation ?? {}) as NavigationSocle;
  const principal = nav.principal?.length ? nav.principal : principalParDefaut(cfg, d);
  menus.push({ id: "principal", source: "socle", zone: "header", titre: "menu principal", par_defaut: !nav.principal?.length, liens: principal.map((l, index) => ({ index, libelle: l.libelle, href: hrefDe(l.lien, d.slug) })) });
  (nav.pied ?? []).forEach((c, i) => menus.push({ id: `pied:${i}`, source: "socle", zone: "footer", titre: c.titre, liens: c.liens.map((l, index) => ({ index, libelle: l.libelle, href: hrefDe(l.lien, d.slug) })) }));
  return menus;
}

/** Ouvre le HTML d'une section de design, applique `f` au groupe de liens visé, réécrit le HTML (config déjà copiée par le moteur). */
function avecGroupeDesign(cfg: ThemeConfig, menu: string, f: (groupe: El[]) => void): ThemeConfig {
  const [sectionId, g] = menu.split("~");
  const cible = sectionsChrome(cfg).find((s) => s.section.id === sectionId);
  if (!cible) throw introuvable(`Menu « ${menu} » introuvable : relis axso_builder_get_navigation.`);
  const racine = parse(cible.embed.config!.html);
  const groupe = groupesLiens(racine)[Number(g)];
  if (!groupe) throw introuvable(`Menu « ${menu} » introuvable : relis axso_builder_get_navigation.`);
  f(groupe);
  cible.embed.config = { ...cible.embed.config, html: racine.toString() };
  return cfg;
}

/** Copie d'un lien frère, dans son <li> s'il en a un : même classes, même style ; sans identifiant ni gestionnaire d'événement. */
function cloner(modele: El, libelle: string, href: string): string {
  const u = parse(unite(modele).outerHTML).firstChild as El;
  const a = u.tagName === "A" ? u : u.querySelector("a")!;
  for (const el of [u, a]) {
    el.removeAttribute("id"); el.removeAttribute("data-axs-el");
    for (const k of Object.keys(el.attributes)) if (/^on/i.test(k)) el.removeAttribute(k);
  }
  a.classList.remove("active");
  a.setAttribute("href", href);
  a.set_content(esc(libelle));
  if (u !== a) u.set_content(a.outerHTML);
  return u.outerHTML;
}

// ─── Validation des paramètres ───────────────────────────────────────────────
const MAX_PRINCIPAL = 12, MAX_COLONNES = 6, MAX_LIENS_COLONNE = 12;

function libelle(v: unknown, quoi = "libelle"): string {
  if (typeof v !== "string" || !v.trim() || v.trim().length > 60) throw invalide(`« ${quoi} » : texte de 1 à 60 caractères.`);
  return v.trim().replace(/[<>]/g, "");
}
function liens(v: unknown, slug: string, max: number): LienMenu[] {
  if (!Array.isArray(v) || v.length > max) throw invalide(`Liste d'au plus ${max} liens { libelle, lien } attendue.`);
  return v.map((x) => ({ libelle: libelle(x?.libelle), lien: normaliserLien(x?.lien, slug) }));
}
function colonnes(v: unknown, slug: string): ColonnePied[] {
  if (!Array.isArray(v) || v.length > MAX_COLONNES) throw invalide(`« pied » : au plus ${MAX_COLONNES} colonnes { titre, liens }.`);
  return v.map((c) => ({ titre: libelle(c?.titre, "titre"), liens: liens(c?.liens ?? [], slug, MAX_LIENS_COLONNE) }));
}
const entier = (v: unknown, nom: string, max: number) => {
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > max) throw invalide(`« ${nom} » : entier entre 0 et ${max}.`);
  return v as number;
};
const nav = (cfg: ThemeConfig): NavigationSocle => ((cfg as any).navigation ??= {});
const piedDesign = (cfg: ThemeConfig) => sectionsChrome(cfg).some((s) => s.zone === "footer");
const enteteDesign = (cfg: ThemeConfig) => sectionsChrome(cfg).find((s) => s.zone === "header");
// Le pied du socle n'est pas affiché quand la boutique a un pied de page de design.
function exigerPiedSocle(cfg: ThemeConfig) {
  if (piedDesign(cfg)) throw invalide("Cette boutique affiche le pied de page de son design : modifie ses liens avec axso_builder_update_menu (menus listés par axso_builder_get_navigation). Une colonne du socle n'y serait pas affichée.");
}

/** Liste du socle visée par un identifiant de menu (créée depuis les liens par défaut pour le menu principal). */
function listeSocle(cfg: ThemeConfig, menu: string, d: DonneesBoutique): LienMenu[] {
  const n = nav(cfg);
  if (menu === "principal") return (n.principal = n.principal?.length ? n.principal : principalParDefaut(cfg, d));
  const i = /^pied:(\d+)$/.exec(menu);
  const col = i ? n.pied?.[Number(i[1])] : undefined;
  if (!col) throw introuvable(`Menu « ${menu} » introuvable : relis axso_builder_get_navigation.`);
  return col.liens;
}

const MENU = { type: "string", description: "Identifiant de menu donné par axso_builder_get_navigation (« principal », « pied:0 », « <section>~<n> » pour un design)" };
const LIEN = { type: "string", description: "produits, collections/<slug>, p/<page>, a-propos, contact, mon-compte, wishlist, panier, produits/<id>, #ancre, https://…, https://wa.me/…, tel:+…, mailto:…" };
const LIENS = { type: "array", items: { type: "object", properties: { libelle: { type: "string" }, lien: LIEN }, required: ["libelle", "lien"] } };
const COLONNES = { type: "array", items: { type: "object", properties: { titre: { type: "string" }, liens: LIENS }, required: ["titre", "liens"] } };

// ─── Opérations ──────────────────────────────────────────────────────────────
const updateNavigation: OperationBuilder = {
  nom: "axso_builder_update_navigation", capacite: "builder_navigation",
  description: "Remplace d'un coup le menu principal et/ou les colonnes du pied de page du SOCLE (boutique sans design importé, ou pages du socle). Liste vide = retour aux liens par défaut. Pour un design importé, modifie ses liens avec axso_builder_update_menu.",
  parameters: { type: "object", properties: { principal: LIENS, pied: COLONNES } },
  appliquer: (cfg, a, d) => {
    if (a.principal === undefined && a.pied === undefined) throw invalide("Indique « principal » et/ou « pied ».");
    const n = nav(cfg);
    if (a.principal !== undefined) n.principal = liens(a.principal, d.slug, MAX_PRINCIPAL);
    if (a.pied !== undefined) { if ((a.pied as unknown[]).length) exigerPiedSocle(cfg); n.pied = colonnes(a.pied, d.slug); }
    return cfg;
  },
};

const addMenu: OperationBuilder = {
  nom: "axso_builder_add_menu", capacite: "builder_navigation",
  description: "Ajoute une colonne de liens au pied de page du socle (ex. « Aide » : livraison, contact, suivi). Un design importé ne reçoit pas de nouvelle colonne : ajoute des liens à une colonne existante (axso_builder_update_menu, action « ajouter »).",
  parameters: { type: "object", properties: { titre: { type: "string" }, liens: LIENS, position: { type: "integer", minimum: 0 } }, required: ["titre"] },
  appliquer: (cfg, a, d) => {
    exigerPiedSocle(cfg);
    const n = nav(cfg);
    n.pied ??= [];
    if (n.pied.length >= MAX_COLONNES) throw invalide(`Au plus ${MAX_COLONNES} colonnes dans le pied de page.`);
    const col = { titre: libelle(a.titre, "titre"), liens: liens(a.liens ?? [], d.slug, MAX_LIENS_COLONNE) };
    n.pied.splice(a.position === undefined ? n.pied.length : entier(a.position, "position", n.pied.length), 0, col);
    return cfg;
  },
};

const updateMenu: OperationBuilder = {
  nom: "axso_builder_update_menu", capacite: "builder_navigation",
  description: "Modifie un menu (socle ou design importé) : « modifier » le libellé et/ou la cible du lien n° index, « ajouter » un lien (dans un design : copie d'un lien voisin, même style) à la position voulue, « supprimer » le lien n° index, « renommer » le titre de la colonne.",
  parameters: {
    type: "object", required: ["menu", "action"],
    properties: {
      menu: MENU, action: { type: "string", enum: ["modifier", "ajouter", "supprimer", "renommer"] },
      index: { type: "integer", minimum: 0, description: "Lien visé (modifier, supprimer)" }, position: { type: "integer", minimum: 0, description: "ajouter : rang du nouveau lien (défaut : à la fin)" },
      libelle: { type: "string" }, lien: LIEN, titre: { type: "string", description: "renommer" },
    },
  },
  appliquer: (cfg, a, d) => {
    if (typeof a.menu !== "string") throw invalide("« menu » manquant.");
    if (!["modifier", "ajouter", "supprimer", "renommer"].includes(a.action)) throw invalide("« action » : modifier, ajouter, supprimer ou renommer.");
    if (a.menu.includes("~")) return avecGroupeDesign(cfg, a.menu, (groupe) => {
      if (a.action === "renommer") {
        const h = conteneur(groupe[0]).previousElementSibling;
        if (!h || !/^H[1-6]$/.test(h.tagName) || h.children.length) throw invalide("Ce menu n'a pas de titre modifiable.");
        h.set_content(esc(libelle(a.titre, "titre")));
      } else if (a.action === "ajouter") {
        const pos = a.position === undefined ? groupe.length : entier(a.position, "position", groupe.length);
        const modele = groupe[Math.max(0, pos - 1)];
        const html = cloner(modele, libelle(a.libelle), hrefDe(normaliserLien(a.lien, d.slug), d.slug));
        unite(pos === 0 ? groupe[0] : modele).insertAdjacentHTML(pos === 0 ? "beforebegin" : "afterend", html);
      } else {
        const el = groupe[entier(a.index, "index", groupe.length - 1)];
        if (a.action === "supprimer") { unite(el).remove(); return; }
        if (a.libelle === undefined && a.lien === undefined) throw invalide("Indique « libelle » et/ou « lien ».");
        if (a.lien !== undefined) el.setAttribute("href", hrefDe(normaliserLien(a.lien, d.slug), d.slug));
        if (a.libelle !== undefined) {
          if (el.children.length) throw invalide("Ce lien contient une icône ou un compteur : seule sa cible peut être modifiée.");
          el.set_content(esc(libelle(a.libelle)));
        }
      }
    });
    if (a.action === "renommer") {
      const col = /^pied:(\d+)$/.exec(a.menu) && nav(cfg).pied?.[Number(a.menu.slice(5))];
      if (!col) throw invalide("Seule une colonne du pied de page (pied:<n>) a un titre.");
      col.titre = libelle(a.titre, "titre");
      return cfg;
    }
    const l = listeSocle(cfg, a.menu, d);
    if (a.action === "ajouter") {
      if (l.length >= (a.menu === "principal" ? MAX_PRINCIPAL : MAX_LIENS_COLONNE)) throw invalide("Ce menu est plein : retire un lien d'abord.");
      l.splice(a.position === undefined ? l.length : entier(a.position, "position", l.length), 0, { libelle: libelle(a.libelle), lien: normaliserLien(a.lien, d.slug) });
    } else {
      const i = entier(a.index, "index", l.length - 1);
      if (a.action === "supprimer") l.splice(i, 1);
      else {
        if (a.libelle === undefined && a.lien === undefined) throw invalide("Indique « libelle » et/ou « lien ».");
        l[i] = { libelle: a.libelle === undefined ? l[i].libelle : libelle(a.libelle), lien: a.lien === undefined ? l[i].lien : normaliserLien(a.lien, d.slug) };
      }
    }
    return cfg;
  },
};

const deleteMenu: OperationBuilder = {
  nom: "axso_builder_delete_menu", capacite: "builder_navigation",
  description: "Supprime un menu : « principal » revient aux liens par défaut, « pied:<n> » retire la colonne, un menu de design retire la colonne de liens et son titre (jamais l'en-tête ou le pied entier).",
  parameters: { type: "object", properties: { menu: MENU }, required: ["menu"] },
  appliquer: (cfg, a) => {
    if (typeof a.menu !== "string") throw invalide("« menu » manquant.");
    if (a.menu.includes("~")) return avecGroupeDesign(cfg, a.menu, (groupe) => {
      const c = conteneur(groupe[0]);
      if (["HEADER", "FOOTER", "NAV"].includes(c.tagName) || !c.parentNode || !(c.parentNode as El).tagName) throw invalide("Ce menu est la navigation même de l'en-tête ou du pied : supprime ses liens un par un (axso_builder_update_menu).");
      const h = c.previousElementSibling;
      if (h && /^H[1-6]$/.test(h.tagName)) h.remove();
      c.remove();
    });
    const n = nav(cfg);
    if (a.menu === "principal") { delete n.principal; return cfg; }
    const i = /^pied:(\d+)$/.exec(a.menu);
    if (!i || !n.pied?.[Number(i[1])]) throw introuvable(`Menu « ${a.menu} » introuvable.`);
    n.pied.splice(Number(i[1]), 1);
    return cfg;
  },
};

const reorderMenuItems: OperationBuilder = {
  nom: "axso_builder_reorder_menu_items", capacite: "builder_navigation",
  description: "Réordonne les liens d'un menu : « ordre » donne les index actuels dans le nouvel ordre (ex. [2, 0, 1] met le 3ᵉ lien en premier).",
  parameters: { type: "object", properties: { menu: MENU, ordre: { type: "array", items: { type: "integer", minimum: 0 } } }, required: ["menu", "ordre"] },
  appliquer: (cfg, a, d) => {
    if (typeof a.menu !== "string") throw invalide("« menu » manquant.");
    const permutation = (n: number): number[] => {
      const o = a.ordre;
      if (!Array.isArray(o) || o.length !== n || new Set(o).size !== n || o.some((x: unknown) => !Number.isInteger(x) || (x as number) < 0 || (x as number) >= n)) throw invalide(`« ordre » doit contenir chacun des index 0 à ${n - 1} une seule fois.`);
      return o;
    };
    if (a.menu.includes("~")) return avecGroupeDesign(cfg, a.menu, (groupe) => {
      const unites = groupe.map(unite);
      const html = permutation(unites.length).map((k) => unites[k].outerHTML);
      unites.forEach((u, j) => u.replaceWith(html[j]));
    });
    const l = listeSocle(cfg, a.menu, d);
    const copie = [...l];
    permutation(l.length).forEach((k, j) => { l[j] = copie[k]; });
    return cfg;
  },
};

// ─── En-tête et pied de page ─────────────────────────────────────────────────
const TYPES_NAV = ["classic", "centered", "floating", "minimal", "mega", "transparent-scroll"];
const STYLES_NAV = ["light", "dark", "glass", "transparent"];
const HEX = /^#[0-9a-f]{3,8}$/i;

const updateHeader: OperationBuilder = {
  nom: "axso_builder_update_header", capacite: "builder_navigation",
  description: "Règle l'en-tête : disposition (classic, centered, floating, minimal = menu burger aussi sur ordinateur, mega = panneau des collections, transparent-scroll), apparence (light, dark, glass, transparent), collant au défilement, hauteur, recherche, favoris, barre d'annonce (socle) et logo. Valable pour le socle ET le design importé (réglages appliqués par-dessus le design). Le panier, le compte et le menu mobile sont toujours présents (non réglables). Pour un bouton d'appel à l'action, modifie un lien du menu.",
  parameters: {
    type: "object",
    properties: {
      type: { type: "string", enum: TYPES_NAV }, style: { type: "string", enum: STYLES_NAV }, sticky: { type: "boolean" },
      hauteur: { type: "string", enum: ["48px", "64px", "80px"] }, recherche: { type: "boolean" }, favoris: { type: "boolean" },
      annonce: { type: "object", description: "Barre d'annonce au-dessus de l'en-tête (accueil du socle)", properties: { actif: { type: "boolean" }, texte: { type: "string" }, couleur_fond: { type: "string" }, couleur_texte: { type: "string" }, defilant: { type: "boolean" } } },
      logo_url: { type: "string", description: "Design importé : image du logo dans l'en-tête (https). Pour le logo de la boutique, utilise l'outil axso_builder_update_header avec logo_media_id." },
      logo_alt: { type: "string" },
    },
  },
  appliquer: (cfg, a, d) => {
    const ns: Record<string, unknown> = {};
    if (a.type !== undefined) { if (!TYPES_NAV.includes(a.type)) throw invalide("« type » inconnu."); ns.type = a.type; }
    if (a.style !== undefined) { if (!STYLES_NAV.includes(a.style)) throw invalide("« style » inconnu."); ns.style = a.style; }
    if (a.hauteur !== undefined) { if (!["48px", "64px", "80px"].includes(a.hauteur)) throw invalide("« hauteur » : 48px, 64px ou 80px."); ns.hauteur = a.hauteur; }
    for (const [cle, champ] of [["sticky", "sticky"], ["recherche", "showSearch"], ["favoris", "showWishlist"]] as const) {
      if (a[cle] === undefined) continue;
      if (typeof a[cle] !== "boolean") throw invalide(`« ${cle} » : vrai ou faux.`);
      ns[champ] = a[cle];
    }
    const touche = Object.keys(ns).length > 0;
    if (touche) {
      cfg.navigationStyle = { ...cfg.navigationStyle, ...ns };
      // Sur un design importé, ces réglages ne s'appliquent que si le panneau « navigation » est marqué modifié.
      if (enteteDesign(cfg)) cfg.reglagesDesign = { ...cfg.reglagesDesign, navigation: true };
    }
    if (a.annonce !== undefined) {
      if (cfg.builderTree?.length) throw invalide("La barre d'annonce n'est affichée que par l'accueil du socle ; cette boutique affiche son design (sections) : ajoute plutôt un bandeau dans le design.");
      const an = a.annonce ?? {};
      const p: Record<string, unknown> = {};
      if (an.actif !== undefined) p.actif = !!an.actif;
      if (an.defilant !== undefined) p.defilant = !!an.defilant;
      if (an.texte !== undefined) { if (typeof an.texte !== "string" || an.texte.length > 200) throw invalide("« annonce.texte » : 200 caractères au plus."); p.texte = an.texte.replace(/[<>]/g, ""); }
      for (const [cle, champ] of [["couleur_fond", "couleurFond"], ["couleur_texte", "couleurTexte"]] as const) {
        if (an[cle] === undefined) continue;
        if (!HEX.test(an[cle])) throw invalide(`« annonce.${cle} » : couleur #rrggbb.`);
        p[champ] = an[cle];
      }
      cfg.sections = { ...cfg.sections, annonce: { ...cfg.sections?.annonce, ...p } as any };
    }
    if (a.logo_url !== undefined) {
      if (!adresseImageSure(a.logo_url) || !a.logo_url.startsWith("https://")) throw invalide("« logo_url » : adresse https d'une image.");
      const ent = enteteDesign(cfg);
      if (!ent) throw invalide("Le logo du socle est une donnée de la boutique, pas du brouillon : appelle l'outil axso_builder_update_header avec logo_media_id.");
      const racine = parse(ent.embed.config!.html);
      const logo = racine.querySelector(".logo") ?? racine.querySelector('[class*="logo"]');
      if (!logo) throw invalide("L'en-tête de ce design n'a pas d'emplacement de logo repérable (classe « logo »).");
      const alt = typeof a.logo_alt === "string" ? a.logo_alt.slice(0, 120) : d.nom;
      logo.set_content(`<img src="${esc(a.logo_url)}" alt="${esc(alt)}" style="height:40px;width:auto;display:block">`);
      ent.embed.config = { ...ent.embed.config, html: racine.toString() };
    } else if (!touche && a.annonce === undefined) throw invalide("Rien à modifier.");
    return cfg;
  },
};

const updateFooter: OperationBuilder = {
  nom: "axso_builder_update_footer", capacite: "builder_navigation",
  description: "Règle le pied de page : colonnes de liens du socle (remplace la liste), bloc newsletter (accueil du socle), texte du copyright (design importé). Les réseaux sociaux sont une donnée de la boutique : appelle l'outil axso_builder_update_footer directement avec « reseaux ». Moyens de paiement et mentions légales : non réglables (rendus automatiquement).",
  parameters: {
    type: "object",
    properties: {
      colonnes: COLONNES,
      newsletter: { type: "object", properties: { actif: { type: "boolean" }, titre: { type: "string" }, texte: { type: "string" }, cta: { type: "string" }, placeholder: { type: "string" } } },
      copyright: { type: "string", description: "Design importé : texte du copyright (ex. « © 2026 Ma Boutique »)" },
    },
  },
  appliquer: (cfg, a, d) => {
    if (a.reseaux !== undefined) throw invalide("Les réseaux sociaux ne sont pas dans le brouillon : appelle l'outil axso_builder_update_footer directement.");
    if (a.colonnes === undefined && a.newsletter === undefined && a.copyright === undefined) throw invalide("Rien à modifier.");
    if (a.colonnes !== undefined) {
      if ((a.colonnes as unknown[])?.length) exigerPiedSocle(cfg);
      nav(cfg).pied = colonnes(a.colonnes, d.slug);
    }
    if (a.newsletter !== undefined) {
      if (cfg.builderTree?.length) throw invalide("Le bloc newsletter du socle n'est pas affiché sur une boutique à design (sections).");
      const n = a.newsletter ?? {}, p: Record<string, unknown> = {};
      if (n.actif !== undefined) p.actif = !!n.actif;
      for (const [cle, champ, max] of [["titre", "titre", 80], ["texte", "texte", 300], ["cta", "ctaTexte", 30], ["placeholder", "placeholder", 60]] as const) {
        if (n[cle] === undefined) continue;
        if (typeof n[cle] !== "string" || n[cle].length > max) throw invalide(`« newsletter.${cle} » : ${max} caractères au plus.`);
        p[champ] = n[cle].replace(/[<>]/g, "");
      }
      cfg.sections = { ...cfg.sections, newsletter: { ...cfg.sections?.newsletter, ...p } as any };
    }
    if (a.copyright !== undefined) {
      if (typeof a.copyright !== "string" || !a.copyright.trim() || a.copyright.length > 120) throw invalide("« copyright » : 1 à 120 caractères.");
      const pied = sectionsChrome(cfg).find((s) => s.zone === "footer");
      if (!pied) throw invalide("Le copyright du socle est fixe (« © année Boutique ») : non modifiable.");
      const racine = parse(pied.embed.config!.html);
      const el = racine.querySelectorAll("*").find((x) => !x.children.length && /^\s*(©|&copy;|\(c\))/i.test(x.innerHTML));
      if (!el) throw invalide("Aucun texte de copyright (commençant par ©) dans le pied de page de ce design.");
      el.set_content(esc(a.copyright.trim()));
      pied.embed.config = { ...pied.embed.config, html: racine.toString() };
    }
    return cfg;
  },
};

// ─── Médias dans le brouillon ────────────────────────────────────────────────
const replaceAsset: OperationBuilder = {
  nom: "axso_builder_replace_asset", capacite: "builder_assets",
  description: "Remplace une image (ou vidéo) PARTOUT où le brouillon l'utilise : blocs, sections du design, logo du design, réglages. Le design d'origine figé n'est pas réécrit.",
  parameters: { type: "object", properties: { ancienne_url: { type: "string" }, nouvelle_url: { type: "string", description: "https" } }, required: ["ancienne_url", "nouvelle_url"] },
  appliquer: (cfg, a) => {
    if (typeof a.ancienne_url !== "string" || !a.ancienne_url.trim() || a.ancienne_url.length > 2000) throw invalide("« ancienne_url » manquante.");
    if (!adresseImageSure(a.nouvelle_url)) throw invalide("« nouvelle_url » : adresse https d'une image ou d'une vidéo.");
    const r = remplacerImage(cfg, a.ancienne_url.trim(), a.nouvelle_url);
    if (!r.n) throw introuvable(`Cette image n'est utilisée nulle part dans le brouillon${r.figes ? ` (seulement dans le design d'origine figé, ${r.figes} fois)` : ""}.`);
    return r.cfg;
  },
};

const placeAsset: OperationBuilder = {
  nom: "axso_builder_place_asset", capacite: "builder_assets",
  description: "Place une image ou une vidéo dans le brouillon : dans un bloc (image, vidéo, galerie, logos), dans une image du design (element = identifiant data-axs-el), ou dans la bannière du socle (hero : « video » ou « diaporama »).",
  parameters: {
    type: "object", required: ["url"],
    properties: {
      url: { type: "string", description: "https" }, bloc_id: { type: "string" }, element: { type: "string", description: "data-axs-el d'une image du design" },
      hero: { type: "string", enum: ["video", "diaporama"] }, alt: { type: "string" },
    },
  },
  appliquer: (cfg, a) => {
    if (!adresseImageSure(a.url) || !a.url.startsWith("https://")) throw invalide("« url » : adresse https d'un média.");
    if ([a.bloc_id, a.element, a.hero].filter((x) => x !== undefined).length !== 1) throw invalide("Indique UNE cible : bloc_id, element ou hero.");
    const alt = typeof a.alt === "string" ? a.alt.replace(/[<>"]/g, "").slice(0, 125) : undefined;
    if (a.element !== undefined) {
      try { cfg.builderTree = appliquerActionDesign(cfg.builderTree ?? [], { action: "image", element: String(a.element), valeur: a.url, alt }); }
      catch (e) { throw invalide((e as Error).message); }
      return cfg;
    }
    if (a.hero !== undefined) {
      if (cfg.builderTree?.length) throw invalide("La bannière du socle n'est pas affichée sur une boutique à design : vise une image du design (element) ou un bloc.");
      const h = cfg.sections?.hero ?? ({} as ThemeConfig["sections"]["hero"]);
      if (a.hero === "video") cfg.sections = { ...cfg.sections, hero: { ...h, videoUrl: a.url, style: "video" } };
      else if (a.hero === "diaporama") cfg.sections = { ...cfg.sections, hero: { ...h, slideshowImages: [...(h.slideshowImages ?? []), a.url].slice(-10), style: "slideshow" } };
      else throw invalide("« hero » : video ou diaporama.");
      return cfg;
    }
    const arbres = [cfg.builderTree ?? [], ...Object.values((cfg as any).pagesPerso ?? {}).map((p: any) => p?.builderTree ?? [])];
    const bloc = arbres.map((t) => findNode(t, String(a.bloc_id))).find(Boolean);
    if (!bloc) throw introuvable(`Bloc « ${a.bloc_id} » introuvable dans le brouillon.`);
    const c = (bloc.config ??= {});
    if (bloc.type === "image") { c.url = a.url; if (alt !== undefined) c.alt = alt; }
    else if (bloc.type === "video") c.videoUrl = a.url;
    else if (bloc.type === "gallery") c.images = [...(c.images ?? []), a.url].slice(-24);
    else if (bloc.type === "brands") c.logos = [...(c.logos ?? []), a.url].slice(-24);
    else throw invalide(`Un bloc « ${bloc.type} » ne reçoit pas de média (image, video, gallery, brands).`);
    return cfg;
  },
};

export const OPERATIONS: OperationBuilder[] = [updateNavigation, addMenu, updateMenu, deleteMenu, reorderMenuItems, updateHeader, updateFooter, replaceAsset, placeAsset];
