// Styles par ÉLÉMENT (un titre, un bouton, une image… d'un design ou de la
// vitrine digitale), édités depuis le panneau de droite des Constructeurs.
// Source unique : `ElementStyles` (JSON dans la config de la boutique) →
// `cssElements()` → le MÊME CSS dans l'aperçu et sur la boutique en ligne.
// Ciblage par attribut `data-axs-el` ; `!important` pour passer devant le CSS
// du design. Tablette/mobile en container queries : ils suivent la largeur de
// l'aperçu comme celle de l'écran réel (le conteneur fait toute la page).
import { fontEntry } from "./theme-fonts";

export type EtatStyle = "base" | "hover" | "tablet" | "mobile";

export interface ElementStyle {
  police?: string; // id de lib/theme-fonts.ts (FONTS[].v)
  taille?: string;
  graisse?: string;
  interligne?: string;
  espacementLettres?: string;
  casse?: "none" | "uppercase" | "lowercase" | "capitalize";
  alignement?: "left" | "center" | "right" | "justify";
  couleur?: string;
  fond?: string;
  degrade?: string;
  imageFond?: string; // image de fond (couvre l'élément), par-dessus couleur et dégradé
  bordureEpaisseur?: string;
  bordureCouleur?: string;
  rayon?: string;
  paddingHaut?: string; paddingDroite?: string; paddingBas?: string; paddingGauche?: string;
  margeHaut?: string; margeDroite?: string; margeBas?: string; margeGauche?: string;
  largeur?: string;
  largeurMax?: string;
  hauteur?: string;
  masque?: boolean;
}

export type ElementStyles = Record<string, Partial<Record<EtatStyle, ElementStyle>>>;

export const BREAKPOINT_TABLETTE = 1023; // mêmes seuils que components/storefront/blocks/styleUtils.ts
export const BREAKPOINT_MOBILE = 639;

function declarations(s: ElementStyle): string {
  const d: [string, string | undefined][] = [
    ["font-family", s.police ? `'${fontEntry(s.police)?.label ?? s.police}', sans-serif` : undefined],
    ["font-size", s.taille],
    ["font-weight", s.graisse],
    ["line-height", s.interligne],
    ["letter-spacing", s.espacementLettres],
    ["text-transform", s.casse],
    ["text-align", s.alignement],
    ["color", s.couleur],
    ["background", s.degrade || undefined],
    ["background-color", s.degrade ? undefined : s.fond],
    ["background-image", s.imageFond ? `url("${s.imageFond.replace(/"/g, "%22")}")` : undefined],
    ["background-size", s.imageFond ? "cover" : undefined],
    ["background-position", s.imageFond ? "center" : undefined],
    ["background-repeat", s.imageFond ? "no-repeat" : undefined],
    ["border-width", s.bordureEpaisseur],
    ["border-style", s.bordureEpaisseur ? "solid" : undefined],
    ["border-color", s.bordureCouleur],
    ["border-radius", s.rayon],
    ["padding-top", s.paddingHaut], ["padding-right", s.paddingDroite], ["padding-bottom", s.paddingBas], ["padding-left", s.paddingGauche],
    ["margin-top", s.margeHaut], ["margin-right", s.margeDroite], ["margin-bottom", s.margeBas], ["margin-left", s.margeGauche],
    ["width", s.largeur],
    ["max-width", s.largeurMax],
    ["height", s.hauteur],
    ["display", s.masque ? "none" : undefined],
  ];
  return d.filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}:${v} !important;`).join("");
}

/** CSS de tous les éléments stylés. `racine` : conteneur où chercher (défaut : toute la page). */
export function cssElements(styles?: ElementStyles, racine = "", avecImports = true): string {
  if (!styles) return "";
  const regles: string[] = [];
  for (const [id, etats] of Object.entries(styles)) {
    const sel = `${racine ? racine + " " : ""}[data-axs-el="${id.replace(/"/g, "")}"]`;
    const bloc = (etat: EtatStyle, selecteur = sel) => {
      const decl = etats[etat] && declarations(etats[etat]!);
      return decl ? `${selecteur}{${decl}}` : "";
    };
    regles.push(bloc("base"), bloc("hover", `${sel}:hover`));
    const tablette = bloc("tablet");
    if (tablette) regles.push(`@container (max-width:${BREAKPOINT_TABLETTE}px){${tablette}}`);
    const mobile = bloc("mobile");
    if (mobile) regles.push(`@container (max-width:${BREAKPOINT_MOBILE}px){${mobile}}`);
  }
  return (avecImports ? importPolices(policesDe(styles)) : "") + regles.filter(Boolean).join("");
}

export function policesDe(styles?: ElementStyles): string[] {
  const ids = new Set<string>();
  for (const etats of Object.values(styles ?? {})) for (const s of Object.values(etats)) if (s?.police) ids.add(s.police);
  return [...ids];
}

/** `@import` Google Fonts pour les polices choisies (à placer en tête d'une feuille). */
export function importPolices(ids: string[]): string {
  const familles = [...new Set(ids.map((v) => fontEntry(v)?.gf).filter(Boolean))];
  return familles.length ? `@import url('https://fonts.googleapis.com/css2?${familles.map((f) => `family=${f}`).join("&")}&display=swap');` : "";
}

/** Met à jour un état d'un élément ; une valeur vide retire la propriété (retour au style du design). */
export function majStyleElement(styles: ElementStyles | undefined, id: string, etat: EtatStyle, patch: Partial<ElementStyle>): ElementStyles {
  const actuel = { ...(styles?.[id]?.[etat] ?? {}), ...patch } as Record<string, unknown>;
  for (const k of Object.keys(actuel)) if (actuel[k] === "" || actuel[k] === undefined || actuel[k] === false) delete actuel[k];
  const etats = { ...(styles?.[id] ?? {}), [etat]: actuel };
  if (!Object.keys(actuel).length) delete etats[etat];
  const suivant = { ...(styles ?? {}), [id]: etats };
  if (!Object.keys(etats).length) delete suivant[id];
  return suivant;
}

// Auto-vérification : `ELEMENT_STYLES_CHECK=1 npx tsx lib/element-styles.ts`
if (process.env.ELEMENT_STYLES_CHECK) {
  let s = majStyleElement(undefined, "t1", "base", { couleur: "#f00", police: "inter", taille: "20px" });
  s = majStyleElement(s, "t1", "hover", { couleur: "#00f" });
  s = majStyleElement(s, "t1", "mobile", { taille: "14px", masque: true });
  const css = cssElements(s);
  console.assert(css.startsWith("@import url('https://fonts.googleapis.com/css2?family=Inter"), "police chargée");
  console.assert(css.includes(`[data-axs-el="t1"]{font-family:'Inter', sans-serif !important;font-size:20px !important;color:#f00 !important;}`), "base");
  console.assert(css.includes(`[data-axs-el="t1"]:hover{color:#00f !important;}`), "survol");
  console.assert(css.includes(`@container (max-width:639px){[data-axs-el="t1"]{font-size:14px !important;display:none !important;}}`), "mobile");
  s = majStyleElement(s, "t1", "hover", { couleur: "" });
  console.assert(!cssElements(s).includes(":hover"), "valeur vide = propriété retirée");
  console.log(css);
}
