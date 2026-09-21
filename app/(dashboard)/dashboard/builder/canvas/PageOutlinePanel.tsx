"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Eye, EyeOff, Copy, Trash2, LayoutGrid, Rows3, Columns3, Code2 } from "lucide-react";
import type { BlockNode, BlockNodeType } from "@/lib/theme-config";
import { BLOCK_LIBRARY_ITEMS } from "./blockDefaults";
import { LABELS } from "./CanvasNode";
import { DropIndicator } from "./DropIndicator";

const ICON_BY_TYPE: Partial<Record<BlockNodeType, any>> = Object.fromEntries(BLOCK_LIBRARY_ITEMS.map((i) => [i.type, i.Icon]));
ICON_BY_TYPE.section = LayoutGrid;
ICON_BY_TYPE.row = Rows3;
ICON_BY_TYPE.column = Columns3;
(ICON_BY_TYPE as any)["embed-html"] = Code2;

const STRUCTURELS = new Set<BlockNodeType>(["section", "row", "column"]);

interface OutlineRowProps {
  node: BlockNode;
  parentId: string | null;
  depth: number;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActif: (id: string) => void;
}

// Ligne du plan de page — même DndContext que le canevas (id `node:${id}`,
// data { kind: "node", nodeId, currentParentId, type }) : BuilderCanvas.
// handleDragEnd ne fait aucune distinction entre une poignée saisie dans le
// canevas ou ici, donc glisser une ligne du plan réordonne réellement
// l'arbre — pas une liste parallèle à synchroniser à la main.
function OutlineRow({ node, parentId, depth, selectedNodeId, onSelect, onDuplicate, onDelete, onToggleActif }: OutlineRowProps) {
  // id préfixé "outline-" : ce même nœud a déjà une poignée useDraggable
  // dans CanvasNode (canevas), les deux vivant dans le même DndContext en
  // même temps — seul `data.nodeId` compte pour handleDragEnd/handleDragStart,
  // l'id dnd-kit lui-même doit juste rester unique.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `outline-node:${node.id}`,
    data: { kind: "node", nodeId: node.id, currentParentId: parentId, type: node.type },
  });

  const structurel = STRUCTURELS.has(node.type);
  const selectionne = selectedNodeId === node.id;
  const desactive = node.actif === false;
  const Icon = ICON_BY_TYPE[node.type] || LayoutGrid;
  const children = node.children ?? [];

  return (
    <div ref={setNodeRef} className={isDragging ? "opacity-30" : ""}>
      <div
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`group/row flex items-center gap-1.5 pr-1.5 py-1.5 rounded-lg cursor-pointer transition-all ${
          selectionne ? "bg-[#F5A623]/15 text-[#050508]" : "hover:bg-gray-50 text-gray-700"
        } ${desactive ? "opacity-40" : ""}`}
      >
        <span {...attributes} {...listeners} style={{ touchAction: "none" }} className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing" title="Réordonner">
          <GripVertical size={11} />
        </span>
        <Icon size={13} className={`flex-shrink-0 ${structurel ? "text-gray-400" : selectionne ? "text-[#F5A623]" : "text-gray-500"}`} />
        <span className={`flex-1 min-w-0 truncate ${structurel ? "text-[12px] text-gray-400" : "text-[13px] font-medium"}`}>
          {LABELS[node.type] || node.type}
        </span>
        <div className="hidden group-hover/row:flex items-center gap-0.5 flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onToggleActif(node.id); }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700" title={desactive ? "Afficher" : "Masquer"}>
            {desactive ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(node.id); }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700" title="Dupliquer">
            <Copy size={11} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-500" title="Supprimer">
            <Trash2 size={11} />
          </button>
        </div>
      </div>
      {children.length > 0 && (
        <div>
          <DropIndicator parentId={node.id} index={0} idPrefix="outline-gap" />
          {children.map((child, i) => (
            <div key={child.id}>
              <OutlineRow node={child} parentId={node.id} depth={depth + 1} selectedNodeId={selectedNodeId} onSelect={onSelect} onDuplicate={onDuplicate} onDelete={onDelete} onToggleActif={onToggleActif} />
              <DropIndicator parentId={node.id} index={i + 1} idPrefix="outline-gap" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  tree: BlockNode[];
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActif: (id: string) => void;
  onAddSection: () => void;
}

// Plan de la page façon Shopify Online Store 2.0 — reflète les sections
// RÉELLEMENT présentes sur la page (pas une palette de blocs à ajouter, voir
// BlockLibraryPanel pour ça), cliquables pour sélectionner/éditer,
// réordonnables par glisser-déposer. C'est la vue par défaut du panneau de
// gauche ; « + Ajouter une section » bascule vers l'onglet Blocs.
export function PageOutlinePanel({ tree, selectedNodeId, onSelect, onDuplicate, onDelete, onToggleActif, onAddSection }: Props) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-2 flex flex-col">
      {tree.length === 0 ? (
        <p className="text-[12px] text-gray-400 text-center py-6 px-2">Ta page est vide pour l'instant — ajoute une section pour commencer.</p>
      ) : (
        <div className="flex-1">
          <DropIndicator parentId={null} index={0} idPrefix="outline-gap" />
          {tree.map((node, i) => (
            <div key={node.id}>
              <OutlineRow node={node} parentId={null} depth={0} selectedNodeId={selectedNodeId} onSelect={onSelect} onDuplicate={onDuplicate} onDelete={onDelete} onToggleActif={onToggleActif} />
              <DropIndicator parentId={null} index={i + 1} idPrefix="outline-gap" />
            </div>
          ))}
        </div>
      )}
      <button
        onClick={onAddSection}
        className="mt-2 flex-shrink-0 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-gray-300 text-[13px] font-semibold text-gray-500 hover:border-[#F5A623] hover:text-[#F5A623] hover:bg-[#F5A623]/5 transition-all"
      >
        <LayoutGrid size={13} /> Ajouter une section
      </button>
    </div>
  );
}
