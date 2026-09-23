import type { ThemeConfig } from "@/lib/theme-config";
import { cssDesignPersonnalise } from "@/lib/scope-css";

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
    // Conteneur de référence des règles responsives du design (@container, voir lib/scope-css.ts).
    <div style={{ containerType: "inline-size" }}>
      {cfg.builderCss && <style dangerouslySetInnerHTML={{ __html: cssDesignPersonnalise(cfg as any) }} />}
      {cfg.builderHtmlProduits && <div data-axs-embed-html="1" dangerouslySetInnerHTML={{ __html: cfg.builderHtmlProduits }} />}
    </div>
  );
}
