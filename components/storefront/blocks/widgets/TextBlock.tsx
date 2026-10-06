"use client";

import type { BlockRenderProps } from "../types";
import { InlineEditable } from "./InlineEditable";

// Style du texte (comme Shopify) : corps, sous-titre ou petite légende en majuscules.
const STYLE_TEXTE: Record<string, { classe: string; opacite: number }> = {
  corps: { classe: "text-base leading-relaxed", opacite: 0.8 },
  "sous-titre": { classe: "text-lg @min-[640px]:text-xl leading-snug font-medium", opacite: 0.9 },
  majuscules: { classe: "text-xs font-semibold uppercase tracking-[0.18em]", opacite: 0.7 },
};

export function TextBlock({ config, colors, container, editable, onEditText }: BlockRenderProps) {
  const align = (config.align as string) || "left";
  const texte = config.texte || "Votre texte ici — cliquez pour modifier.";
  const st = STYLE_TEXTE[config.style as string] ?? STYLE_TEXTE.corps;

  return (
    <div data-axs-align="" className={`py-2 ${container} mx-auto px-4 @min-[640px]:px-6 @min-[1024px]:px-8 ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}>
      <InlineEditable
        as="p"
        value={texte}
        editable={editable}
        cible
        multiline
        onCommit={(t) => onEditText?.({ texte: t })}
        className={`${st.classe} max-w-2xl`}
        style={{ color: colors.texte, opacity: st.opacite, marginLeft: align === "center" ? "auto" : undefined, marginRight: align === "center" ? "auto" : align === "right" ? "0" : undefined }}
      />
    </div>
  );
}
