import type { ReactNode } from "react";
import { MARQUEUR_SLOT } from "@/lib/theme-import-clone";
import type { ThemeConfig } from "@/lib/theme-config";

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
    <>
      {cfg.builderCss && <style dangerouslySetInnerHTML={{ __html: cfg.builderCss }} />}
      <div dangerouslySetInnerHTML={{ __html: avant }} />
      {children}
      {apres && <div dangerouslySetInnerHTML={{ __html: apres }} />}
    </>
  );
}
