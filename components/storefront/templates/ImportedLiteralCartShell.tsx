"use client";

import { CartContent } from "@/components/storefront/CartContent";
import { MARQUEUR_SLOT } from "@/lib/theme-import-clone";
import type { ThemeConfig } from "@/lib/theme-config";
import { cssDesignPersonnalise } from "@/lib/scope-css";

// Panier d'un thème importé/généré tel quel — n'essaie jamais de recloner
// ni de rebrancher la logique JS d'origine (trop risqué sur un flux qui
// touche à de l'argent réel). Ne garde que le "chrome" visuel de la page
// (lib/theme-import-clone.ts::extraireChrome), coupé au marqueur AXSO_SLOT,
// et enchâsse entre les deux moitiés le vrai composant panier AXSO déjà
// testé (CartContent) — même données réelles (useCartStore) que n'importe
// quel autre thème.
interface Props {
  cfg: ThemeConfig;
  slug: string;
  devise: string;
}

export function ImportedLiteralCartShell({ cfg, slug, devise }: Props) {
  const html = cfg.builderHtmlPanierChrome || "";
  const idx = html.indexOf(MARQUEUR_SLOT);
  const avant = idx === -1 ? html : html.slice(0, idx);
  const apres = idx === -1 ? "" : html.slice(idx + MARQUEUR_SLOT.length);
  const theme = { fond: cfg.colors.fond, accent: cfg.colors.accent, texte: cfg.colors.texte, surface: cfg.colors.surface };

  return (
    // Conteneur de référence des règles responsives du design (@container, voir lib/scope-css.ts).
    <div style={{ containerType: "inline-size" }}>
      {cfg.builderCss && <style dangerouslySetInnerHTML={{ __html: cssDesignPersonnalise(cfg as any) }} />}
      <div data-axs-embed-html="1" dangerouslySetInnerHTML={{ __html: avant }} />
      <CartContent theme={theme} slug={slug} devise={devise} />
      {apres && <div data-axs-embed-html="1" dangerouslySetInnerHTML={{ __html: apres }} />}
    </div>
  );
}
