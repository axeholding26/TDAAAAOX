// ─── Catalogue de polices Google Fonts — partagé entre le builder (aperçu) et
// la boutique en ligne (rendu réel), pour que les deux ne divergent jamais.
export const FONTS = [
  { cat: "Sans-serif", v: "inter",             label: "Inter",              gf: "Inter:wght@400;500;600;700" },
  { cat: "Sans-serif", v: "poppins",           label: "Poppins",            gf: "Poppins:wght@400;600;700;800" },
  { cat: "Sans-serif", v: "dm-sans",           label: "DM Sans",            gf: "DM+Sans:wght@400;600;700" },
  { cat: "Sans-serif", v: "outfit",            label: "Outfit",             gf: "Outfit:wght@400;600;700;800" },
  { cat: "Sans-serif", v: "nunito",            label: "Nunito",             gf: "Nunito:wght@400;600;700;800" },
  { cat: "Sans-serif", v: "plus-jakarta-sans", label: "Plus Jakarta Sans",  gf: "Plus+Jakarta+Sans:wght@400;600;700;800" },
  { cat: "Sans-serif", v: "montserrat",        label: "Montserrat",         gf: "Montserrat:wght@400;600;700;800" },
  { cat: "Sans-serif", v: "raleway",           label: "Raleway",            gf: "Raleway:wght@400;600;700;800" },
  { cat: "Sans-serif", v: "space-grotesk",     label: "Space Grotesk",      gf: "Space+Grotesk:wght@400;600;700" },
  { cat: "Sans-serif", v: "syne",              label: "Syne",               gf: "Syne:wght@400;700;800" },
  { cat: "Serif",      v: "playfair",          label: "Playfair Display",   gf: "Playfair+Display:wght@400;700" },
  { cat: "Serif",      v: "cormorant",         label: "Cormorant Garamond", gf: "Cormorant+Garamond:wght@400;600;700" },
  { cat: "Serif",      v: "lora",              label: "Lora",               gf: "Lora:wght@400;600;700" },
  { cat: "Serif",      v: "libre-baskerville", label: "Libre Baskerville",  gf: "Libre+Baskerville:wght@400;700" },
  { cat: "Serif",      v: "eb-garamond",       label: "EB Garamond",        gf: "EB+Garamond:wght@400;600;700" },
  { cat: "Display",    v: "josefin-sans",      label: "Josefin Sans",       gf: "Josefin+Sans:wght@400;600;700" },
  { cat: "Display",    v: "italiana",          label: "Italiana",           gf: "Italiana" },
  { cat: "Display",    v: "cinzel",            label: "Cinzel",             gf: "Cinzel:wght@400;600;700" },
  { cat: "Display",    v: "abril-fatface",     label: "Abril Fatface",      gf: "Abril+Fatface" },
  { cat: "Display",    v: "fraunces",          label: "Fraunces",           gf: "Fraunces:wght@400;700;900" },
  { cat: "Sans-serif", v: "archivo",           label: "Archivo",            gf: "Archivo:wght@400;500;600;700" },
  { cat: "Sans-serif", v: "archivo-narrow",    label: "Archivo Narrow",     gf: "Archivo+Narrow:wght@400;500;600" },
  { cat: "Display",    v: "anton",             label: "Anton",              gf: "Anton" },
  { cat: "Serif",      v: "domine",            label: "Domine",             gf: "Domine:wght@400;500;600;700" },
  { cat: "Sans-serif", v: "sora",               label: "Sora",               gf: "Sora:wght@400;500;600" },
  { cat: "Serif",      v: "spectral",           label: "Spectral",           gf: "Spectral:ital,wght@0,400;0,500;1,400" },
  { cat: "Sans-serif", v: "nunito-sans",         label: "Nunito Sans",        gf: "Nunito+Sans:wght@400;500;600;700" },
  { cat: "Sans-serif", v: "public-sans",         label: "Public Sans",        gf: "Public+Sans:wght@400;500;600;700;800" },
  { cat: "Sans-serif", v: "space-mono",          label: "Space Mono",         gf: "Space+Mono:wght@400;700" },
  { cat: "Sans-serif", v: "roboto-mono",          label: "Roboto Mono",        gf: "Roboto+Mono:wght@400;500" },
  { cat: "Sans-serif", v: "jost",                 label: "Jost",               gf: "Jost:wght@400;500;600" },
  { cat: "Display",    v: "big-shoulders-display", label: "Big Shoulders Display", gf: "Big+Shoulders+Display:wght@500;700;800" },
  { cat: "Sans-serif", v: "ibm-plex-mono",         label: "IBM Plex Mono",      gf: "IBM+Plex+Mono:wght@400;500" },
  { cat: "Sans-serif", v: "work-sans",             label: "Work Sans",          gf: "Work+Sans:wght@400;500;600;700" },
  { cat: "Display",    v: "oswald",                 label: "Oswald",             gf: "Oswald:wght@400;500;600;700" },
  { cat: "Display",    v: "teko",                   label: "Teko",               gf: "Teko:wght@400;500;600;700" },
  { cat: "Display",    v: "rajdhani",               label: "Rajdhani",           gf: "Rajdhani:wght@400;500;600;700" },
  { cat: "Sans-serif", v: "manrope",                label: "Manrope",            gf: "Manrope:wght@400;500;600;700;800" },
  { cat: "Display",    v: "baloo-2",                label: "Baloo 2",            gf: "Baloo+2:wght@400;500;600;700;800" },
  { cat: "Sans-serif", v: "chivo",                  label: "Chivo",              gf: "Chivo:wght@400;500;600;700" },
] as const;

