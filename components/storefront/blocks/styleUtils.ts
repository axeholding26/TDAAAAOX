import type { CSSProperties } from "react";
import type { BlockStyleOverrides } from "@/lib/theme-config";
import { fontEntry } from "@/lib/theme-fonts";
import { importPolices } from "@/lib/element-styles";

// Seuils partagés par tout le système responsive du constructeur libre —
// mêmes coupures que le sélecteur Device du tableau de bord
// (Desktop/Tablette/Mobile). Utilisés à la fois pour les media queries
// réelles côté storefront et pour les container queries côté canevas (voir
// blockResponsiveCss ci-dessous).
export const BREAKPOINT_TABLET_MAX = "1023px";
export const BREAKPOINT_MOBILE_MAX = "639px";

// Aplatit une surcharge de style en paires CSS kebab-case:valeur — un seul
// endroit pour cette logique, réutilisé par blockStyleToCss (desktop, style
// inline) et blockResponsiveCss (tablette/mobile, @container). `width` est
// volontairement absent ici : un champ largeur ne veut dire "colonne
// redimensionnée" (flex-basis fixe) que combiné à flex-grow/shrink forcés à
// 0, traité séparément dans blockStyleToCss pour ne pas dupliquer cette
// intention dans les surcharges responsives.
// Blocs simples (titre, texte, bouton, image) : leurs réglages visuels vont sur
// l'élément affiché (marqué data-axs-cible) et non sur l'enveloppe — le widget
// y impose sa couleur, sa taille, sa police, son arrondi… qui masquaient ceux
// du panneau. Espacements et dimensions restent sur l'enveloppe.
export const TYPES_A_CIBLE = new Set(["heading", "text", "button", "image"]);
const estVisuel = (prop: string) => /^(color|font-|text-align|line-height|letter-spacing|background|border)/.test(prop);
const partager = (props: Record<string, string>) => {
  const visuels: Record<string, string> = {}, autres: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) (estVisuel(k) ? visuels : autres)[k] = v;
  return { visuels, autres };
};

function flattenStyleKebab(style?: Omit<BlockStyleOverrides, "responsive" | "customClass" | "visibility" | "width">): Record<string, string> {
  if (!style) return {};
  const out: Record<string, string> = {};
  if (style.spacing?.pt) out["padding-top"] = style.spacing.pt;
  if (style.spacing?.pb) out["padding-bottom"] = style.spacing.pb;
  if (style.spacing?.pl) out["padding-left"] = style.spacing.pl;
  if (style.spacing?.pr) out["padding-right"] = style.spacing.pr;
  if (style.spacing?.mt) out["margin-top"] = style.spacing.mt;
  if (style.spacing?.mb) out["margin-bottom"] = style.spacing.mb;
  if (style.spacing?.ml) out["margin-left"] = style.spacing.ml;
  if (style.spacing?.mr) out["margin-right"] = style.spacing.mr;
  if (style.background?.gradient) out["background"] = style.background.gradient;
  else if (style.background?.color) out["background-color"] = style.background.color;
  if (style.background?.image) {
    out["background-image"] = `url(${style.background.image})`;
    out["background-size"] = "cover";
    out["background-position"] = "center";
  }
  if (style.typography?.color) out["color"] = style.typography.color;
  if (style.typography?.taille) out["font-size"] = style.typography.taille;
  if (style.typography?.poids) out["font-weight"] = style.typography.poids;
  if (style.typography?.align) out["text-align"] = style.typography.align;
  if (style.typography?.police) out["font-family"] = `'${fontEntry(style.typography.police)?.label ?? style.typography.police}', sans-serif`;
  if (style.typography?.interligne) out["line-height"] = style.typography.interligne;
  if (style.typography?.espacement) out["letter-spacing"] = style.typography.espacement;
  if (style.border?.radius) out["border-radius"] = style.border.radius;
  if (style.border?.width) out["border"] = `${style.border.width} solid ${style.border.color || "currentColor"}`;
  return out;
}

