"use client";

import { useDroppable } from "@dnd-kit/core";

// Zone de dépôt entre deux blocs (ou dans un conteneur vide) — chaque dépôt,
// qu'il vienne de la bibliothèque ou d'un nœud existant, cible toujours un
// `{parentId, index}` explicite, résolu via lib/block-tree.ts (insertNode /
// moveNode). Pas de useSortable : plus simple à raisonner correctement dans
// le temps disponible, au prix d'une réanimation moins fluide qu'un vrai
// SortableContext — accepté pour la vague 1.
export function DropIndicator({ parentId, index, empty, idPrefix = "gap" }: { parentId: string | null; index: number; empty?: boolean; idPrefix?: string }) {
  // idPrefix distingue les zones de dépôt du canevas de celles, identiques
  // en (parentId, index), du plan de page (PageOutlinePanel) — les deux
  // vivent dans le même DndContext en même temps, donc leurs ids dnd-kit
  // doivent rester uniques même si elles ciblent la même position d'arbre.
  const { isOver, setNodeRef } = useDroppable({
    id: `${idPrefix}:${parentId ?? "root"}:${index}`,
    data: { parentId, index },
  });

  if (empty) {
    return (
      <div
        ref={setNodeRef}
        className={`flex items-center justify-center rounded-lg border-2 border-dashed text-[13px] font-medium transition-all ${
          isOver ? "border-[#F5A623] bg-[#F5A623]/10 text-[#F5A623] py-6" : "border-gray-200 text-gray-400 py-4"
        }`}
      >
        Dépose un bloc ici
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className="relative" style={{ height: isOver ? 10 : 6 }}>
      {isOver && <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 rounded-full bg-[#F5A623]" />}
    </div>
  );
}
