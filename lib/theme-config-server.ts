import { prisma } from "@/lib/prisma";
import { THEME_DEFAULTS, resolveThemeConfig, mergeThemeConfig, type ThemeConfig } from "@/lib/theme-config";

export async function resolveThemeConfigAsync(
  themeId: string,
  tenantId: string,
  savedConfig: Record<string, any> = {}
): Promise<ThemeConfig> {
  // Socle interne ("terre-et-or", voir lib/theme-config.ts) — use sync resolver
  if (THEME_DEFAULTS[themeId]) {
    return resolveThemeConfig(themeId, savedConfig);
  }

  // Custom theme stored in DB
  const dbTheme = await prisma.theme.findFirst({
    where: { id: themeId, tenantId },
  });

  if (!dbTheme) {
    // Fallback to default
    return resolveThemeConfig("terre-et-or", savedConfig);
  }

  const dbConfig = dbTheme.config as Record<string, any>;
  const baseThemeId = dbConfig.baseThemeId || "terre-et-or";
  // resolveThemeConfig() replie déjà sur "terre-et-or" si l'id ne correspond
  // à rien (voir lib/theme-config.ts).
  const builtinBase = resolveThemeConfig(baseThemeId);

  // Empile 2 couches de surcharges : la définition du thème custom (dbConfig),
  // puis les édits live du tenant faits dans le builder (savedConfig) —
  // sans cette 2e couche, aucun changement fait dans le builder par un
  // marchand utilisant un thème custom ne se répercutait sur sa boutique.
  const themeBase = mergeThemeConfig(builtinBase, dbConfig);
  return mergeThemeConfig(themeBase, savedConfig);
}

export { resolveThemeConfig };
