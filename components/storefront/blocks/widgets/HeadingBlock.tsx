"use client";

import type { BlockRenderProps } from "../types";
import { InlineEditable } from "./InlineEditable";

const TAILLE_MAP: Record<string, string> = {
  h1: "text-4xl sm:text-5xl font-bold",
  h2: "text-3xl sm:text-4xl font-bold",
  h3: "text-2xl sm:text-3xl font-semibold",
  h4: "text-xl sm:text-2xl font-semibold",
};

export function HeadingBlock({ config, colors, editable, onEditText }: BlockRenderProps) {
  const niveau = (config.niveau as string) || "h2";
  const align = (config.align as string) || "left";
  const texte = config.texte || "Titre";

  return (
    <div className={`py-2 ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}>
      <InlineEditable
        as={niveau as any}
        value={texte}
        editable={editable}
        onCommit={(t) => onEditText?.({ texte: t })}
        className={`${TAILLE_MAP[niveau] || TAILLE_MAP.h2} font-playfair`}
        style={{ color: colors.texte }}
      />
    </div>
  );
}
