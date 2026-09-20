import type { ThemeColors } from "@/lib/theme-config";

// Contexte transmis à chaque nœud de l'arbre lors du rendu — mêmes données
// que CustomSectionsRenderer (slug/colors/container/sectionPy) plus les
// affordances d'édition, actives uniquement dans le canevas du constructeur
// (jamais côté storefront public : `editable` est toujours `false`/absent en
// SSR public).
export interface TreeRenderCtx {
  slug: string;
  colors: Pick<ThemeColors, "accent" | "texte" | "fond">;
  container: string;
  sectionPy: string;
  // Nécessaire côté SSR pour que le widget ProductsBlock interroge Prisma.
  tenantId?: string;
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}
