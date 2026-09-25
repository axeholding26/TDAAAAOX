import type { BlockRenderProps } from "../types";

// Questions fréquentes (pages À propos / Contact) : accordéon natif
// <details>, sans JavaScript ; image facultative sous chaque réponse.
export function FaqBlock({ id, config, colors: c, sectionPy }: BlockRenderProps) {
  const items: { question: string; reponse: string; image?: string }[] = (config?.items ?? []).filter((it: any) => it?.question);
  if (!items.length) return null;
  return (
    <section data-axs-id={id} className={sectionPy}>
      <div className="max-w-3xl mx-auto px-4 @min-[640px]:px-6">
        {config?.titre && <h2 className="text-3xl font-bold font-playfair text-center mb-10" style={{ color: c.texte }}>{config.titre}</h2>}
        <div className="space-y-3">
          {items.map((it, i) => (
            <details key={i} className="group rounded-2xl overflow-hidden" style={{ backgroundColor: `${c.accent}0A`, border: `1px solid ${c.accent}22` }}>
              <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-semibold text-[15px]" style={{ color: c.texte }}>
                {it.question}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 transition-transform group-open:rotate-180" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <div className="px-5 pb-5 text-[15px] leading-relaxed" style={{ color: c.texte }}>
                {it.reponse && <p className="opacity-70 whitespace-pre-line">{it.reponse}</p>}
                {it.image && <img src={it.image} alt="" loading="lazy" className="mt-4 w-full max-h-96 object-cover rounded-xl" />}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
