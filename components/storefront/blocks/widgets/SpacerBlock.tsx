import type { BlockRenderProps } from "../types";

export function SpacerBlock({ id, config }: BlockRenderProps) {
  return <div data-axs-id={id} style={{ height: config?.hauteur || "80px" }} />;
}
