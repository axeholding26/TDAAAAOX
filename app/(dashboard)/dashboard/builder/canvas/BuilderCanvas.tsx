"use client";

import { useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Sparkles } from "lucide-react";
import type { ThemeConfig, BlockNode, BlockStyleOverrides } from "@/lib/theme-config";
import { insertNode, moveNode, moveNodeRelative, removeNode, duplicateNode, updateNodeStyle, updateNodeResponsiveStyle, updateNodeConfig, toggleNodeActif, findNode, getSiblingPosition, genBlockId } from "@/lib/block-tree";
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
  // "boutique" (physique, catalogue) = habillage Shopify — bibliothèque de
  // blocs complète, ordre neutre. "landing" (digital, vente_unique) =
  // habillage Chariow/Lovable — bibliothèque réordonnée pour prioriser la
  // conversion (compte à rebours, vidéo, témoignages, FAQ, CTA avant les
  // blocs catalogue) et panneau AXIA ouvert par défaut (chat-first, comme
  // Lovable) plutôt qu'une bulle repliée. Même moteur, même données —
  // seul l'habillage change, voir BlockLibraryPanel.
  variante?: "boutique" | "landing";
  // Quand fourni, remplace la bibliothèque de blocs (colonne de gauche) par
  // ce contenu — les panneaux de réglages globaux (couleurs, typo...) de
  // builder/page.tsx, pour que l'aperçu live reste visible pendant qu'on les
  // édite (comme Shopify : le thème change, la page reste visible), sans
  // dupliquer le canevas dans une iframe séparée.
  leftPanelOverride?: React.ReactNode;
}

// Largeurs miroir de l'aperçu iframe du constructeur classique — même
// convention visuelle pour les deux modes.
const DEVICE_WIDTH: Record<Device, string> = { desktop: "100%", tablet: "768px", mobile: "390px" };

const SECTION_PY_MAP: Record<string, string> = { sm: "py-8 sm:py-10", md: "py-12 sm:py-16", lg: "py-16 sm:py-20", xl: "py-20 sm:py-28" };

