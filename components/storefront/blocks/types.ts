import type { ThemeColors } from "@/lib/theme-config";

// Props partagées par tous les widgets de la bibliothèque de blocs —
// utilisées à la fois par l'ancien système (CustomSectionsRenderer, liste
// plate) et le nouvel arbre libre (BlockTreeRenderer). `config` garde
// exactement la même forme que CustomSection.config par type, aucune
// migration de données nécessaire entre les deux systèmes.
export interface BlockRenderProps {
  id: string;
  config: Record<string, any>;
  colors: Pick<ThemeColors, "accent" | "texte" | "fond">;
  slug: string;
  container: string;
  sectionPy: string;
  // Ajoutés pour les atomes (vague 2). `tenantId` : nécessaire côté SSR pour
  // que ProductsBlock interroge Prisma (absent côté canevas, qui affiche un
  // aperçu statique — voir BuilderCanvas). `editable`/`onEditText` : édition
  // de texte inline, actifs uniquement dans le canevas, jamais côté SSR.
  tenantId?: string;
  editable?: boolean;
  onEditText?: (patch: Record<string, any>) => void;
}
