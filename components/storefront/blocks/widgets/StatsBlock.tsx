import type { BlockRenderProps } from "../types";

export function StatsBlock({ id, config, colors: c, container: CONTAINER }: BlockRenderProps) {
  // Chiffre vide = pas encore renseigné par le marchand : jamais affiché.
  const items = (config?.items ?? []).filter((s: any) => s?.valeur);
  if (!items.length) return null;
  return (
    <section data-axs-id={id} className="py-14 @min-[640px]:py-20" style={{ background: `${c.accent}08` }}>
      <div className={`${CONTAINER} mx-auto px-4 @min-[640px]:px-6 @min-[1024px]:px-8`}>
        <div className="grid grid-cols-2 @min-[640px]:grid-cols-4 gap-8 text-center">
          {items.map((stat: any, i: number) => (
            <div key={i}>
              <p className="text-3xl @min-[640px]:text-4xl font-bold font-playfair break-words" style={{ color: c.accent }}>{stat.valeur}</p>
              <p className="text-sm mt-1" style={{ opacity: 0.6 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
