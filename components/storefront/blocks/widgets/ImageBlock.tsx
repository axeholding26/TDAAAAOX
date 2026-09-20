import type { BlockRenderProps } from "../types";

const RATIO_MAP: Record<string, string> = { square: "aspect-square", video: "aspect-video", portrait: "aspect-[3/4]", auto: "" };

export function ImageBlock({ config }: BlockRenderProps) {
  const url = config.url as string | undefined;
  const alt = (config.alt as string) || "";
  const lien = config.lien as string | undefined;
  const ratio = RATIO_MAP[(config.ratio as string) || "auto"] || "";

  const img = url ? (
    <img src={url} alt={alt} className={`w-full h-full object-cover ${ratio}`} />
  ) : (
    <div className={`w-full flex items-center justify-center bg-gray-100 text-gray-400 text-xs ${ratio || "aspect-video"}`}>
      Aucune image — ajoute une URL dans le panneau Contenu
    </div>
  );

  return (
    <div className="py-2 overflow-hidden rounded-xl">
      {lien ? <a href={lien}>{img}</a> : img}
    </div>
  );
}
