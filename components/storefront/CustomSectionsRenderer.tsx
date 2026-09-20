import type { CustomSection, ThemeColors } from "@/lib/theme-config";
import { BLOCK_REGISTRY } from "@/components/storefront/blocks/registry";

// Bibliothèque de sections custom réutilisable — extraite telle quelle de
// app/(storefront)/[slug]/page.tsx (accueil) pour être partagée avec les
// pages À propos / Contact (mêmes blocs : features, stats, countdown,
// brands, video, gallery, social-proof, spacer, richtext, cta-band, tabs,
// columns). Devenue une simple boucle par-dessus le registre partagé
// (components/storefront/blocks/registry.tsx) — chaque type de bloc est un
// composant autonome dans components/storefront/blocks/widgets/, réutilisé
// à l'identique par le futur arbre libre du constructeur. Aucun changement
// de rendu par rapport à l'ancienne implémentation inline.
interface Props {
  sections: CustomSection[];
  slug: string;
  colors: Pick<ThemeColors, "accent" | "texte" | "fond">;
  container: string;
  sectionPy: string;
}

export function CustomSectionsRenderer({ sections, slug, colors, container, sectionPy }: Props) {
  return (
    <>
      {(sections ?? [])
        .filter((s: any) => s.actif !== false)
        .sort((a: any, b: any) => (a.ordre ?? 99) - (b.ordre ?? 99))
        .map((section: any) => {
          const Bloc = BLOCK_REGISTRY[section.type];
          if (!Bloc) return null;
          return (
            <Bloc
              key={section.id}
              id={section.id}
              config={section.config ?? {}}
              colors={colors}
              slug={slug}
              container={container}
              sectionPy={sectionPy}
            />
          );
        })}
    </>
  );
}
