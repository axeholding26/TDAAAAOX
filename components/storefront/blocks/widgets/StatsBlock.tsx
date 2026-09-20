import type { BlockRenderProps } from "../types";

export function StatsBlock({ id, config, colors: c, container: CONTAINER }: BlockRenderProps) {
  return (
    <section data-axs-id={id} className="py-14 sm:py-20" style={{ background: `${c.accent}08` }}>
      <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {(config?.items ?? []).map((stat: any, i: number) => (
            <div key={i}>
              <p className="text-4xl font-bold font-playfair" style={{ color: c.accent }}>{stat.valeur}</p>
              <p className="text-sm mt-1" style={{ opacity: 0.6 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
