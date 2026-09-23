"use client";

import type { BlockRenderProps } from "../types";
import { InlineEditable } from "./InlineEditable";

const TAILLE_MAP: Record<string, string> = {
  h1: "text-4xl @min-[640px]:text-5xl font-bold",
  h2: "text-3xl @min-[640px]:text-4xl font-bold",
  h3: "text-2xl @min-[640px]:text-3xl font-semibold",
  h4: "text-xl @min-[640px]:text-2xl font-semibold",
};

export function HeadingBlock({ config, colors, container, editable, onEditText }: BlockRenderProps) {
  const niveau = (config.niveau as string) || "h2";
  const align = (config.align as string) || "left";
  const texte = config.texte || "Titre";

  return (
    <div className={`py-2 ${container} mx-auto px-4 @min-[640px]:px-6 @min-[1024px]:px-8 ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}>
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
