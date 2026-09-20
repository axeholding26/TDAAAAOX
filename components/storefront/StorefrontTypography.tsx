import { googleFontsHref, typographyCss, type StorefrontFontsCfg } from "@/lib/theme-fonts";

// Injecte les polices choisies dans l'onglet "Typographie" du builder sur la
// vraie boutique (jusqu'ici appliquées uniquement à l'aperçu iframe du builder).
// Scopé à .axs-store pour ne jamais affecter le dashboard.
export function StorefrontTypography({ fonts }: { fonts?: StorefrontFontsCfg }) {
  if (!fonts) return null;
  const href = googleFontsHref(fonts);
  const css = typographyCss(fonts, ".axs-store");
  return (
    <>
      {href && <link rel="stylesheet" href={href} />}
      <style dangerouslySetInnerHTML={{ __html: css }} />
    </>
  );
}
