import type { ReactNode } from "react";
import type { ThemeConfig } from "@/lib/theme-config";
import { cssSectionsDesign } from "@/lib/scope-css";
import { decouperChrome } from "@/lib/vitrine-design";

/**
 * En-tête et pied de page du design (tels que modifiés dans le Constructeur)
 * autour d'un contenu React de la vitrine — fiche produit, À propos, Contact.
 * Le CSS du design est confiné à ses propres blocs ([data-axs-embed-html]) :
 * sans ça, sa remise à zéro (`*{margin:0;padding:0}`) écrasait tous les
 * espacements du contenu React.
 * Renvoie null si la boutique n'a pas de design : la page garde alors son rendu propre.
 */
export function habillageDesign(cfg: ThemeConfig) {
  const chrome = decouperChrome(cfg.builderHtmlProduit);
  if (!chrome) return null;
  const css = cssSectionsDesign(cfg as any);
  return function Habillage({ children }: { children: ReactNode }) {
    return (
      <div style={{ containerType: "inline-size", backgroundColor: cfg.colors.fond, color: cfg.colors.texte }}>
        {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
        <div data-axs-embed-html="1" dangerouslySetInnerHTML={{ __html: chrome.avant }} />
        {children}
        <div data-axs-embed-html="1" dangerouslySetInnerHTML={{ __html: chrome.apres }} />
      </div>
    );
  };
}
