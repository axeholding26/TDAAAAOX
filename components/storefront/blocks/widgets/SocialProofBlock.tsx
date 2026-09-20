import { Star } from "lucide-react";
import type { BlockRenderProps } from "../types";

export function SocialProofBlock({ id, config, colors: c }: BlockRenderProps) {
  const certs: string[] = config?.certifications ?? [];
  return (
    <section data-axs-id={id} className="py-10" style={{ background: `${c.accent}06` }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-center gap-8 text-center">
        {config?.note && (
          <div className="flex items-center gap-1.5">
            <Star size={16} fill={c.accent} style={{ color: c.accent }} />
            <span className="font-bold text-sm" style={{ color: c.texte }}>{config.note}</span>
          </div>
        )}
        {config?.nbClients && <span className="text-sm" style={{ color: c.texte, opacity: 0.6 }}>{config.nbClients} clients</span>}
        {config?.nbCommandes && <span className="text-sm" style={{ color: c.texte, opacity: 0.6 }}>{config.nbCommandes} commandes</span>}
        {certs.map((cert, i) => <span key={i} className="text-sm" style={{ color: c.texte, opacity: 0.6 }}>{cert}</span>)}
      </div>
    </section>
  );
}
