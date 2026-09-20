import type { BlockStyleOverrides } from "@/lib/theme-config";
import { blockResponsiveCss } from "./styleUtils";

// Émet le <style> (surcharges tablette/mobile + visibilité, vague 3) d'un
// nœud, ou rien si le nœud n'a aucune surcharge responsive — évite de
// polluer le DOM avec des balises <style> vides pour l'immense majorité des
// blocs (aucun réglage responsive personnalisé).
export function ResponsiveStyleTag({ nodeId, style }: { nodeId: string; style?: BlockStyleOverrides }) {
  const css = blockResponsiveCss(nodeId, style);
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
