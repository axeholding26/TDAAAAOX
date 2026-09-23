import type { BlockRenderProps } from "../types";
import { scoperCss } from "@/lib/scope-css";

// Rend tel quel le HTML/CSS AXSO Design cloné (voir lib/theme-import-clone.ts,
// déjà assaini à l'import : scripts retirés, gestionnaires d'événements et
// liens javascript: neutralisés) — même mécanisme que ImportedLiteralHomePage,
// simplement enveloppé comme un bloc du Constructeur libre. `config.css` est
// confiné au bloc (@scope, voir lib/scope-css.ts). Les sections découpées d'un
// design (constructeur boutique) n'ont pas de CSS propre : il est injecté une
// fois pour toutes par la page (cssSectionsDesign).
export function EmbedHtmlBlock({ id, config }: BlockRenderProps) {
  return (
    <div data-axs-id={id} data-axs-embed-html="1">
      {config?.css && <style dangerouslySetInnerHTML={{ __html: scoperCss(config.css, `[data-axs-id="${id}"]`) }} />}
      {config?.html && <div dangerouslySetInnerHTML={{ __html: config.html }} />}
    </div>
  );
}
