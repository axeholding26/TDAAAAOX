"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical, Copy, Trash2, EyeOff, Eye, Package } from "lucide-react";
import type { BlockNode } from "@/lib/theme-config";
import { BLOCK_REGISTRY } from "@/components/storefront/blocks/registry";
import { blockStyleToCss } from "@/components/storefront/blocks/styleUtils";
import { ResponsiveStyleTag } from "@/components/storefront/blocks/ResponsiveStyleTag";
import type { TreeRenderCtx } from "@/components/storefront/blocks/context";
import { DropIndicator } from "./DropIndicator";
import { ColumnResizeHandle } from "./ColumnResizeHandle";

export const LABELS: Record<string, string> = {
  section: "Section", row: "Ligne", column: "Colonne",
  features: "Avantages", stats: "Statistiques", countdown: "Compte à rebours", brands: "Logos",
  video: "Vidéo", gallery: "Galerie", "social-proof": "Preuve sociale", "cta-band": "Bande CTA",
  richtext: "Texte riche", spacer: "Espacement", tabs: "Onglets", columns: "Colonnes",
  heading: "Titre", text: "Texte", image: "Image", button: "Bouton", products: "Produits",
  "embed-html": "Design importé",
};

// Rendu directement dans le canevas côté client — le widget « Produits »
// interroge Prisma (voir components/storefront/blocks/widgets/ProductsBlock.tsx),
// ce qui n'est possible que côté SSR storefront. Un aperçu statique
// représentatif (piloté par nombre/colonnes) le remplace ici.
export function ProductsCanvasPreview({ config }: { config: Record<string, any> }) {
  const nombre = Math.min(Math.max(Number(config.nombre) || 8, 1), 8);
  const colonnes = Number(config.colonnes) || 4;
  return (
    <div className="py-2">
      {config.titre && <h2 className="text-2xl font-bold font-playfair mb-4">{config.titre}</h2>}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}>
        {Array.from({ length: nombre }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
            <div className="aspect-square flex items-center justify-center bg-gray-100"><Package size={24} className="text-gray-300" /></div>
            <div className="p-2 space-y-1">
              <div className="h-2 bg-gray-200 rounded w-4/5" />
              <div className="h-2 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-gray-400 mt-2">Aperçu — les vrais produits s'affichent sur la boutique en ligne.</p>
    </div>
  );
}

const TYPES_EDITABLE_INLINE = new Set(["heading", "text", "button"]);

interface CanvasNodeProps {
  node: BlockNode;
  parentId: string | null;
  ctx: TreeRenderCtx;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActif: (id: string) => void;
  onChangeConfig: (id: string, patch: Record<string, any>) => void;
  onResizeColumns: (leftId: string, rightId: string, leftPct: number, rightPct: number) => void;
}

// Rendu récursif du canevas — variante « éditeur » des conteneurs
// storefront/blocks/containers/*.tsx : mêmes widgets (BLOCK_REGISTRY), même
// blockStyleToCss, mais avec poignée de glisser-déposer (dnd-kit) et barre
// d'outils au survol. Volontairement un fichier séparé plutôt qu'une
// extension des conteneurs partagés : ceux-ci restent de purs composants
// serveur, sans hooks, réutilisables tels quels par le SSR storefront.
export function CanvasNode({ node, parentId, ctx, selectedNodeId, onSelect, onDuplicate, onDelete, onToggleActif, onChangeConfig, onResizeColumns }: CanvasNodeProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `node:${node.id}`,
    data: { kind: "node", nodeId: node.id, currentParentId: parentId, type: node.type },
  });

  const selectionne = selectedNodeId === node.id;
  const estConteneur = node.type === "section" || node.type === "row" || node.type === "column";
  const desactive = node.actif === false;

  const toolbar = (
    <div
      className={`absolute -top-3.5 right-1.5 z-20 flex items-center gap-0.5 rounded-md border border-gray-200 bg-white shadow-sm px-1 py-1 transition-opacity ${
        selectionne ? "opacity-100" : "opacity-0 group-hover/node:opacity-100"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <span {...attributes} {...listeners} style={{ touchAction: "none" }} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing" title="Déplacer">
        <GripVertical size={14} />
      </span>
      <button onClick={() => onToggleActif(node.id)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700" title={desactive ? "Afficher" : "Masquer"}>
        {desactive ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
      <button onClick={() => onDuplicate(node.id)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700" title="Dupliquer">
        <Copy size={14} />
      </button>
      <button onClick={() => onDelete(node.id)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500" title="Supprimer">
        <Trash2 size={14} />
      </button>
    </div>
  );

  const label = (
    <span className={`absolute -top-3 left-1.5 z-20 text-[12px] font-bold uppercase tracking-wide px-2 py-1 rounded transition-opacity ${
      selectionne ? "bg-[#F5A623] text-black opacity-100" : "bg-gray-700 text-white opacity-0 group-hover/node:opacity-100"
    }`}>
      {LABELS[node.type] || node.type}
    </span>
  );

  const baseClass = `group/node relative outline-offset-[-2px] transition-all cursor-pointer ${
    selectionne ? "outline outline-2 outline-[#F5A623]" : "outline outline-1 outline-transparent hover:outline-dashed hover:outline-gray-300"
  } ${isDragging ? "opacity-30" : ""} ${desactive ? "opacity-40" : ""}`;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  if (estConteneur) {
    const children = node.children ?? [];
    const Tag = node.type === "section" ? "section" : "div";
    const flexClass = node.type === "row" ? "flex flex-col @min-[640px]:flex-row gap-6" : node.type === "column" ? "flex-1 flex flex-col gap-4 min-w-0" : "";
    return (
      <Tag ref={setNodeRef as any} data-axs-id={node.id} onClick={handleClick} style={blockStyleToCss(node.style)} className={`${baseClass} ${flexClass} ${node.style?.customClass || ""} ${children.length === 0 ? "min-h-[64px] p-2" : ""}`}>
        <ResponsiveStyleTag nodeId={node.id} style={node.style} />
        {label}
        {toolbar}
        {children.length === 0 ? (
          <DropIndicator parentId={node.id} index={0} empty />
        ) : (
          <>
            <DropIndicator parentId={node.id} index={0} />
            {children.map((child, i) => (
              <div key={child.id} className="contents">
                <div>
                  <CanvasNode node={child} parentId={node.id} ctx={ctx} selectedNodeId={selectedNodeId} onSelect={onSelect} onDuplicate={onDuplicate} onDelete={onDelete} onToggleActif={onToggleActif} onChangeConfig={onChangeConfig} onResizeColumns={onResizeColumns} />
                  <DropIndicator parentId={node.id} index={i + 1} />
                </div>
                {node.type === "row" && i < children.length - 1 && (
                  <ColumnResizeHandle leftId={child.id} rightId={children[i + 1].id} onResize={(l, r) => onResizeColumns(child.id, children[i + 1].id, l, r)} />
                )}
              </div>
            ))}
          </>
        )}
      </Tag>
    );
  }

  if (node.type === "products") {
    return (
      <div ref={setNodeRef} data-axs-id={node.id} onClick={handleClick} style={blockStyleToCss(node.style)} className={`${baseClass} ${node.style?.customClass || ""}`}>
        <ResponsiveStyleTag nodeId={node.id} style={node.style} />
        {label}
        {toolbar}
        <ProductsCanvasPreview config={node.config ?? {}} />
      </div>
    );
  }

  const Widget = BLOCK_REGISTRY[node.type];
  if (!Widget) return null;
  const editableInline = TYPES_EDITABLE_INLINE.has(node.type);
  return (
    <div ref={setNodeRef} data-axs-id={node.id} onClick={handleClick} style={blockStyleToCss(node.style)} className={`${baseClass} ${node.style?.customClass || ""}`}>
      <ResponsiveStyleTag nodeId={node.id} style={node.style} />
      {label}
      {toolbar}
      <div className={editableInline ? "" : "pointer-events-none"}>
        <Widget
          id={node.id}
          config={node.config ?? {}}
          colors={ctx.colors}
          slug={ctx.slug}
          container={ctx.container}
          sectionPy={ctx.sectionPy}
          editable={editableInline}
          onEditText={editableInline ? (patch) => onChangeConfig(node.id, patch) : undefined}
        />
      </div>
    </div>
  );
}
