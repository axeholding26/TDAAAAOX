import {
  LayoutGrid, Rows3, Columns3, Zap, BarChart3, Timer, Building2, Video,
  Image as ImageIcon, Star, Target, FileText, ArrowUpDown, LayoutTemplate, LucideIcon,
  Heading, Type, MousePointerClick, ShoppingBag, Layers,
} from "lucide-react";
import type { BlockNode, BlockNodeType } from "@/lib/theme-config";
import { genBlockId } from "@/lib/block-tree";
import { createDefaultNode } from "@/lib/block-catalog";

export { createDefaultNode };

// Bibliothèque du canevas libre — structurels (section/row/column) + les 12
// types de blocs réutilisés de CustomSection. Indépendant de la liste dans
// builder/page.tsx (constructeur classique) pour ne rien coupler entre les
// deux modes.
export const BLOCK_LIBRARY_ITEMS: Array<{ type: BlockNodeType; label: string; Icon: LucideIcon; desc: string; categorie: "structure" | "widget" }> = [
  { type: "section", label: "Section", Icon: LayoutGrid, desc: "Bloc racine, pleine largeur", categorie: "structure" },
  { type: "row", label: "Ligne", Icon: Rows3, desc: "Conteneur horizontal", categorie: "structure" },
  { type: "column", label: "Colonne", Icon: Columns3, desc: "Conteneur vertical dans une ligne", categorie: "structure" },
  { type: "features", label: "Avantages", Icon: Zap, desc: "Grille de caractéristiques", categorie: "widget" },
  { type: "stats", label: "Statistiques", Icon: BarChart3, desc: "Chiffres clés animés", categorie: "widget" },
  { type: "countdown", label: "Compte à rebours", Icon: Timer, desc: "Timer vente flash", categorie: "widget" },
  { type: "brands", label: "Logos partenaires", Icon: Building2, desc: "Défilement de logos", categorie: "widget" },
  { type: "video", label: "Vidéo", Icon: Video, desc: "Vidéo showcase", categorie: "widget" },
  { type: "gallery", label: "Galerie photos", Icon: ImageIcon, desc: "Mosaïque de photos", categorie: "widget" },
  { type: "social-proof", label: "Preuve sociale", Icon: Star, desc: "Notes, certifications", categorie: "widget" },
  { type: "cta-band", label: "Bande CTA", Icon: Target, desc: "Bandeau appel à l'action", categorie: "widget" },
  { type: "richtext", label: "Texte riche", Icon: FileText, desc: "Titre + texte + bouton", categorie: "widget" },
  { type: "spacer", label: "Espacement", Icon: ArrowUpDown, desc: "Espace vertical", categorie: "widget" },
  { type: "tabs", label: "Onglets", Icon: LayoutTemplate, desc: "Contenu en onglets", categorie: "widget" },
  { type: "columns", label: "Colonnes de contenu", Icon: Columns3, desc: "Photos/témoignage/promo/texte", categorie: "widget" },
  { type: "heading", label: "Titre", Icon: Heading, desc: "Titre éditable directement sur le canevas", categorie: "widget" },
  { type: "text", label: "Texte", Icon: Type, desc: "Paragraphe éditable directement sur le canevas", categorie: "widget" },
  { type: "image", label: "Image", Icon: ImageIcon, desc: "Image unique, avec lien optionnel", categorie: "widget" },
  { type: "button", label: "Bouton", Icon: MousePointerClick, desc: "Bouton d'appel à l'action", categorie: "widget" },
  { type: "products", label: "Produits", Icon: ShoppingBag, desc: "Grille de produits de la boutique", categorie: "widget" },
];

// Composition de départ proposée quand le canevas est vide — une section
// avec une ligne à une colonne, prête à recevoir des blocs.
export function createStarterSection(): BlockNode {
  return {
    id: genBlockId("section"),
    type: "section",
    children: [{ id: genBlockId("row"), type: "row", children: [{ id: genBlockId("col"), type: "column", children: [] }] }],
  };
}

function colonne(children: BlockNode[], style?: BlockNode["style"]): BlockNode {
  return { id: genBlockId("col"), type: "column", children, style };
}
function ligne(children: BlockNode[]): BlockNode {
  return { id: genBlockId("row"), type: "row", children };
}
function section(children: BlockNode[]): BlockNode {
  return { id: genBlockId("section"), type: "section", children };
}
function widget(type: BlockNodeType, config: Record<string, any>): BlockNode {
  return { id: genBlockId(type), type, config };
}

// Petite bibliothèque de modèles de départ (vague 3) — des sections déjà
// composées avec un contenu réaliste, à insérer d'un clic (pas de
// glisser-déposer : ce sont des sous-arbres entiers, pas un seul bloc). Le
// marchand personnalise ensuite le texte/style comme n'importe quel bloc.
export const STARTER_TEMPLATES: Array<{ id: string; label: string; Icon: LucideIcon; desc: string; build: () => BlockNode }> = [
  {
    id: "hero-centre",
    label: "Hero centré",
    Icon: Layers,
    desc: "Grand titre, texte et bouton, centrés",
    build: () => section([
      ligne([colonne([
        widget("heading", { texte: "Une boutique pensée pour vous", niveau: "h1", align: "center" }),
        widget("text", { texte: "Décrivez ici ce qui rend votre boutique unique, en une ou deux phrases.", align: "center" }),
        widget("button", { texte: "Découvrir la boutique", lien: "produits", style: "primary", taille: "lg", align: "center" }),
      ])]),
    ]),
  },
  {
    id: "texte-image",
    label: "Texte + Image",
    Icon: ImageIcon,
    desc: "Deux colonnes : présentation à gauche, image à droite",
    build: () => section([
      ligne([
        colonne([
          widget("heading", { texte: "Notre histoire", niveau: "h2", align: "left" }),
          widget("text", { texte: "Racontez votre histoire, vos valeurs, ce qui vous distingue.", align: "left" }),
          widget("button", { texte: "En savoir plus", lien: "a-propos", style: "outline", taille: "md", align: "left" }),
        ], { width: "50%" }),
        colonne([widget("image", { url: "", alt: "", ratio: "square" })], { width: "50%" }),
      ]),
    ]),
  },
  {
    id: "grille-avantages",
    label: "Grille 3 avantages",
    Icon: Zap,
    desc: "Trois points forts avec icône et texte",
    build: () => section([ligne([colonne([widget("features", { titre: "Pourquoi nous choisir", items: [
      { icone: "🚚", titre: "Livraison rapide", texte: "Expédition sous 48h" },
      { icone: "🔒", titre: "Paiement sécurisé", texte: "Transactions protégées" },
      { icone: "💬", titre: "Support réactif", texte: "Une question ? On répond vite" },
    ], colonnes: 3 })])])]),
  },
  {
    id: "bandeau-cta",
    label: "Bandeau CTA",
    Icon: Target,
    desc: "Bandeau pleine largeur avec appel à l'action",
    build: () => section([ligne([colonne([widget("cta-band", {
      titre: "Prêt à commander ?", texte: "Rejoignez nos clients satisfaits dès aujourd'hui", ctaTexte: "Voir les produits", ctaLien: "produits", style: "gradient",
    })])])]),
  },
  {
    id: "galerie-produits",
    label: "Galerie de produits",
    Icon: ShoppingBag,
    desc: "Grille de vos produits, prête à afficher",
    build: () => section([ligne([colonne([widget("products", { titre: "Nos produits", nombre: 8, colonnes: 4, tri: "recent" })])])]),
  },
];
