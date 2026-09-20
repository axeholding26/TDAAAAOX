import type { BlockRenderProps } from "../types";

export function RichtextBlock({ id, config, colors: c }: BlockRenderProps) {
  return (
    <section data-axs-id={id} className="py-16 max-w-3xl mx-auto px-4">
      {config?.titre && <h2 className="text-2xl font-bold font-playfair mb-6" style={{ color: c.texte }}>{config.titre}</h2>}
      {config?.texte && <div className="prose prose-sm max-w-none" style={{ color: c.texte, opacity: 0.75 }}>{config.texte}</div>}
    </section>
  );
}
