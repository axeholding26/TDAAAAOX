import type { BlockNode } from "@/lib/theme-config";
import type { TreeRenderCtx } from "./context";
import { BLOCK_REGISTRY } from "./registry";
import { blockStyleToCss } from "./styleUtils";
import { SectionContainer } from "./containers/SectionContainer";
import { RowContainer } from "./containers/RowContainer";
import { ColumnContainer } from "./containers/ColumnContainer";
import { ProductsBlock } from "./widgets/ProductsBlock";
import { ResponsiveStyleTag } from "./ResponsiveStyleTag";

// Rendu récursif de l'arbre du constructeur libre, SSR uniquement — rendu
// côté storefront public (app/(storefront)/[slug]/page.tsx, ctx.editable
// toujours false/absent). Le canevas du tableau de bord (édition) a sa
// propre implémentation cliente séparée (app/(dashboard)/dashboard/builder/
// canvas/CanvasNode.tsx), volontairement distincte : elle ne doit jamais
// importer ProductsBlock (Prisma), qui casserait le bundle navigateur —
// voir la note dans registry.tsx.
export function BlockTreeRenderer({ nodes, ctx }: { nodes: BlockNode[]; ctx: TreeRenderCtx }) {
  return (
    <>
      {(nodes ?? []).filter((n) => n.actif !== false).map((node) => {
        if (node.type === "section") return <SectionContainer key={node.id} node={node} ctx={ctx} />;
        if (node.type === "row") return <RowContainer key={node.id} node={node} ctx={ctx} />;
        if (node.type === "column") return <ColumnContainer key={node.id} node={node} ctx={ctx} />;
        if (node.type === "products") {
          return (
            <div key={node.id} data-axs-id={node.id} style={blockStyleToCss(node.style)} className={node.style?.customClass || ""}>
              <ResponsiveStyleTag nodeId={node.id} style={node.style} />
              <ProductsBlock id={node.id} config={node.config ?? {}} colors={ctx.colors} slug={ctx.slug} container={ctx.container} sectionPy={ctx.sectionPy} tenantId={ctx.tenantId} />
            </div>
          );
        }

        const Widget = BLOCK_REGISTRY[node.type];
        if (!Widget) return null;
        const selectionne = ctx.editable && ctx.selectedId === node.id;
        return (
          <div
            key={node.id}
            data-axs-id={node.id}
            style={blockStyleToCss(node.style)}
            className={[node.style?.customClass, selectionne ? "ax-libre-selected" : "", ctx.editable ? "ax-libre-hoverable" : ""].filter(Boolean).join(" ")}
            onClick={ctx.editable ? (e) => { e.stopPropagation(); ctx.onSelect?.(node.id); } : undefined}
          >
            <ResponsiveStyleTag nodeId={node.id} style={node.style} />
            <Widget id={node.id} config={node.config ?? {}} colors={ctx.colors} slug={ctx.slug} container={ctx.container} sectionPy={ctx.sectionPy} tenantId={ctx.tenantId} />
          </div>
        );
      })}
    </>
  );
}
