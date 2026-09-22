"use client";

import { useRef, useState } from "react";

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
//
// Pointer Events + setPointerCapture (PAS mousedown/mousemove/mouseup sur
// `window`, comme avant) : sans capture, si le bouton est relâché hors de la
// fenêtre (curseur sorti du viewport pendant un geste rapide), aucun mouseup
// n'atteint jamais `window` — les listeners mousemove/mouseup restaient
// attachés indéfiniment, continuant à recalculer/écrire dans l'arbre à
// chaque mouvement de souris ULTÉRIEUR et sans rapport (ex: en glissant un
// bloc de la bibliothèque juste après), avec des `leftId`/`rightId`/`startX`
// figés sur ce geste périmé — la cause du "template qui se déforme et les
// composants qui se superposent" lors d'interactions suivantes. Capturer le
// pointeur sur l'élément garantit que CET élément reçoit pointerup/
// pointercancel dans tous les cas (même hors fenêtre, même si l'onglet perd
// le focus), donc que le nettoyage s'exécute toujours.
export function ColumnResizeHandle({ leftId, rightId, onResize }: Props) {
  const [dragging, setDragging] = useState(false);
  // État du geste en cours dans un ref (pas de re-render par pixel déplacé) —
  // seul `onResize` (donc l'arbre) est mis à jour à chaque mouvement.
  const drag = useRef<{ startX: number; totalPx: number; startLeftPct: number; startRightPct: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const leftEl = document.querySelector(`[data-axs-id="${leftId}"]`) as HTMLElement | null;
    const rightEl = document.querySelector(`[data-axs-id="${rightId}"]`) as HTMLElement | null;
    if (!leftEl || !rightEl) return;

    const leftRect = leftEl.getBoundingClientRect();
    const rightRect = rightEl.getBoundingClientRect();
    const totalPx = leftRect.width + rightRect.width;
    drag.current = {
      startX: e.clientX, totalPx,
      startLeftPct: (leftRect.width / totalPx) * 100,
      startRightPct: (rightRect.width / totalPx) * 100,
    };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const { startX, totalPx, startLeftPct, startRightPct } = drag.current;
    const deltaPct = ((e.clientX - startX) / totalPx) * 100;
    let leftPct = startLeftPct + deltaPct;
    let rightPct = startRightPct - deltaPct;
    if (leftPct < MIN_PCT) { rightPct -= (MIN_PCT - leftPct); leftPct = MIN_PCT; }
    if (rightPct < MIN_PCT) { leftPct -= (MIN_PCT - rightPct); rightPct = MIN_PCT; }
    onResize(Math.round(leftPct * 10) / 10, Math.round(rightPct * 10) / 10);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={(e) => e.stopPropagation()}
      style={{ touchAction: "none" }}
      className="hidden sm:flex items-center justify-center w-4 flex-shrink-0 cursor-col-resize z-10 group/resize"
      title="Glisser pour redimensionner les colonnes"
    >
      <div className={`w-0.5 h-10 rounded-full transition-colors ${dragging ? "bg-[#F5A623]" : "bg-gray-200 group-hover/resize:bg-gray-400"}`} />
    </div>
  );
}
