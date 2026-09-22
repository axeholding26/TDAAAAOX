// ─── Gabarits du Constructeur digital (façon Chariow) ─────────────────────────
// Remplace l'ancien système (builder/digital/digitalStarterTemplates.ts, un
// arbre de blocs générique amorçant le Constructeur libre). Ici un gabarit ne
// fournit plus un arbre de blocs : il sélectionne un layout React dédié
// (components/storefront/digital/DigitalStoreShell.tsx, variant=id) + une
// identité de couleurs/rayon de départ, éditable ensuite via "Couleur de
// votre marque" / "Style des coins" dans le Constructeur digital — même
// principe que l'ancien système, sans passer par le Constructeur de blocs.
// "charriow" reproduit à l'identique la référence (voir ex.png) ; les 3
// autres respectent rigoureusement la même structure de page (nav → titre →
// recherche/filtres → grille produits → pied de page) avec une identité
// visuelle propre.
export interface DigitalTemplateSkin {
  id: "charriow" | "aurore" | "onyx" | "mint";
  label: string;
  desc: string;
  colors: { fond: string; accent: string; texte: string; texteMuted: string; surface: string; bordure: string };
  radius: string;
  // Capture d'écran réelle (pas une maquette synthétique) — utilisée à la
  // fois par le sélecteur "Modèle de boutique" du Constructeur digital et
  // par l'étape de choix de design à l'inscription (voir inscription/page.tsx
  // ::PropositionsTemplatesDigitaux). Fichiers dans public/digital-templates/.
  previewImage: string;
}

export const DIGITAL_TEMPLATES: DigitalTemplateSkin[] = [
  {
    id: "charriow",
    label: "Chariow",
    desc: "Noir sur blanc, minimal — la référence",
    colors: { fond: "#ffffff", accent: "#111111", texte: "#111111", texteMuted: "#6b7280", surface: "#f7f7f8", bordure: "#e5e7eb" },
    radius: "0px",
    previewImage: "/digital-templates/charriow.png",
  },
  {
    id: "aurore",
    label: "Aurore",
    desc: "Chaleureux, ambré, cartes arrondies",
    colors: { fond: "#fffaf3", accent: "#c2622d", texte: "#2c1503", texteMuted: "#8a6248", surface: "#ffffff", bordure: "#f0e0d0" },
    radius: "16px",
    previewImage: "/digital-templates/aurore.png",
  },
  {
    id: "onyx",
    label: "Onyx",
    desc: "Sombre et feutré, accent or",
    colors: { fond: "#0b0b0c", accent: "#d4af37", texte: "#f5f5f0", texteMuted: "#a9a9a4", surface: "#151517", bordure: "#26262a" },
    radius: "4px",
    previewImage: "/digital-templates/onyx.png",
  },
  {
    id: "mint",
    label: "Mint",
    desc: "Frais et coloré, pastilles arrondies",
    colors: { fond: "#ffffff", accent: "#0d9488", texte: "#0f172a", texteMuted: "#64748b", surface: "#f0fdfa", bordure: "#d1fae5" },
    radius: "20px",
    previewImage: "/digital-templates/mint.png",
  },
];

export function getDigitalTemplate(id?: string): DigitalTemplateSkin {
  return DIGITAL_TEMPLATES.find((t) => t.id === id) || DIGITAL_TEMPLATES[0];
}
