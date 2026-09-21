import type { BlockRenderProps } from "../types";

// Rend tel quel le HTML/CSS AXSO Design cloné (voir lib/theme-import-clone.ts,
// déjà assaini à l'import : scripts retirés, gestionnaires d'événements et
// liens javascript: neutralisés) — même mécanisme que ImportedLiteralHomePage,
// simplement enveloppé comme un bloc du Constructeur libre. `config.css` est
// scopé au conteneur du bloc pour ne pas fuiter sur les autres blocs de la page.
export function EmbedHtmlBlock({ id, config }: BlockRenderProps) {
  return (
    <div data-axs-id={id} data-axs-embed-html="1">
      {config?.css && <style dangerouslySetInnerHTML={{ __html: config.css }} />}
      {config?.html && <div dangerouslySetInnerHTML={{ __html: config.html }} />}
    </div>
  );
}
