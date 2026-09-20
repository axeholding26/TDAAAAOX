import { SectionTabs } from "@/components/storefront/SectionTabs";
import type { BlockRenderProps } from "../types";

export function TabsBlock({ id, config, colors: c }: BlockRenderProps) {
  return (
    <SectionTabs
      data-axs-id={id}
      titre={config?.titre}
      onglets={config?.onglets ?? []}
      accent={c.accent}
      texte={c.texte}
    />
  );
}
