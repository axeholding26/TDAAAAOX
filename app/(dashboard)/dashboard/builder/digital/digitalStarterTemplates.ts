// Gabarits de départ pour une boutique digitale (catalogue multi-produits) —
// de VRAIS arbres de blocs (mêmes types que le Constructeur libre physique,
// voir lib/block-catalog.ts), pas un système séparé : une fois inséré, le
// marchand édite chaque texte, couleur, position et bouton exactement comme
// n'importe quelle section du constructeur — même parité qu'une boutique
// physique. Choisir un gabarit ici ne fait qu'amorcer le canevas avec une
// composition + une identité de couleur ; rien n'est figé après coup.
import type { BlockNode, ThemeColors } from "@/lib/theme-config";
import { genBlockId } from "@/lib/block-tree";
import { createDefaultNode } from "@/lib/block-catalog";

function colonne(children: BlockNode[], style?: BlockNode["style"]): BlockNode {
  return { id: genBlockId("col"), type: "column", children, style };
}
function ligne(children: BlockNode[]): BlockNode {
  return { id: genBlockId("row"), type: "row", children };
}
function section(children: BlockNode[], style?: BlockNode["style"]): BlockNode {
  return { id: genBlockId("section"), type: "section", children, style };
}
function widget(type: Parameters<typeof createDefaultNode>[0], config: Record<string, any>, style?: BlockNode["style"]): BlockNode {
  return { ...createDefaultNode(type, config), style };
}

export interface DigitalStarterTemplate {
  id: "epure" | "vibrant" | "premium" | "compact";
  label: string;
  desc: string;
  colors: Partial<ThemeColors>;
  radius: string;
  build: () => BlockNode[];
}

export const DIGITAL_STARTER_TEMPLATES: DigitalStarterTemplate[] = [
  {
    id: "epure",
    label: "Épuré",
    desc: "Noir sur blanc, sobre",
    colors: { accent: "#111111", fond: "#ffffff", texte: "#111111", surface: "#f5f5f5" },
    radius: "8px",
    build: () => [
      section([
        ligne([colonne([
          widget("heading", { texte: "Votre boutique digitale", niveau: "h1", align: "center" }),
          widget("text", { texte: "Formations, ebooks, templates — décrivez ici ce que vous proposez.", align: "center" }),
        ])]),
      ]),
      section([
        ligne([colonne([widget("products", { titre: "Nos produits", nombre: 8, colonnes: 4, tri: "recent" })])]),
      ]),
    ],
  },
  {
    id: "vibrant",
    label: "Vibrant",
    desc: "Couleur en aplat, énergique",
    colors: { accent: "#F5A623", fond: "#fafafa", texte: "#111111", surface: "#ffffff" },
    radius: "18px",
    build: () => [
      section([
        ligne([colonne([
          widget("heading", { texte: "Votre boutique digitale", niveau: "h1", align: "center" }),
          widget("text", { texte: "Formations, ebooks, templates — décrivez ici ce que vous proposez.", align: "center" }),
          widget("button", { texte: "Voir les produits", lien: "produits", style: "primary", taille: "lg", align: "center" }),
        ])]),
      ], { background: { color: "#F5A62318" }, spacing: { pt: "80px", pb: "80px" } }),
      section([
        ligne([colonne([widget("products", { titre: "Nos produits", nombre: 6, colonnes: 3, tri: "recent" })])]),
      ]),
    ],
  },
  {
    id: "premium",
    label: "Premium",
    desc: "Sombre, feutré",
    colors: { accent: "#d4af37", fond: "#0b0b0c", texte: "#f5f5f0", surface: "#151517" },
    radius: "4px",
    build: () => [
      section([
        ligne([colonne([
          widget("heading", { texte: "Votre boutique digitale", niveau: "h1", align: "center" }),
          widget("text", { texte: "Formations, ebooks, templates — décrivez ici ce que vous proposez.", align: "center" }),
        ])]),
      ], { background: { color: "#0b0b0c" }, typography: { color: "#f5f5f0" }, spacing: { pt: "96px", pb: "96px" } }),
      section([
        ligne([colonne([widget("products", { titre: "Nos produits", nombre: 8, colonnes: 4, tri: "recent" })])]),
      ]),
    ],
  },
  {
    id: "compact",
    label: "Compact",
    desc: "Grille dense, grand catalogue",
    colors: { accent: "#3b82f6", fond: "#ffffff", texte: "#111111", surface: "#f7f7f7" },
    radius: "6px",
    build: () => [
      section([
        ligne([colonne([
          widget("heading", { texte: "Votre boutique digitale", niveau: "h2", align: "left" }),
          widget("text", { texte: "Formations, ebooks, templates — décrivez ici ce que vous proposez.", align: "left" }),
        ])]),
      ]),
      section([
        ligne([colonne([widget("products", { titre: "Nos produits", nombre: 12, colonnes: 4, tri: "recent" })])]),
      ]),
    ],
  },
];
