import type { ThemeConfig } from "@/lib/theme-config";
import { cssSectionsDesign } from "@/lib/scope-css";

interface Props {
  cfg: ThemeConfig;
}

// Rendu d'un thème importé tel quel (voir lib/theme-import-clone.ts) : le
// HTML/CSS envoyé par le marchand est conservé littéralement (même
// copywriting, même mise en page) — seuls les produits, le panier et la
// navigation ont été branchés sur de vraies données AXSO au moment de
// l'import. Aucun script n'a jamais été exécuté ni conservé.
export function ImportedLiteralHomePage({ cfg }: Props) {
  return (
    // Conteneur de référence des règles responsives du design (@container, voir lib/scope-css.ts).
    <div style={{ containerType: "inline-size" }}>
      {/* CSS du design avec les couleurs/polices choisies dans le Constructeur. */}
      {cfg.builderCss && <style dangerouslySetInnerHTML={{ __html: cssSectionsDesign(cfg as any) }} />}
      {cfg.builderHtml && <div data-axs-embed-html="1" dangerouslySetInnerHTML={{ __html: cfg.builderHtml }} />}
      {/* CSS libre du marchand (panneau "Avancé" du builder) */}
      {cfg.customCss && <style dangerouslySetInnerHTML={{ __html: cfg.customCss }} />}
    </div>
  );
}
