import { useMemo } from "react";

// Feuille <style> qui ne se réécrit que si son CSS change : React 19 compare
// l'objet {__html} par référence, donc un objet neuf à chaque rendu relançait
// l'analyse du CSS et le recalcul de style de toute la page à chaque rendu.
export function StyleCss({ css }: { css: string }) {
  const html = useMemo(() => ({ __html: css }), [css]);
  return <style dangerouslySetInnerHTML={html} />;
}
