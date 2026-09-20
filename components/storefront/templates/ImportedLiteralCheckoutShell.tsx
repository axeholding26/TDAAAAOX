"use client";

import { CheckoutForm } from "@/components/storefront/CheckoutForm";
import { MARQUEUR_SLOT } from "@/lib/theme-import-clone";
import type { ThemeConfig } from "@/lib/theme-config";
import type { ParametresCommande } from "@/components/storefront/CheckoutForm";

// Commande (checkout) d'un thème importé/généré tel quel — même principe que
// ImportedLiteralCartShell.tsx : chrome visuel seul, vrai composant AXSO
// (CheckoutForm) enchâssé au marqueur AXSO_SLOT, jamais le formulaire/JS
// d'origine reconstruit — le vrai paiement (Wave/Orange Money/MTN MoMo,
// NotchPay pour le digital) reste piloté par la logique déjà testée.
interface Props {
  cfg: ThemeConfig;
  slug: string;
  devise: string;
  tenantId: string;
  nomBoutique: string;
  logoUrl?: string;
  parametresCommande?: ParametresCommande;
}

export function ImportedLiteralCheckoutShell({ cfg, slug, devise, tenantId, nomBoutique, logoUrl, parametresCommande }: Props) {
  const html = cfg.builderHtmlCheckoutChrome || "";
  const idx = html.indexOf(MARQUEUR_SLOT);
  const avant = idx === -1 ? html : html.slice(0, idx);
  const apres = idx === -1 ? "" : html.slice(idx + MARQUEUR_SLOT.length);
  const theme = { fond: cfg.colors.fond, accent: cfg.colors.accent, texte: cfg.colors.texte, surface: cfg.colors.surface };

  return (
    <>
      {cfg.builderCss && <style dangerouslySetInnerHTML={{ __html: cfg.builderCss }} />}
      <div dangerouslySetInnerHTML={{ __html: avant }} />
      <CheckoutForm theme={theme} slug={slug} devise={devise} tenantId={tenantId} nomBoutique={nomBoutique} logoUrl={logoUrl} parametresCommande={parametresCommande} />
      {apres && <div dangerouslySetInnerHTML={{ __html: apres }} />}
    </>
  );
}
