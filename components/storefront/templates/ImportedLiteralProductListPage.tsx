import type { ThemeConfig } from "@/lib/theme-config";

// Liste boutique (PLP) d'un thème importé/généré tel quel — même principe
// que ImportedLiteralHomePage.tsx : HTML/CSS conservés littéralement, seule
// la grille de produits a été branchée sur les vrais produits au moment de
// l'import (lib/theme-import-clone.ts::clonerGrilleProduits). Aucun script
// n'a jamais été exécuté ni conservé.
interface Props {
  cfg: ThemeConfig;
}

export function ImportedLiteralProductListPage({ cfg }: Props) {
  return (
    <>
      {cfg.builderCss && <style dangerouslySetInnerHTML={{ __html: cfg.builderCss }} />}
      {cfg.builderHtmlProduits && <div dangerouslySetInnerHTML={{ __html: cfg.builderHtmlProduits }} />}
    </>
  );
}
