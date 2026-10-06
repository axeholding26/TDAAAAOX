import type { BlockRenderProps } from "../types";
import { hrefBoutique } from "@/lib/utils";

const RATIO_MAP: Record<string, string> = { square: "aspect-square", video: "aspect-video", portrait: "aspect-[3/4]", auto: "" };

export function ImageBlock({ config, slug }: BlockRenderProps) {
  const url = config.url as string | undefined;
  const alt = (config.alt as string) || "";
  const lien = hrefBoutique(slug, config.lien);
  const ratio = RATIO_MAP[(config.ratio as string) || "auto"] || "";

  const img = url ? (
    <img data-axs-cible="" src={url} alt={alt} className={`w-full h-full object-cover rounded-xl ${ratio}`} />
  ) : (
    <div className={`w-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs ${ratio || "aspect-video"}`}>
      Aucune image — importe-la depuis le panneau Contenu
    </div>
  );

  return (
    <div className="py-2">
      {lien ? <a href={lien}>{img}</a> : img}
    </div>
  );
}
