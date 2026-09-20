import type { ComponentType } from "react";
import type { BlockRenderProps } from "./types";
import { FeaturesBlock } from "./widgets/FeaturesBlock";
import { StatsBlock } from "./widgets/StatsBlock";
import { CountdownBlock } from "./widgets/CountdownBlock";
import { BrandsBlock } from "./widgets/BrandsBlock";
import { VideoBlock } from "./widgets/VideoBlock";
import { GalleryBlock } from "./widgets/GalleryBlock";
import { SocialProofBlock } from "./widgets/SocialProofBlock";
import { SpacerBlock } from "./widgets/SpacerBlock";
import { RichtextBlock } from "./widgets/RichtextBlock";
import { CtaBandBlock } from "./widgets/CtaBandBlock";
import { TabsBlock } from "./widgets/TabsBlock";
import { ColumnsBlock } from "./widgets/ColumnsBlock";
import { HeadingBlock } from "./widgets/HeadingBlock";
import { TextBlock } from "./widgets/TextBlock";
import { ImageBlock } from "./widgets/ImageBlock";
import { ButtonBlock } from "./widgets/ButtonBlock";
// "products" (ProductsBlock) est DÉLIBÉRÉMENT absent de ce registre : ce
// widget interroge Prisma directement (voir widgets/ProductsBlock.tsx) et ce
// fichier est importé aussi bien côté SSR (BlockTreeRenderer,
// CustomSectionsRenderer) que côté client par le canevas du constructeur
// (CanvasNode.tsx, "use client"). Un import statique de Prisma ici ferait
// échouer le build client (modules Node comme "tls" introuvables dans le
// bundle navigateur). BlockTreeRenderer importe et rend ProductsBlock
// directement, en le court-circuitant avant ce registre ; CanvasNode le
// remplace par un aperçu statique (ProductsCanvasPreview).

// Registre partagé — les 12 types de blocs existants (CustomSection),
// extraits de CustomSectionsRenderer.tsx en composants autonomes pour être
// réutilisés à l'identique par l'ancien système (liste plate) et le futur
// arbre libre (vague 1). Un 13e type nécessite une entrée ici + un composant
// dans widgets/ — jamais de rendu générique piloté par schéma.
export const BLOCK_REGISTRY: Record<string, ComponentType<BlockRenderProps>> = {
  features: FeaturesBlock,
  stats: StatsBlock,
  countdown: CountdownBlock,
  brands: BrandsBlock,
  video: VideoBlock,
  gallery: GalleryBlock,
  "social-proof": SocialProofBlock,
  spacer: SpacerBlock,
  richtext: RichtextBlock,
  "cta-band": CtaBandBlock,
  tabs: TabsBlock,
  columns: ColumnsBlock,
  // Atomes (vague 2) — voir la note en tête de fichier pour "products".
  heading: HeadingBlock,
  text: TextBlock,
  image: ImageBlock,
  button: ButtonBlock,
};
