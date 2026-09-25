"use client";

import type { BlockRenderProps } from "../types";
import { InlineEditable } from "./InlineEditable";

export function TextBlock({ config, colors, container, editable, onEditText }: BlockRenderProps) {
  const align = (config.align as string) || "left";
  const texte = config.texte || "Votre texte ici — cliquez pour modifier.";

  return (
    <div className={`py-2 ${container} mx-auto px-4 @min-[640px]:px-6 @min-[1024px]:px-8 ${align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left"}`}>
      <InlineEditable
        as="p"
        value={texte}
        editable={editable}
        cible
        multiline
        onCommit={(t) => onEditText?.({ texte: t })}
        className="text-base leading-relaxed max-w-2xl"
        style={{ color: colors.texte, opacity: 0.8, marginLeft: align === "center" ? "auto" : undefined, marginRight: align === "center" ? "auto" : align === "right" ? "0" : undefined }}
      />
    </div>
  );
}
