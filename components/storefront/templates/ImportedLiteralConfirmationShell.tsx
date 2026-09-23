import type { ReactNode } from "react";
import { MARQUEUR_SLOT } from "@/lib/theme-import-clone";
import type { ThemeConfig } from "@/lib/theme-config";
import { cssDesignPersonnalise } from "@/lib/scope-css";

// Confirmation d'un thème importé/généré tel quel — même principe que
// ImportedLiteralCartShell/CheckoutShell : chrome visuel seul, contenu réel
// (children — ConfirmationDigitaleContent ou CommandeConfirmeeClient selon
// la route appelante) enchâssé au marqueur AXSO_SLOT. Jamais de logique
// d'origine reconstruite pour une page qui confirme un paiement réel.
interface Props {
  cfg: ThemeConfig;
  children: ReactNode;
}

export function ImportedLiteralConfirmationShell({ cfg, children }: Props) {
  const html = cfg.builderHtmlConfirmationChrome || "";
  const idx = html.indexOf(MARQUEUR_SLOT);
  const avant = idx === -1 ? html : html.slice(0, idx);
  const apres = idx === -1 ? "" : html.slice(idx + MARQUEUR_SLOT.length);

  return (
    // Conteneur de référence des règles responsives du design (@container, voir lib/scope-css.ts).
    <div style={{ containerType: "inline-size" }}>
      {cfg.builderCss && <style dangerouslySetInnerHTML={{ __html: cssDesignPersonnalise(cfg as any) }} />}
      <div data-axs-embed-html="1" dangerouslySetInnerHTML={{ __html: avant }} />
      {children}
      {apres && <div data-axs-embed-html="1" dangerouslySetInnerHTML={{ __html: apres }} />}
    </div>
  );
}
