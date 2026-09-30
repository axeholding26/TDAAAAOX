// Réglages globaux du thème modifiables par AXIA (outil modifier_theme) : les
// mêmes valeurs que les menus du Constructeur (app/(dashboard)/dashboard/builder/panels.tsx),
// rien d'autre — une valeur hors liste est refusée, jamais enregistrée.
import { FONTS } from "@/lib/theme-fonts";

const IDS_POLICES = FONTS.map((f) => f.v);
const px = (min: number, max: number) => (v: unknown) => typeof v === "string" && /^\d+px$/.test(v) && +v.slice(0, -2) >= min && +v.slice(0, -2) <= max;
const parmi = (liste: readonly (string | number | boolean)[]) => (v: unknown) => liste.includes(v as any);
const booleen = (v: unknown) => typeof v === "boolean";
const nombre = (min: number, max: number) => (v: unknown) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

type Regles = Record<string, (v: unknown) => boolean>;

const REGLES: Record<string, { cle: string; champs: Regles }> = {
  polices: { cle: "fonts", champs: {
    titre: parmi(IDS_POLICES), corps: parmi(IDS_POLICES),
    poidsTitre: parmi(["400", "500", "600", "700", "800", "900"]),
    tailleBase: px(13, 18),
    lettreEspacement: (v) => typeof v === "string" && /^-?\d*\.?\d+(em|px)$/.test(v),
    hauteurLigne: (v) => typeof v === "string" && /^\d(\.\d+)?$/.test(v),
    transformTitre: parmi(["none", "uppercase", "capitalize"]),
  } },
  miseEnPage: { cle: "layout", champs: {
    largeurContainer: parmi(["1024px", "1280px", "1440px", "1600px", "100%"]),
    paddingSection: parmi(["sm", "md", "lg", "xl"]),
    colonnesProduits: nombre(2, 5), colonnesMobile: nombre(1, 2),
    styleCarte: parmi(["shadow", "bordered", "flat", "lifted"]),
    ombre: parmi(["none", "sm", "md", "lg", "xl"]),
  } },
  boutons: { cle: "boutons", champs: {
    style: parmi(["filled", "outlined", "ghost", "pill", "square"]),
    taille: parmi(["sm", "md", "lg", "xl"]),
    hover: parmi(["lighten", "darken", "scale", "glow", "slide"]),
  } },
  navigation: { cle: "navigationStyle", champs: {
    type: parmi(["classic", "centered", "floating", "minimal", "mega", "transparent-scroll"]),
    style: parmi(["light", "dark", "glass", "transparent"]),
    hauteur: parmi(["48px", "64px", "80px"]),
    sticky: booleen, showSearch: booleen, showWishlist: booleen,
  } },
  animations: { cle: "animations", champs: {
    preset: parmi(["luxury", "dynamic", "elegant", "playful", "none"]),
    global: parmi(["none", "fade-in", "slide-up", "slide-left", "zoom-in", "flip", "blur-in"]),
    vitesse: parmi(["fast", "normal", "slow"]),
    stagger: booleen, parallax: booleen, smoothScroll: booleen,
  } },
};

// Mêmes préréglages que le panneau Animations.
const PRESETS_ANIMATIONS: Record<string, object> = {
  luxury: { global: "fade-in", vitesse: "slow", stagger: true, parallax: false },
  dynamic: { global: "slide-left", vitesse: "fast", stagger: false, parallax: true },
  elegant: { global: "slide-up", vitesse: "normal", stagger: true, parallax: false },
  playful: { global: "zoom-in", vitesse: "fast", stagger: true, parallax: false },
  none: { global: "none", vitesse: "normal", stagger: false, parallax: false },
};

export function reglagesTheme(args: Record<string, any>): { patch: Record<string, any>; refus: string[] } {
  const patch: Record<string, any> = {};
  const refus: string[] = [];
  for (const [groupe, { cle, champs }] of Object.entries(REGLES)) {
    const recu = args[groupe];
    if (!recu || typeof recu !== "object") continue;
    for (const [champ, valeur] of Object.entries(recu)) {
      // Les nombres arrivent parfois en texte ("4") : même valeur que le menu.
      const v = typeof valeur === "string" && /^\d+$/.test(valeur) && (champ === "colonnesProduits" || champ === "colonnesMobile") ? +valeur : valeur;
      if (champs[champ]?.(v)) (patch[cle] ??= {})[champ] = v;
      else refus.push(`${groupe}.${champ}=${JSON.stringify(valeur)}`);
    }
  }
  if (patch.animations?.preset) patch.animations = { ...PRESETS_ANIMATIONS[patch.animations.preset], ...patch.animations };
  if (args.arrondi !== undefined) {
    if (parmi(["0px", "4px", "8px", "12px", "16px", "24px", "9999px"])(args.arrondi)) patch.radius = args.arrondi;
    else refus.push(`arrondi=${JSON.stringify(args.arrondi)}`);
  }
  return { patch, refus };
}
