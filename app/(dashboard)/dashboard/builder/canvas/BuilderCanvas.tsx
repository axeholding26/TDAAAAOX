"use client";

import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Sparkles } from "lucide-react";
import type { ThemeConfig, BlockNode, BlockStyleOverrides } from "@/lib/theme-config";
import { insertNode, moveNode, removeNode, duplicateNode, updateNodeStyle, updateNodeResponsiveStyle, updateNodeConfig, toggleNodeActif, findNode } from "@/lib/block-tree";
import { BlockLibraryPanel } from "./BlockLibraryPanel";
import { BlockStylePanel } from "./BlockStylePanel";
import { CanvasNode } from "./CanvasNode";
import { DropIndicator } from "./DropIndicator";
import { createDefaultNode, createStarterSection, BLOCK_LIBRARY_ITEMS } from "./blockDefaults";
import { AxiaBuilderPanel } from "./AxiaBuilderPanel";

type Device = "desktop" | "tablet" | "mobile";

interface Props {
  config: ThemeConfig;
  set: (updater: (p: ThemeConfig) => ThemeConfig) => void;
  slug: string;
  device: Device;
  onSyncWithServer: () => Promise<void>;
}

// Largeurs miroir de l'aperçu iframe du constructeur classique — même
// convention visuelle pour les deux modes. container-type:inline-size fait
// de cette boîte le point de référence des @container émis par
// blockResponsiveCss (vague 3) : la rétrécir ici suffit à activer en direct
// les surcharges tablette/mobile, sans iframe ni détection d'appareil.
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };

const SECTION_PY_MAP: Record<string, string> = { sm: "py-8 sm:py-10", md: "py-12 sm:py-16", lg: "py-16 sm:py-20", xl: "py-20 sm:py-28" };

// Canevas du constructeur libre (vague 1) — arbre React rendu directement
// dans le tableau de bord (pas d'iframe, voir décision d'architecture du
// plan). Bibliothèque à gauche, canevas au centre, panneau de style à
// droite ; toute mutation passe par lib/block-tree.ts.
export function BuilderCanvas({ config, set, slug, device, onSyncWithServer }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggedLabel, setDraggedLabel] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const tree = config.builderTree ?? [];

  const layoutCfg = config.layout ?? {};
  const container = layoutCfg.largeurContainer === "100%" ? "max-w-full" : `max-w-[${layoutCfg.largeurContainer || "1280px"}]`;
  const sectionPy = SECTION_PY_MAP[layoutCfg.paddingSection || "lg"];
  const ctx = useMemo(() => ({ slug, colors: config.colors, container, sectionPy, editable: true as const }), [slug, config.colors, container, sectionPy]);

  const setTree = (updater: (t: BlockNode[]) => BlockNode[]) => set((p) => ({ ...p, builderTree: updater(p.builderTree ?? []) }));

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as any;
    if (data?.kind === "library") {
      setDraggedLabel(BLOCK_LIBRARY_ITEMS.find((i) => i.type === data.blockType)?.label || data.blockType);
    } else if (data?.kind === "node") {
      const n = findNode(tree, data.nodeId);
      setDraggedLabel(n?.type || null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedLabel(null);
    const { active, over } = event;
    if (!over) return;
    const activeData = active.data.current as any;
    const overData = over.data.current as { parentId: string | null; index: number };
    if (!activeData || !overData) return;

    if (activeData.kind === "library") {
      const noeud = createDefaultNode(activeData.blockType);
      setTree((t) => insertNode(t, overData.parentId, overData.index, noeud));
      setSelectedNodeId(noeud.id);
    } else if (activeData.kind === "node") {
      setTree((t) => moveNode(t, activeData.nodeId, overData.parentId, overData.index));
    }
  };

  const selectedNode = selectedNodeId ? findNode(tree, selectedNodeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <BlockLibraryPanel onInsertTemplate={(templateNode) => { setTree((t) => insertNode(t, null, t.length, templateNode)); setSelectedNodeId(templateNode.id); }} />

      <div className="flex-1 bg-[#EEF0F6] overflow-y-auto scrollbar-thin p-6" onClick={() => setSelectedNodeId(null)}>
        <div
          className="mx-auto bg-white rounded-xl shadow-sm min-h-[70vh] overflow-hidden transition-all duration-300"
          style={{ backgroundColor: config.colors.fond, color: config.colors.texte, width: DEVICE_WIDTH[device], maxWidth: "100%", containerType: "inline-size" }}
          onClick={(e) => e.stopPropagation()}
        >
          {tree.length === 0 ? (
            <div className="p-10 flex flex-col items-center gap-4">
              <DropIndicator parentId={null} index={0} empty />
              <button
                onClick={() => { const s = createStarterSection(); setTree((t) => [...t, s]); setSelectedNodeId(s.id); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: "#F5A623", color: "#050508" }}
              >
                <Sparkles size={12} /> Ajouter une section de départ
              </button>
            </div>
          ) : (
            <>
              <DropIndicator parentId={null} index={0} />
              {tree.map((node, i) => (
                <div key={node.id}>
                  <CanvasNode
                    node={node}
                    parentId={null}
                    ctx={ctx}
                    selectedNodeId={selectedNodeId}
                    onSelect={setSelectedNodeId}
                    onDuplicate={(id) => setTree((t) => duplicateNode(t, id))}
                    onDelete={(id) => { setTree((t) => removeNode(t, id)); setSelectedNodeId((cur) => (cur === id ? null : cur)); }}
                    onToggleActif={(id) => setTree((t) => toggleNodeActif(t, id))}
                    onChangeConfig={(id, patch) => setTree((t) => updateNodeConfig(t, id, patch))}
                    onResizeColumns={(leftId, rightId, leftPct, rightPct) => setTree((t) => updateNodeStyle(updateNodeStyle(t, leftId, { width: `${leftPct}%` }), rightId, { width: `${rightPct}%` }))}
                  />
                  <DropIndicator parentId={null} index={i + 1} />
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {selectedNode && (
        <BlockStylePanel
          node={selectedNode}
          device={device}
          onChangeStyle={(patch) => setTree((t) => updateNodeStyle(t, selectedNode.id, patch))}
          onChangeResponsiveStyle={(breakpoint, patch) => setTree((t) => updateNodeResponsiveStyle(t, selectedNode.id, breakpoint, patch))}
          onChangeConfig={(patch) => setTree((t) => updateNodeConfig(t, selectedNode.id, patch))}
          onDuplicate={() => setTree((t) => duplicateNode(t, selectedNode.id))}
          onDelete={() => { setTree((t) => removeNode(t, selectedNode.id)); setSelectedNodeId(null); }}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      <AxiaBuilderPanel onSyncWithServer={onSyncWithServer} />

      <DragOverlay>
        {draggedLabel && (
          <div className="px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg" style={{ backgroundColor: "#F5A623", color: "#050508" }}>
            {draggedLabel}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
