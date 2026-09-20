import type { CSSProperties } from "react";
import type { BlockStyleOverrides } from "@/lib/theme-config";

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
function flattenStyleKebab(style?: Omit<BlockStyleOverrides, "responsive" | "customClass" | "visibility" | "width">): Record<string, string> {
  if (!style) return {};
  const out: Record<string, string> = {};
  if (style.spacing?.pt) out["padding-top"] = style.spacing.pt;
  if (style.spacing?.pb) out["padding-bottom"] = style.spacing.pb;
  if (style.spacing?.pl) out["padding-left"] = style.spacing.pl;
  if (style.spacing?.pr) out["padding-right"] = style.spacing.pr;
  if (style.spacing?.mt) out["margin-top"] = style.spacing.mt;
  if (style.spacing?.mb) out["margin-bottom"] = style.spacing.mb;
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
  if (style.border?.radius) out["border-radius"] = style.border.radius;
  if (style.border?.width && style.border?.color) out["border"] = `${style.border.width} solid ${style.border.color}`;
  return out;
}

// Convertit les surcharges de style d'un bloc (BlockStyleOverrides) en objet
// style React — un seul endroit, partagé par tous les conteneurs/widgets du
// constructeur libre. Toujours la valeur "desktop" (défaut) : les
// surcharges tablette/mobile ne peuvent pas passer par du style inline
// (spécificité trop forte pour être re-surchargées par une media query) —
// voir blockResponsiveCss.
export function blockStyleToCss(style?: BlockStyleOverrides): CSSProperties {
  const flat = flattenStyleKebab(style);
  const css: CSSProperties = {};
  if (flat["padding-top"]) css.paddingTop = flat["padding-top"];
  if (flat["padding-bottom"]) css.paddingBottom = flat["padding-bottom"];
  if (flat["padding-left"]) css.paddingLeft = flat["padding-left"];
  if (flat["padding-right"]) css.paddingRight = flat["padding-right"];
  if (flat["margin-top"]) css.marginTop = flat["margin-top"];
  if (flat["margin-bottom"]) css.marginBottom = flat["margin-bottom"];
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
export function blockResponsiveCss(nodeId: string, style?: BlockStyleOverrides): string {
  if (!style) return "";
  const rules: string[] = [];
  const selector = `[data-axs-id="${nodeId}"]`;

  const tabletProps = flattenStyleKebab(style.responsive?.tablet);
  if (style.responsive?.tablet?.width) { tabletProps["flex-basis"] = style.responsive.tablet.width; tabletProps["flex-grow"] = "0"; tabletProps["flex-shrink"] = "0"; }
  if (Object.keys(tabletProps).length) {
    rules.push(`@container (max-width:${BREAKPOINT_TABLET_MAX}){${selector}{${cssTextFromKebab(tabletProps)}}}`);
  }

  const mobileProps = flattenStyleKebab(style.responsive?.mobile);
  if (style.responsive?.mobile?.width) { mobileProps["flex-basis"] = style.responsive.mobile.width; mobileProps["flex-grow"] = "0"; mobileProps["flex-shrink"] = "0"; }
  if (Object.keys(mobileProps).length) {
    rules.push(`@container (max-width:${BREAKPOINT_MOBILE_MAX}){${selector}{${cssTextFromKebab(mobileProps)}}}`);
  }

  const vis = style.visibility;
  if (vis?.desktop === false) rules.push(`@container (min-width:${parseInt(BREAKPOINT_TABLET_MAX) + 1}px){${selector}{display:none !important;}}`);
  if (vis?.tablet === false) rules.push(`@container (min-width:${parseInt(BREAKPOINT_MOBILE_MAX) + 1}px) and (max-width:${BREAKPOINT_TABLET_MAX}){${selector}{display:none !important;}}`);
  if (vis?.mobile === false) rules.push(`@container (max-width:${BREAKPOINT_MOBILE_MAX}){${selector}{display:none !important;}}`);

  return rules.join("");
}
