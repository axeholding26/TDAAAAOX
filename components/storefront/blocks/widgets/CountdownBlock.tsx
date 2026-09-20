import { SectionCountdown } from "@/components/storefront/SectionCountdown";
import type { BlockRenderProps } from "../types";

export function CountdownBlock({ id, config, colors: c, slug }: BlockRenderProps) {
  return (
    <SectionCountdown
      data-axs-id={id}
      slug={slug}
      accent={c.accent}
      texte={c.texte}
      titre={config?.titre}
      texteDesc={config?.texte}
      dateFin={config?.dateFin}
      ctaTexte={config?.ctaTexte}
    />
  );
}
