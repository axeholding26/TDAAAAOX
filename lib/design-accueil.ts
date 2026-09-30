// Page d'accueil (config.builderTree) vue et modifiée par AXIA, avec les mêmes
// gestes que le Constructeur à la main : sections du design (bloc embed-html)
// à masquer/déplacer/supprimer/dupliquer, et leurs éléments (titre, texte,
// bouton, lien, image) à réécrire ou styler — identifiés par `data-axs-el`
// comme au clic dans l'aperçu (app/(dashboard)/dashboard/builder/boutique/elements-dom.ts),
// styles dans config.elementStyles du bloc (lib/element-styles.ts). Serveur
// uniquement (node-html-parser).
import { parse, type HTMLElement } from "node-html-parser";
import type { BlockNode, ThemeConfig } from "@/lib/theme-config";
import { convertirDesignEnSections, type Analyseur, type ElementDesign } from "@/lib/decoupage-design";
import { moveNode, removeNode, duplicateNode, toggleNodeActif, zoneDe, findNode } from "@/lib/block-tree";
import { majStyleElement, type ElementStyle, type EtatStyle, type ElementStyles } from "@/lib/element-styles";

const ATTR_EL = "data-axs-el";
const genElId = () => `el_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const analyseurServeur: Analyseur = (html) => parse(html).children as unknown as ElementDesign[];

/**
 * Découpe le design en sections s'il ne l'est pas encore (sinon la vitrine,
 * qui préfère builderTree à builderHtml, perdrait tout le design dès le
 * premier bloc ajouté par AXIA sans que le Constructeur ait été ouvert).
 */
export function assurerSections(config: ThemeConfig): ThemeConfig {
  return convertirDesignEnSections(config, analyseurServeur);
}

const embedDe = (section: BlockNode) => section.children?.[0]?.children?.[0]?.children?.[0];
const estDesign = (section: BlockNode) => embedDe(section)?.type === "embed-html";

const SELECTEUR = "h1,h2,h3,h4,h5,h6,p,a,button,img,li,span,small,strong,label";
const TYPES: Record<string, string> = { h1: "Titre", h2: "Titre", h3: "Titre", h4: "Sous-titre", h5: "Sous-titre", h6: "Sous-titre", p: "Texte", a: "Lien", button: "Bouton", img: "Image", li: "Élément de liste" };

function elementsEditables(racine: HTMLElement): HTMLElement[] {
  return racine.querySelectorAll(SELECTEUR).filter((el) => {
    if (el.closest("svg")) return false;
    const tag = el.rawTagName.toLowerCase();
    if (tag === "img") return !!el.getAttribute("src");
    if (tag === "a") return !!el.getAttribute("href");
    return el.children.length === 0 && el.textContent.trim().length > 0;
  }).slice(0, 40);
}

/** Pose un identifiant sur les éléments éditables qui n'en ont pas (comme au premier clic). */
function identifier(html: string): { html: string; change: boolean } {
  const racine = parse(html);
  let change = false;
  for (const el of elementsEditables(racine)) {
    if (!el.getAttribute(ATTR_EL)) { el.setAttribute(ATTR_EL, genElId()); change = true; }
  }
  return { html: change ? racine.toString() : html, change };
}

function mapEmbeds(tree: BlockNode[], f: (embed: BlockNode) => BlockNode): BlockNode[] {
  return tree.map((s) => {
    const embed = estDesign(s) ? embedDe(s)! : null;
    if (!embed) return s;
    const neuf = f(embed);
    if (neuf === embed) return s;
    const [row] = s.children!; const [col] = row.children!;
    return { ...s, children: [{ ...row, children: [{ ...col, children: [neuf] }] }] };
  });
}

/** Résumé lisible de la page pour AXIA (identifiants posés si besoin, d'où le nouvel arbre renvoyé). */
export function decrireAccueil(tree: BlockNode[]): { tree: BlockNode[]; resume: string } {
  const nouvel = mapEmbeds(tree, (embed) => {
    const { html, change } = identifier(embed.config?.html || "");
    return change ? { ...embed, config: { ...embed.config, html } } : embed;
  });
  const lignes: string[] = [];
  for (const s of nouvel) {
    const nom = s.config?.nom || s.type;
    lignes.push(`• Section « ${nom} » [${zoneDe(s)}] id ${s.id}${s.actif === false ? " (masquée)" : ""}${estDesign(s) ? "" : " (bloc du Constructeur : utilise personnaliser_page_boutique)"}`);
    if (!estDesign(s)) continue;
    const embed = embedDe(s)!;
    const styles = (embed.config?.elementStyles ?? {}) as ElementStyles;
    for (const el of elementsEditables(parse(embed.config?.html || ""))) {
      const tag = el.rawTagName.toLowerCase();
      const id = el.getAttribute(ATTR_EL);
      const type = TYPES[tag] ?? "Texte";
      const detail = tag === "img" ? `image ${el.getAttribute("src")}` :
        `« ${el.textContent.trim().replace(/\s+/g, " ").slice(0, 90)} »${tag === "a" ? ` → ${el.getAttribute("href")}` : ""}`;
      lignes.push(`   - ${id} ${type} : ${detail}${styles[id!] ? " (stylé)" : ""}`);
    }
  }
  return { tree: nouvel, resume: lignes.join("\n") || "Page d'accueil vide." };
}

export type ActionDesign =
  | { action: "texte"; element: string; valeur: string }
  | { action: "lien"; element: string; valeur: string }
  | { action: "image"; element: string; valeur: string; alt?: string }
  | { action: "style"; element: string; style: Partial<ElementStyle>; etat?: EtatStyle }
  | { action: "masquer_section" | "afficher_section" | "supprimer_section" | "dupliquer_section"; section: string }
  | { action: "deplacer_section"; section: string; index: number };

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const urlSure = (u: string) => /^(https?:\/\/|\/|#|mailto:|tel:|[a-z0-9-]+(\/|$))/i.test(u.trim()) && !/^\s*javascript:/i.test(u);
const ETATS: EtatStyle[] = ["base", "hover", "tablet", "mobile"];
const CHAMPS_STYLE = new Set(["police", "taille", "graisse", "interligne", "espacementLettres", "casse", "alignement", "couleur", "fond", "degrade", "imageFond", "bordureEpaisseur", "bordureCouleur", "rayon", "paddingHaut", "paddingDroite", "paddingBas", "paddingGauche", "margeHaut", "margeDroite", "margeBas", "margeGauche", "largeur", "largeurMax", "hauteur", "masque"]);

function modifierElementHtml(html: string, id: string, f: (el: HTMLElement) => void): string | null {
  const racine = parse(html);
  const el = racine.querySelector(`[${ATTR_EL}="${id}"]`);
  if (!el) return null;
  f(el);
  return racine.toString();
}

/** Applique une action ; lève une erreur lisible si elle est impossible (rien n'est alors enregistré). */
export function appliquerActionDesign(tree: BlockNode[], a: ActionDesign): BlockNode[] {
  if ("section" in a) {
    const s = findNode(tree, a.section);
    if (!s || !tree.includes(s)) throw new Error(`Section introuvable : ${a.section}`);
    switch (a.action) {
      case "masquer_section": return s.actif === false ? tree : toggleNodeActif(tree, s.id);
      case "afficher_section": return s.actif === false ? toggleNodeActif(tree, s.id) : tree;
      case "supprimer_section": return removeNode(tree, s.id);
      case "dupliquer_section": return duplicateNode(tree, s.id);
      case "deplacer_section": {
        const memeZone = tree.filter((n) => zoneDe(n) === zoneDe(s));
        const cible = memeZone[Math.max(0, Math.min(a.index, memeZone.length - 1))];
        return moveNode(tree, s.id, null, tree.indexOf(cible));
      }
    }
  }

  let trouve = false;
  const nouvel = mapEmbeds(tree, (embed) => {
    const html = embed.config?.html || "";
    if (trouve || !html.includes(`${ATTR_EL}="${a.element}"`)) return embed;
    trouve = true;
    if (a.action === "style") {
      const etat = a.etat && ETATS.includes(a.etat) ? a.etat : "base";
      const patch = Object.fromEntries(Object.entries(a.style ?? {}).filter(([k]) => CHAMPS_STYLE.has(k)));
      if (!Object.keys(patch).length) throw new Error("Aucun style valide reçu.");
      return { ...embed, config: { ...embed.config, elementStyles: majStyleElement(embed.config?.elementStyles, a.element, etat, patch) } };
    }
    const neuf = modifierElementHtml(html, a.element, (el) => {
      const tag = el.rawTagName.toLowerCase();
      if (a.action === "texte") {
        if (el.children.length) throw new Error("Cet élément contient d'autres éléments : modifie plutôt ses éléments enfants.");
        el.set_content(echapper(a.valeur));
      } else if (a.action === "lien") {
        if (!urlSure(a.valeur)) throw new Error(`Lien refusé : ${a.valeur}`);
        el.setAttribute("href", a.valeur.trim());
      } else if (a.action === "image") {
        if (tag !== "img") throw new Error("Cet élément n'est pas une image.");
        if (!/^(https?:\/\/|\/)/i.test(a.valeur.trim())) throw new Error("L'image doit être une URL (https://…).");
        el.setAttribute("src", a.valeur.trim());
        if (a.alt != null) el.setAttribute("alt", echapper(a.alt));
      }
    });
    return neuf == null ? embed : { ...embed, config: { ...embed.config, html: neuf } };
  });
  if (!trouve) throw new Error(`Élément introuvable : ${a.element}. Relis la page (actions vides) pour obtenir les identifiants.`);
  return nouvel;
}
