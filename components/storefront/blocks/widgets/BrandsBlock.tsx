import type { BlockRenderProps } from "../types";

export function BrandsBlock({ id, config, colors: c }: BlockRenderProps) {
  const logos: string[] = (config?.logos ?? []).filter(Boolean);
  if (!logos.length) return null;
  return (
    <section data-axs-id={id} className="py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {config?.titre && (
          <p className="text-center text-sm font-bold uppercase tracking-widest mb-8" style={{ color: c.texte, opacity: 0.4 }}>{config.titre}</p>
        )}
        <div className={`flex flex-wrap items-center justify-center gap-10 ${config?.style === "carousel" ? "animate-pulse" : ""}`}>
          {logos.map((src, i) => (
            <img key={i} src={src} alt="" className="h-10 object-contain opacity-60 hover:opacity-100 transition-opacity" loading="lazy" />
          ))}
        </div>
      </div>
    </section>
  );
}
