"use client";

import { useState } from "react";

interface Props {
  leftId: string;
  rightId: string;
  onResize: (leftPct: number, rightPct: number) => void;
}

const MIN_PCT = 15;

// Poignée de redimensionnement entre deux colonnes adjacentes d'une ligne
// (vague 3). Mesure les largeurs réelles au clic (getBoundingClientRect)
// plutôt que de dépendre de node.style.width : deux colonnes non encore
// redimensionnées se partagent l'espace via la classe Tailwind "flex-1"
// (égal, sans valeur explicite) — le premier glissé les "fige" en
// pourcentages explicites à partir de leur taille affichée à cet instant.
export function ColumnResizeHandle({ leftId, rightId, onResize }: Props) {
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const leftEl = document.querySelector(`[data-axs-id="${leftId}"]`) as HTMLElement | null;
    const rightEl = document.querySelector(`[data-axs-id="${rightId}"]`) as HTMLElement | null;
    if (!leftEl || !rightEl) return;

    const leftRect = leftEl.getBoundingClientRect();
    const rightRect = rightEl.getBoundingClientRect();
    const totalPx = leftRect.width + rightRect.width;
    const startX = e.clientX;
    const startLeftPct = (leftRect.width / totalPx) * 100;
    const startRightPct = (rightRect.width / totalPx) * 100;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const deltaPct = ((ev.clientX - startX) / totalPx) * 100;
      let leftPct = startLeftPct + deltaPct;
      let rightPct = startRightPct - deltaPct;
      if (leftPct < MIN_PCT) { rightPct -= (MIN_PCT - leftPct); leftPct = MIN_PCT; }
      if (rightPct < MIN_PCT) { leftPct -= (MIN_PCT - rightPct); rightPct = MIN_PCT; }
      onResize(Math.round(leftPct * 10) / 10, Math.round(rightPct * 10) / 10);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onClick={(e) => e.stopPropagation()}
      className="hidden sm:flex items-center justify-center w-4 flex-shrink-0 cursor-col-resize z-10 group/resize"
      title="Glisser pour redimensionner les colonnes"
    >
      <div className={`w-0.5 h-10 rounded-full transition-colors ${dragging ? "bg-[#F5A623]" : "bg-gray-200 group-hover/resize:bg-gray-400"}`} />
    </div>
  );
}
