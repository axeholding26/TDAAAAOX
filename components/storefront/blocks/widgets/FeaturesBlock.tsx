import type { BlockRenderProps } from "../types";

export function FeaturesBlock({ id, config, colors: c }: BlockRenderProps) {
  return (
    <section data-axs-id={id} className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {config?.titre && (
        <h2 className="text-3xl font-bold font-playfair text-center mb-12" style={{ color: c.texte }}>{config.titre}</h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
        {(config?.items ?? []).map((item: any, i: number) => (
          <div key={i} className="flex flex-col items-center text-center gap-3 p-6 rounded-2xl" style={{ background: `${c.accent}08`, border: `1px solid ${c.accent}15` }}>
            <span className="text-3xl">{item.icone}</span>
            <p className="font-bold text-sm">{item.titre}</p>
            <p className="text-sm" style={{ opacity: 0.6 }}>{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
