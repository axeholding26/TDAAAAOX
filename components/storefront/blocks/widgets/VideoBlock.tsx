import type { BlockRenderProps } from "../types";

export function VideoBlock({ id, config, colors: c, sectionPy: SECTION_PY }: BlockRenderProps) {
  if (!config?.videoUrl) return null;
  const isEmbed = /youtube|vimeo/.test(config.videoUrl);
  return (
    <section data-axs-id={id} className={SECTION_PY}>
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${config.style === "fullwidth" ? "max-w-full" : "max-w-4xl"}`}>
        {config?.titre && (
          <h2 className="text-3xl font-bold font-playfair text-center mb-10" style={{ color: c.texte }}>{config.titre}</h2>
        )}
        <div className="rounded-2xl overflow-hidden" style={{ aspectRatio: "16/9", border: `1px solid ${c.accent}15` }}>
          {isEmbed ? (
            <iframe className="w-full h-full" src={config.videoUrl} allow="autoplay; fullscreen" allowFullScreen style={{ border: "none" }} />
          ) : (
            <video className="w-full h-full object-cover" src={config.videoUrl} controls autoPlay={!!config.autoplay} muted={!!config.autoplay} loop playsInline />
          )}
        </div>
      </div>
    </section>
  );
}
