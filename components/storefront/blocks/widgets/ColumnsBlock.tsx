import type { BlockRenderProps } from "../types";

export function ColumnsBlock({ id, config, colors: c }: BlockRenderProps) {
  const colonnes: any[] = config?.colonnes ?? [];
  if (!colonnes.length) return null;
  const nb = config?.nombreColonnes || colonnes.length;
  return (
    <section data-axs-id={id} className="py-16 sm:py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {config?.titre && <h2 className="text-3xl font-bold font-playfair text-center mb-12" style={{ color: c.texte }}>{config.titre}</h2>}
      <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${Math.min(nb, colonnes.length)}, minmax(0, 1fr))` }}>
        {colonnes.map((col) => (
          <div key={col.id} className="space-y-5">
            {(col.blocs ?? []).map((bloc: any) => {
              if (bloc.type === "photos") {
                const images = (bloc.config?.images ?? []).filter(Boolean);
                if (!images.length) return null;
                return (
                  <div key={bloc.id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${c.accent}15` }}>
                    <img src={images[0]} alt="" className="w-full object-cover" loading="lazy" />
                  </div>
                );
              }
              if (bloc.type === "temoignage" && bloc.config?.texte) {
                return (
                  <div key={bloc.id} className="rounded-xl p-5" style={{ background: `${c.accent}08` }}>
                    <p className="text-sm italic mb-2" style={{ color: c.texte, opacity: 0.75 }}>"{bloc.config.texte}"</p>
                    {bloc.config.nom && <p className="text-xs font-bold" style={{ color: c.texte }}>{bloc.config.nom}</p>}
                  </div>
                );
              }
              if (bloc.type === "promo" && (bloc.config?.titre || bloc.config?.texte)) {
                return (
                  <div key={bloc.id} className="rounded-xl p-5 text-center" style={{ background: c.accent }}>
                    {bloc.config.titre && <p className="font-bold text-sm mb-1" style={{ color: "white" }}>{bloc.config.titre}</p>}
                    {bloc.config.texte && <p className="text-xs" style={{ color: "white", opacity: 0.9 }}>{bloc.config.texte}</p>}
                  </div>
                );
              }
              if (bloc.type === "texte" && (bloc.config?.titre || bloc.config?.texte)) {
                return (
                  <div key={bloc.id}>
                    {bloc.config.titre && <p className="font-bold text-sm mb-1" style={{ color: c.texte }}>{bloc.config.titre}</p>}
                    {bloc.config.texte && <p className="text-sm" style={{ color: c.texte, opacity: 0.65 }}>{bloc.config.texte}</p>}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
