import type { ThemeConfig, ThemeColors } from "@/lib/theme-config";

interface Props {
  cfg: ThemeConfig;
}

// Génère un bloc CSS qui surcharge les variables CSS du template en utilisant
// le mapping stocké à la provision (axsoDesignCssVarMapping). Injecté APRÈS
// le HTML du template pour avoir la priorité sur son propre :root{}.
function generateColorOverride(
  colors: ThemeColors,
  mapping: Record<string, string>,
): string {
  const decls: string[] = [];
  for (const [colorKey, varNamesStr] of Object.entries(mapping)) {
    const colorValue = (colors as unknown as Record<string, string | undefined>)[colorKey];
    if (!colorValue || !varNamesStr) continue;
    for (const varName of varNamesStr.split(",")) {
      decls.push(`${varName.trim()}: ${colorValue}`);
    }
  }
  return decls.length > 0 ? `:root { ${decls.join("; ")} }` : "";
}

// Rendu d'un thème importé tel quel (voir lib/theme-import-clone.ts) : le
// HTML/CSS envoyé par le marchand est conservé littéralement (même
// copywriting, même mise en page) — seuls les produits, le panier et la
// navigation ont été branchés sur de vraies données AXSO au moment de
// l'import. Aucun script n'a jamais été exécuté ni conservé.
export function ImportedLiteralHomePage({ cfg }: Props) {
  const colorOverride =
    cfg.axsoDesignCssVarMapping
      ? generateColorOverride(cfg.colors, cfg.axsoDesignCssVarMapping)
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
