// Injecte le CSS personnalisé écrit dans l'onglet "Avancé" du builder sur la
// vraie boutique — jusqu'ici appliqué uniquement à l'aperçu iframe du builder.
// Rendu après StorefrontTypography pour que le marchand puisse surcharger la
// typographie générée automatiquement s'il le souhaite.
export function StorefrontCustomCss({ css }: { css?: string }) {
  if (!css?.trim()) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
