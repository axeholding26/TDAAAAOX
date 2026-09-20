"use client";
import { useState } from "react";
import { Star } from "lucide-react";

interface SousBloc { id: string; type: "photos" | "temoignage" | "promo" | "texte"; config: Record<string, any>; }
interface Onglet { id: string; label: string; blocs: SousBloc[]; }

function BlocRenderer({ bloc, accent, texte }: { bloc: SousBloc; accent: string; texte: string }) {
  if (bloc.type === "photos") {
    const images: string[] = (bloc.config.images || []).filter(Boolean);
    if (!images.length) return null;
    return (
      <div className={`grid gap-3 ${images.length >= 3 ? "grid-cols-3" : images.length === 2 ? "grid-cols-2" : "grid-cols-1 max-w-md mx-auto"}`}>
        {images.map((src, i) => (
          <div key={i} className="aspect-square rounded-xl overflow-hidden" style={{ border: `1px solid ${accent}15` }}>
            <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        ))}
      </div>
    );
  }
  if (bloc.type === "temoignage") {
    if (!bloc.config.texte) return null;
    return (
      <div className="rounded-2xl p-6 max-w-xl mx-auto text-center" style={{ background: `${accent}08`, border: `1px solid ${accent}15` }}>
        <div className="flex justify-center gap-1 mb-3">
          {Array.from({ length: bloc.config.note || 5 }).map((_, i) => <Star key={i} size={14} fill={accent} style={{ color: accent }} />)}
        </div>
        <p className="italic mb-3" style={{ color: texte, opacity: 0.75 }}>"{bloc.config.texte}"</p>
        {bloc.config.nom && <p className="font-bold text-sm" style={{ color: texte }}>{bloc.config.nom}</p>}
      </div>
    );
  }
  if (bloc.type === "promo") {
    if (!bloc.config.titre && !bloc.config.texte) return null;
    return (
      <div className="rounded-2xl p-8 text-center" style={{ background: accent }}>
        {bloc.config.titre && <p className="text-xl font-bold mb-2" style={{ color: "white" }}>{bloc.config.titre}</p>}
        {bloc.config.texte && <p className="text-sm mb-4" style={{ color: "white", opacity: 0.9 }}>{bloc.config.texte}</p>}
        {bloc.config.ctaTexte && (
          <span className="inline-flex px-6 py-2.5 rounded-xl font-bold text-sm" style={{ background: "white", color: accent }}>
            {bloc.config.ctaTexte}
          </span>
        )}
      </div>
    );
  }
  if (bloc.type === "texte") {
    if (!bloc.config.titre && !bloc.config.texte) return null;
    return (
      <div className="max-w-2xl mx-auto text-center">
        {bloc.config.titre && <p className="text-lg font-bold mb-2" style={{ color: texte }}>{bloc.config.titre}</p>}
        {bloc.config.texte && <p style={{ color: texte, opacity: 0.65 }}>{bloc.config.texte}</p>}
      </div>
    );
  }
  return null;
}

export function SectionTabs({ titre, onglets, accent, texte }: { titre?: string; onglets: Onglet[]; accent: string; texte: string }) {
  const [actif, setActif] = useState(0);
  if (!onglets?.length) return null;
  const current = onglets[actif] ?? onglets[0];

  return (
    <section className="py-16 sm:py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {titre && <h2 className="text-3xl font-bold font-playfair text-center mb-10" style={{ color: texte }}>{titre}</h2>}

      <div className="flex justify-center gap-2 mb-10 flex-wrap">
        {onglets.map((o, i) => (
          <button key={o.id} onClick={() => setActif(i)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: i === actif ? accent : "transparent",
              color: i === actif ? "white" : texte,
              opacity: i === actif ? 1 : 0.5,
              border: `1px solid ${i === actif ? accent : `${accent}25`}`,
            }}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="space-y-6">
        {(current.blocs || []).map(bloc => <BlocRenderer key={bloc.id} bloc={bloc} accent={accent} texte={texte} />)}
        {(!current.blocs || current.blocs.length === 0) && (
          <p className="text-center text-sm" style={{ color: texte, opacity: 0.3 }}>Aucun contenu dans cet onglet</p>
        )}
      </div>
    </section>
  );
}
