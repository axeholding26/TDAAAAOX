import type { BlockRenderProps } from "../types";

export function GalleryBlock({ id, config, colors: c, container: CONTAINER, sectionPy: SECTION_PY }: BlockRenderProps) {
  const images: string[] = config?.images ?? [];
  if (!images.length) return null;
  return (
    <section data-axs-id={id} className={SECTION_PY}>
      <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8`}>
        {config?.titre && (
          <h2 className="text-3xl font-bold font-playfair text-center mb-10" style={{ color: c.texte }}>{config.titre}</h2>
        )}
        <div className={`grid gap-4 ${images.length >= 3 ? "grid-cols-2 sm:grid-cols-3" : images.length === 2 ? "grid-cols-2" : "grid-cols-1 max-w-lg mx-auto"}`}>
          {images.map((src: string, i: number) => (
            <div key={i} className="aspect-square rounded-2xl overflow-hidden" style={{ border: `1px solid ${c.accent}15` }}>
              <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
