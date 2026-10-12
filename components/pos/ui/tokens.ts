// Jetons visuels du kit de la caisse — mêmes codes que le tableau de bord
// (jaune AXSO #F5A623 sur noir #111111, cartes blanches arrondies) pour que les
// écrans POS ne réinventent ni couleur ni espacement.
export const POLICE = { fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" } as const;

export const COULEURS = {
  accent: "#F5A623", accentFonce: "#D4911A", accentPale: "#FFF7ED",
  encre: "#111111", texte: "#666666", discret: "#AAAAAA",
  bordure: "#E8E8E8", fond: "#F5F5F5", surface: "#FFFFFF",
} as const;

/** Tons sémantiques : fond pâle, texte lisible (contraste AA), bordure assortie. */
export const TONS = {
  neutre: { background: "#F5F5F5", color: "#555555", border: "1px solid #E8E8E8" },
  accent: { background: "#FFF7ED", color: "#B45309", border: "1px solid #FDE68A" },
  positif: { background: "#ECFDF5", color: "#15803D", border: "1px solid #BBF7D0" },
  attention: { background: "#FFFBEB", color: "#B45309", border: "1px solid #FCD34D" },
  danger: { background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" },
  info: { background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" },
} as const;
export type Ton = keyof typeof TONS;

/** Anneau de focus clavier, identique sur tout élément interactif du kit. */
export const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]";
