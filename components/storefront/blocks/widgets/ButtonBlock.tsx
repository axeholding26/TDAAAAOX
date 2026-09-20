"use client";

import type { BlockRenderProps } from "../types";
import { InlineEditable } from "./InlineEditable";

const TAILLE_MAP: Record<string, string> = { sm: "px-4 py-2 text-xs", md: "px-6 py-3 text-sm", lg: "px-8 py-4 text-base" };

export function ButtonBlock({ config, colors, editable, onEditText }: BlockRenderProps) {
  const style = (config.style as string) || "primary";
  const taille = TAILLE_MAP[(config.taille as string) || "md"];
  const align = (config.align as string) || "left";
  const texte = config.texte || "Bouton";
  const lien = config.lien || "#";

  const styleProps =
    style === "outline" ? { backgroundColor: "transparent", color: colors.accent, border: `2px solid ${colors.accent}` } :
    style === "ghost" ? { backgroundColor: "transparent", color: colors.accent } :
    { backgroundColor: colors.accent, color: colors.fond };

  const contenu = (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-transform hover:scale-105 ${taille}`}
      style={styleProps}
    >
      <InlineEditable as="span" value={texte} editable={editable} onCommit={(t) => onEditText?.({ texte: t })} />
    </span>
  );

  return (
    <div className={`py-2 flex ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}>
      {editable ? contenu : <a href={lien}>{contenu}</a>}
    </div>
  );
}
