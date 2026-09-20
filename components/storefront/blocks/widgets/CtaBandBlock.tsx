import Link from "next/link";
import type { BlockRenderProps } from "../types";

export function CtaBandBlock({ id, config, colors: c, slug }: BlockRenderProps) {
  return (
    <section data-axs-id={id} className="py-16" style={{ background: c.accent }}>
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold font-playfair mb-4" style={{ color: c.fond }}>{config?.titre}</h2>
        {config?.texte && <p className="text-lg mb-8" style={{ color: c.fond, opacity: 0.85 }}>{config.texte}</p>}
        {config?.ctaTexte && (
          <Link href={config.ctaLien ?? `/${slug}/produits`}
            className="inline-flex px-8 py-4 rounded-2xl font-bold text-sm"
            style={{ background: c.fond, color: c.accent }}>
            {config.ctaTexte}
          </Link>
        )}
      </div>
    </section>
  );
}
