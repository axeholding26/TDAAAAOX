"use client";

import { createElement } from "react";

interface Props {
  as: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
  value: string;
  onCommit: (texte: string) => void;
  editable?: boolean;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Édition de texte inline directement sur le canevas — premier vrai WYSIWYG
// (vague 2), utilisé par HeadingBlock/TextBlock/ButtonBlock. En dehors du
// canevas (editable=false, cas SSR storefront) rend un élément statique
// classique, sans aucune interactivité ni JS d'édition. Rendu via
// React.createElement (plutôt que JSX <Tag>) car un nom de balise dynamique
// typé par union (keyof JSX.IntrinsicElements) fait autrement collapser les
// props JSX vers `never` — limitation connue du typage JSX de React/TS.
export function InlineEditable({ as: tag, value, onCommit, editable, multiline, className, style }: Props) {
  if (!editable) {
    return createElement(tag, { className, style: { ...style, whiteSpace: multiline ? "pre-wrap" : undefined } }, value);
  }

  return createElement(
    tag,
    {
      className: `${className || ""} outline-none focus:ring-2 focus:ring-[#F5A623]/50 rounded-sm`,
      style: { ...style, whiteSpace: multiline ? "pre-wrap" : undefined, cursor: "text" },
      contentEditable: true,
      suppressContentEditableWarning: true,
      onKeyDown: (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (!multiline && e.key === "Enter") { e.preventDefault(); (e.target as HTMLElement).blur(); }
        if (e.key === "Escape") { e.preventDefault(); (e.target as HTMLElement).blur(); }
      },
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        const texte = e.currentTarget.innerText;
        if (texte !== value) onCommit(texte);
      },
    },
    value
  );
}
