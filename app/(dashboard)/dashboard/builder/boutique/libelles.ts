import type { BlockNode } from "@/lib/theme-config";
import { LABELS } from "../canvas/CanvasNode";

/** Blocs « feuilles » d'une section (widgets), tous niveaux de lignes/colonnes confondus. */
export function blocsDe(node: BlockNode): BlockNode[] {
  return (node.children ?? []).flatMap((c) => (c.type === "row" || c.type === "column" ? blocsDe(c) : [c]));
}

/** Nom affiché d'une section ou d'un bloc (panneau de gauche, étiquette de l'aperçu). */
export function nomNoeud(node: BlockNode): string {
  if (node.type !== "section") return LABELS[node.type] || node.type;
  if (node.config?.nom) return node.config.nom;
  const premier = blocsDe(node)[0];
  return premier ? LABELS[premier.type] || "Section" : "Section vide";
}