export interface StorefrontFontsCfg {
  titre?: string;
  corps?: string;
  poidsTitre?: string;
  tailleBase?: string;
  lettreEspacement?: string;
  hauteurLigne?: string;
  transformTitre?: string;
}

const LETTRE_MAP: Record<string, string> = { tight: "-0.01em", normal: "normal", wide: "0.02em", ultra: "0.06em" };
const LIGNE_MAP: Record<string, string> = { compact: "1.2", normal: "1.5", relaxed: "1.8" };

export function fontEntry(v?: string) {
  return FONTS.find((f) => f.v === v) || null;
}

// URL Google Fonts combinée pour les polices titre + corps (dédupliquée).
export function googleFontsHref(fonts: StorefrontFontsCfg): string {
  const families: string[] = [];
  const seen = new Set<string>();
  for (const v of [fonts.titre, fonts.corps]) {
    const f = fontEntry(v);
    if (f && !seen.has(f.gf)) { seen.add(f.gf); families.push(f.gf); }
  }
  return families.length ? `https://fonts.googleapis.com/css2?${families.map((gf) => `family=${gf}`).join("&")}&display=swap` : "";
}

// Génère le CSS de typographie. Sans scopeSelector : cible tout le document
// (utilisé dans l'iframe isolée de l'aperçu du builder). Avec scopeSelector
// (ex. ".axs-store") : cible uniquement les descendants de ce sélecteur, pour
// s'appliquer à la boutique en ligne sans affecter le dashboard.
export function typographyCss(fonts: StorefrontFontsCfg | undefined, scopeSelector?: string): string {
  if (!fonts) return "";
  const titre = fontEntry(fonts.titre)?.label || "Playfair Display";
  const corps = fontEntry(fonts.corps)?.label || "Poppins";
  const poids = fonts.poidsTitre || "700";
  const taille = fonts.tailleBase || "16px";
  const lettreEsp = LETTRE_MAP[fonts.lettreEspacement || "normal"] ?? "normal";
  const ligne = LIGNE_MAP[fonts.hauteurLigne || "normal"] ?? "1.5";
  const transform = fonts.transformTitre && fonts.transformTitre !== "none" ? fonts.transformTitre : "none";

  const base = scopeSelector ? scopeSelector : "body";
  const all = scopeSelector ? `${scopeSelector}, ${scopeSelector} *` : "*";
  const headings = scopeSelector
    ? `${scopeSelector} h1, ${scopeSelector} h2, ${scopeSelector} h3, ${scopeSelector} h4, ${scopeSelector} .font-playfair`
    : `h1, h2, h3, h4, .font-playfair`;

  return (
    `${all}{font-family:'${corps}',sans-serif!important;}` +
    `${headings}{font-family:'${titre}',serif!important;font-weight:${poids}!important;text-transform:${transform}!important;}` +
    `${base}{font-size:${taille};line-height:${ligne};letter-spacing:${lettreEsp};}`
  );
}
