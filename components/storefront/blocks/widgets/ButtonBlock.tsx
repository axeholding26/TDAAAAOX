"use client";

import type { BlockRenderProps } from "../types";
import { InlineEditable } from "./InlineEditable";
import { useT } from "@/components/I18nProvider";
import { hrefBoutique } from "@/lib/utils";

const TAILLE_MAP: Record<string, string> = { sm: "px-4 py-2 text-xs", md: "px-6 py-3 text-sm", lg: "px-8 py-4 text-base" };

export function ButtonBlock({ config, colors, slug, container, editable, onEditText }: BlockRenderProps) {
  const tr = useT();
  const style = (config.style as string) || "primary";
  const taille = TAILLE_MAP[(config.taille as string) || "md"];
  const align = (config.align as string) || "left";
  const texte = config.texte || "Bouton";
  const lien = hrefBoutique(slug, config.lien);

  const styleProps =
    style === "outline" ? { backgroundColor: "transparent", color: colors.contourBouton || colors.accent, border: `2px solid ${colors.contourBouton || colors.accent}` } :
    style === "ghost" ? { backgroundColor: "transparent", color: colors.contourBouton || colors.accent } :
    { backgroundColor: colors.accent, color: colors.texteBouton || colors.fond };

  const contenu = (
    <span
      data-axs-cible=""
      className={`inline-flex items-center justify-center rounded-full font-semibold transition-transform hover:scale-105 ${taille}`}
      style={styleProps}
    >
      <InlineEditable as="span" value={texte} editable={editable} onCommit={(t) => onEditText?.({ texte: t })} />
    </span>
  );

  return (
    <div data-axs-align="" className={`py-2 ${container} mx-auto px-4 @min-[640px]:px-6 @min-[1024px]:px-8 flex ${align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start"}`}>
      {editable || !lien ? tr(contenu) : <a href={lien}>{tr(contenu)}</a>}
    </div>
  );
}