// Convertit les surcharges de style d'un bloc (BlockStyleOverrides) en objet
// style React — un seul endroit, partagé par tous les conteneurs/widgets du
// constructeur libre. Toujours la valeur "desktop" (défaut) : les
// surcharges tablette/mobile ne peuvent pas passer par du style inline
// (spécificité trop forte pour être re-surchargées par une media query) —
// voir blockResponsiveCss.
export function blockStyleToCss(style?: BlockStyleOverrides, cible = false): CSSProperties {
  const flat = cible ? partager(flattenStyleKebab(style)).autres : flattenStyleKebab(style);
  const css: CSSProperties = {};
  if (flat["padding-top"]) css.paddingTop = flat["padding-top"];
  if (flat["padding-bottom"]) css.paddingBottom = flat["padding-bottom"];
  if (flat["padding-left"]) css.paddingLeft = flat["padding-left"];
  if (flat["padding-right"]) css.paddingRight = flat["padding-right"];
  if (flat["margin-top"]) css.marginTop = flat["margin-top"];
  if (flat["margin-bottom"]) css.marginBottom = flat["margin-bottom"];
  if (flat["margin-left"]) css.marginLeft = flat["margin-left"];
  if (flat["margin-right"]) css.marginRight = flat["margin-right"];
  if (flat["font-family"]) css.fontFamily = flat["font-family"];
  if (flat["line-height"]) css.lineHeight = flat["line-height"];
  if (flat["letter-spacing"]) css.letterSpacing = flat["letter-spacing"];
  if (flat["background"]) css.background = flat["background"];
  else if (flat["background-color"]) css.backgroundColor = flat["background-color"];
  if (flat["background-image"]) { css.backgroundImage = flat["background-image"]; css.backgroundSize = "cover"; css.backgroundPosition = "center"; }
  if (flat["color"]) css.color = flat["color"];
  if (flat["font-size"]) css.fontSize = flat["font-size"];
  if (flat["font-weight"]) css.fontWeight = flat["font-weight"] as any;
  if (flat["text-align"]) css.textAlign = flat["text-align"] as any;
  if (flat["border-radius"]) css.borderRadius = flat["border-radius"];
  if (flat["border"]) css.border = flat["border"];
  if (style?.width) {
    // Colonne redimensionnée (vague 3, glisser-déposer sur la poignée) —
    // largeur figée : sans forcer grow/shrink à 0, la classe Tailwind
    // "flex-1" des colonnes continuerait à étirer/comprimer au-delà de
    // cette base, rendant le redimensionnement invisible.
    css.flexBasis = style.width;
    css.flexGrow = 0;
    css.flexShrink = 0;
  }
  return css;
}

function cssTextFromKebab(props: Record<string, string>): string {
  return Object.entries(props).map(([k, v]) => `${k}:${v} !important;`).join("");
}

// Génère le <style> (texte, sans balise) d'un bloc pour vague 3 : surcharges
// tablette/mobile + visibilité par appareil. Utilise des container queries
// (@container), pas des media queries — même règle CSS fonctionne aussi
// bien pour le vrai storefront (le conteneur englobant fait toute la
// largeur de la page, donc @container ≈ @media) que pour l'aperçu en direct
// du canevas (le conteneur englobant est volontairement rétréci quand
// Tablette/Mobile est sélectionné dans la barre d'outils — voir
// BuilderCanvas). Ciblée par attribut ([data-axs-id]) pour rester scopée à
// ce seul nœud sans avoir besoin d'une classe dédiée. `!important` requis :
// la base desktop est un style inline (spécificité imbattable autrement).
export function blockResponsiveCss(nodeId: string, style?: BlockStyleOverrides, cible = false): string {
  if (!style) return "";
  const rules: string[] = [];
  const selector = `[data-axs-id="${nodeId}"]`;
  const selCible = `${selector} [data-axs-cible]`;
  // Réglages visuels de l'appareil : sur l'élément affiché (bloc simple) ou sur l'enveloppe.
  const regle = (props: Record<string, string>, enveloppe = (css: string) => css) => {
    const { visuels, autres } = cible ? partager(props) : { visuels: {}, autres: props };
    if (Object.keys(autres).length) rules.push(enveloppe(`${selector}{${cssTextFromKebab(autres)}}`));
    if (Object.keys(visuels).length) rules.push(enveloppe(`${selCible}{${cssTextFromKebab(visuels)}}`));
  };
  if (cible) regle(partager(flattenStyleKebab(style)).visuels);

  const tabletProps = flattenStyleKebab(style.responsive?.tablet);
  if (style.responsive?.tablet?.width) { tabletProps["flex-basis"] = style.responsive.tablet.width; tabletProps["flex-grow"] = "0"; tabletProps["flex-shrink"] = "0"; }
  regle(tabletProps, (css) => `@container (max-width:${BREAKPOINT_TABLET_MAX}){${css}}`);

  const mobileProps = flattenStyleKebab(style.responsive?.mobile);
  if (style.responsive?.mobile?.width) { mobileProps["flex-basis"] = style.responsive.mobile.width; mobileProps["flex-grow"] = "0"; mobileProps["flex-shrink"] = "0"; }
  regle(mobileProps, (css) => `@container (max-width:${BREAKPOINT_MOBILE_MAX}){${css}}`);

  // Survol : couleurs de texte/fond ; !important pour passer devant le style inline.
  const survol = [style.hover?.color && `color:${style.hover.color} !important;`, style.hover?.background && `background:${style.hover.background} !important;`].filter(Boolean).join("");
  if (survol) rules.push(`${cible ? selCible : selector}:hover{${survol}}`);

  const vis = style.visibility;
  if (vis?.desktop === false) rules.push(`@container (min-width:${parseInt(BREAKPOINT_TABLET_MAX) + 1}px){${selector}{display:none !important;}}`);
  if (vis?.tablet === false) rules.push(`@container (min-width:${parseInt(BREAKPOINT_MOBILE_MAX) + 1}px) and (max-width:${BREAKPOINT_TABLET_MAX}){${selector}{display:none !important;}}`);
  if (vis?.mobile === false) rules.push(`@container (max-width:${BREAKPOINT_MOBILE_MAX}){${selector}{display:none !important;}}`);

  // Polices choisies (base + tablette/mobile) : chargées en tête de cette feuille.
  const polices = [style.typography?.police, style.responsive?.tablet?.typography?.police, style.responsive?.mobile?.typography?.police].filter(Boolean) as string[];
  return importPolices(polices) + rules.join("");
}
