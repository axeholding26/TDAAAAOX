import type { ThemeConfig } from "@/lib/theme-config";
import { surchargeCouleursDesign } from "@/lib/scope-css";

interface Props {
  cfg: ThemeConfig;
}

// Rendu d'un thème importé tel quel (voir lib/theme-import-clone.ts) : le
// HTML/CSS envoyé par le marchand est conservé littéralement (même
// copywriting, même mise en page) — seuls les produits, le panier et la
// navigation ont été branchés sur de vraies données AXSO au moment de
// l'import. Aucun script n'a jamais été exécuté ni conservé.
export function ImportedLiteralHomePage({ cfg }: Props) {
  const colorOverride =
    cfg.axsoDesignCssVarMapping
      ? surchargeCouleursDesign(cfg.colors as any, cfg.axsoDesignCssVarMapping)
      : "";

  return (
    <>
      {cfg.builderCss && <style dangerouslySetInnerHTML={{ __html: cfg.builderCss }} />}
      {cfg.builderHtml && <div dangerouslySetInnerHTML={{ __html: cfg.builderHtml }} />}
      {/* Surcharges couleurs injectées APRÈS le HTML pour avoir la priorité
          sur le :root{} du template. Actives dès que le marchand a modifié
          ses couleurs dans le builder (tenant.themeConfig.colors). */}
      {colorOverride && <style dangerouslySetInnerHTML={{ __html: colorOverride }} />}
      {/* CSS libre du marchand (panneau "Avancé" du builder) */}
      {cfg.customCss && <style dangerouslySetInnerHTML={{ __html: cfg.customCss }} />}
    </>
  );
}