// Canevas du constructeur libre (vague 1) — arbre React rendu directement
// dans le tableau de bord (pas d'iframe, voir décision d'architecture du
// plan). Bibliothèque à gauche, canevas au centre, panneau de style à
// droite ; toute mutation passe par lib/block-tree.ts.
export function BuilderCanvas({ config, set, slug, device, onSyncWithServer, variante = "boutique", leftPanelOverride }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [draggedLabel, setDraggedLabel] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const tree = config.builderTree ?? [];

  const layoutCfg = config.layout ?? {};
  const container = layoutCfg.largeurContainer === "100%" ? "max-w-full" : `max-w-[${layoutCfg.largeurContainer || "1280px"}]`;
  const sectionPy = SECTION_PY_MAP[layoutCfg.paddingSection || "lg"];
  const ctx = useMemo(() => ({ slug, colors: config.colors, container, sectionPy, editable: true as const }), [slug, config.colors, container, sectionPy]);

  const setTree = (updater: (t: BlockNode[]) => BlockNode[]) => set((p) => ({ ...p, builderTree: updater(p.builderTree ?? []) }));

  // Pont AXSO Design → Constructeur libre : enveloppe le design cloné
  // existant (config.builderHtml/builderCss, voir lib/axso-design-library.ts)
  // dans un unique bloc "embed-html", une fois, pour que la boutique quitte
  // le rendu figé (ImportedLiteralHomePage) au profit de l'arbre de blocs —
  // app/(storefront)/[slug]/page.tsx préfère déjà builderTree sur builderHtml
  // dès que le premier est non vide, aucun autre changement de rendu requis.
  // Le contenu importé n'est pas décomposé en sous-blocs éditables (limitation
  // assumée) : le marchand peut le déplacer/supprimer et ajouter de VRAIS
  // nouveaux blocs autour, mais pas éditer son contenu champ par champ.
  //
  // Déclenché automatiquement (voir l'effet ci-dessous), jamais par un
  // bouton — le marchand doit tomber directement sur son design, pas sur un
  // canevas vide. Idempotent PAR CONSTRUCTION, jamais via un ref/état de
  // composant (démonté/remonté au moindre changement d'onglet ou Fast
  // Refresh en dev, ce qui rouvrait la porte à un second import et donc à
  // un bloc dupliqué) : la vérification "déjà importé ?" se fait DANS le
  // setter fonctionnel, sur l'état le plus frais possible au moment où
  // React l'applique réellement, jamais sur une fermeture (closure) périmée.
  const importerDesignExistant = () => {
    set((p) => {
      if ((p.builderTree?.length ?? 0) > 0) return p; // déjà importé — no-op
      if (!p.builderHtml) return p;
      const embed: BlockNode = { id: genBlockId("embed-html"), type: "embed-html", config: { html: p.builderHtml, css: p.builderCss } };
      const colonne: BlockNode = { id: genBlockId("col"), type: "column", children: [embed] };
      const ligne: BlockNode = { id: genBlockId("row"), type: "row", children: [colonne] };
      const sectionRacine: BlockNode = { id: genBlockId("section"), type: "section", children: [ligne] };
      return { ...p, builderTree: [sectionRacine] };
    });
  };

  useEffect(() => {
    if (tree.length === 0 && config.builderHtml) importerDesignExistant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length, config.builderHtml]);

  // Sélectionne le bloc importé dès qu'il apparaît (une fois), pour que le
  // panneau de style s'ouvre directement dessus — hors du setter ci-dessus
  // (jamais d'effet de bord dans un updater React, potentiellement rejoué).
  useEffect(() => {
    if (selectedNodeId) return;
    const embed = tree.find((n) => n.children?.[0]?.children?.[0]?.type === "embed-html");
    if (embed) setSelectedNodeId(embed.children![0].children![0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree.length]);

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
  const selectedPosition = selectedNodeId ? getSiblingPosition(tree, selectedNodeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {leftPanelOverride ?? (
        <BlockLibraryPanel
          variante={variante}
          onInsertTemplate={(templateNode) => { setTree((t) => insertNode(t, null, t.length, templateNode)); setSelectedNodeId(templateNode.id); }}
          tree={tree}
          selectedNodeId={selectedNodeId}
          onSelect={setSelectedNodeId}
          onDuplicateNode={(id) => setTree((t) => duplicateNode(t, id))}
          onDeleteNode={(id) => { setTree((t) => removeNode(t, id)); setSelectedNodeId((cur) => (cur === id ? null : cur)); }}
          onToggleActif={(id) => setTree((t) => toggleNodeActif(t, id))}
        />
      )}

      <div className="flex-1 bg-[#EEF0F6] overflow-y-auto scrollbar-thin p-6" onClick={() => setSelectedNodeId(null)}>
        <div
          // PAS de containerType:"inline-size" ici (contrairement à une
          // version antérieure) : cette boîte a un frère (leftPanelOverride /
          // BlockLibraryPanel, voir page.tsx) qui se monte/démonte à chaque
          // changement d'onglet du panneau de gauche (Sections ↔ Couleurs ↔
          // Typo ↔ ...). Un conteneur de container-query dont un FRÈRE se
          // monte/démonte dans le même DndContext casse durablement le
          // hit-testing de TOUTE la page dans Chromium — reproductible à
          // 100%, y compris avec une largeur strictement stable des deux
          // côtés (testé : ni la largeur, ni la transition n'étaient en
          // cause, seule la présence de container-type l'était) : plus un
          // seul clic ne fonctionnait nulle part (canevas, barre latérale,
          // rien) jusqu'au rechargement complet de la page — exactement le
          // "ça disparaît à chaque clic, impossible de rouvrir" remonté.
          // Conséquence acceptée : les surcharges tablette/mobile par bloc
          // (vague 3, ResponsiveStyleTag/@container) ne se prévisualisent
          // plus en direct ICI en changeant l'appareil simulé — mais restent
          // enregistrées et s'appliquent normalement sur la vraie vitrine
          // (app/(storefront)/[slug]/page.tsx a son propre conteneur stable,
          // sans frère qui se démonte, donc non affecté par ce bug).
          className="mx-auto bg-white rounded-xl shadow-sm min-h-[70vh] overflow-hidden transition-colors duration-300"
          style={{ backgroundColor: config.colors.fond, color: config.colors.texte, width: DEVICE_WIDTH[device], maxWidth: "100%" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Conteneur de référence des blocs (@container) — sur un enfant stable de
              la boîte, jamais sur la boîte elle-même (voir la note ci-dessus). */}
          <div style={{ containerType: "inline-size" }}>
          {tree.length === 0 ? (
            config.builderHtml ? (
              // Import automatique en cours (voir l'effet ci-dessus) — ne
              // dure qu'un instant, jamais de bouton à cliquer : le marchand
              // doit tomber directement sur le design qu'il a choisi.
              <div className="p-10 flex flex-col items-center gap-3 text-gray-400">
                <div className="w-5 h-5 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">Chargement de ton design…</p>
              </div>
            ) : (
              <div className="p-10 flex flex-col items-center gap-4">
                <DropIndicator parentId={null} index={0} empty />
                <button
                  onClick={() => { const s = createStarterSection(); setTree((t) => [...t, s]); setSelectedNodeId(s.id); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ backgroundColor: "#F5A623", color: "#050508" }}
                >
                  <Sparkles size={12} /> {variante === "landing" ? "Commencer ma page de vente" : "Ajouter une section de départ"}
                </button>
                {variante === "landing" && (
                  <p className="text-[12px] text-gray-400 text-center max-w-xs -mt-1">Ou décris ta page à AXIA (bulle en bas à droite) — elle construit la structure à ta place.</p>
                )}
              </div>
            )
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
      </div>

      {selectedNode && !leftPanelOverride && (
        <BlockStylePanel
          node={selectedNode}
          device={device}
          canMoveUp={!!selectedPosition && selectedPosition.index > 0}
          canMoveDown={!!selectedPosition && selectedPosition.index < selectedPosition.total - 1}
          onMoveUp={() => setTree((t) => moveNodeRelative(t, selectedNode.id, "up"))}
          onMoveDown={() => setTree((t) => moveNodeRelative(t, selectedNode.id, "down"))}
          onChangeStyle={(patch) => setTree((t) => updateNodeStyle(t, selectedNode.id, patch))}
          onChangeResponsiveStyle={(breakpoint, patch) => setTree((t) => updateNodeResponsiveStyle(t, selectedNode.id, breakpoint, patch))}
          onChangeConfig={(patch) => setTree((t) => updateNodeConfig(t, selectedNode.id, patch))}
          onDuplicate={() => setTree((t) => duplicateNode(t, selectedNode.id))}
          onDelete={() => { setTree((t) => removeNode(t, selectedNode.id)); setSelectedNodeId(null); }}
          onClose={() => setSelectedNodeId(null)}
        />
      )}

      <AxiaBuilderPanel onSyncWithServer={onSyncWithServer} defaultOpen={variante === "landing"} variante={variante} />

      <DragOverlay>
        {draggedLabel && (
          <div className="px-3 py-1.5 rounded-lg text-sm font-semibold shadow-lg" style={{ backgroundColor: "#F5A623", color: "#050508" }}>
            {draggedLabel}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
