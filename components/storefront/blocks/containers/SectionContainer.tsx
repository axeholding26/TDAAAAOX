import type { BlockNode } from "@/lib/theme-config";
import type { TreeRenderCtx } from "../context";
import { blockStyleToCss, couleursSection, cssSection, fondSection } from "../styleUtils";
import { StyleCss } from "../../StyleCss";
import { ResponsiveStyleTag } from "../ResponsiveStyleTag";
import { BlockTreeRenderer } from "../BlockTreeRenderer";

export function SectionContainer({ node, ctx }: { node: BlockNode; ctx: TreeRenderCtx }) {
  const selectionne = ctx.editable && ctx.selectedId === node.id;
  return (
    <section
      data-axs-id={node.id}
      style={{ ...fondSection(node), ...blockStyleToCss(node.style) }}
      className={[node.style?.customClass, selectionne ? "ax-libre-selected" : "", ctx.editable ? "ax-libre-hoverable" : ""].filter(Boolean).join(" ")}
      onClick={ctx.editable ? (e) => { e.stopPropagation(); ctx.onSelect?.(node.id); } : undefined}
    >
      <ResponsiveStyleTag nodeId={node.id} style={node.style} />
      {cssSection(node) && <StyleCss css={cssSection(node)} />}
      <BlockTreeRenderer nodes={node.children ?? []} ctx={{ ...ctx, colors: couleursSection(node, ctx.colors) }} />
    </section>
  );
}
