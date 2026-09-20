import { Star, Check } from "lucide-react";

interface SousBloc { id: string; type: "photos" | "temoignage" | "promo" | "texte" | "video" | "stats" | "features" | "countdown" | "logos" | "confiance" | "liste" | "spacer"; config: Record<string, any>; }

/** Affiche les sous-sections personnalisées ajoutées à une section (built-in ou custom) depuis le constructeur. */
export function SousBlocsRenderer({ blocs, accent, texte }: { blocs?: SousBloc[]; accent: string; texte: string }) {
  const list = (blocs || []).filter(b => {
    if (b.type === "photos") return (b.config?.images || []).some(Boolean);
    if (b.type === "temoignage") return !!b.config?.texte;
    if (b.type === "promo") return !!(b.config?.titre || b.config?.texte);
    if (b.type === "texte") return !!(b.config?.titre || b.config?.texte);
    if (b.type === "video") return !!b.config?.videoUrl;
    if (b.type === "stats") return (b.config?.items || []).length > 0;
    if (b.type === "features") return (b.config?.items || []).length > 0;
    if (b.type === "countdown") return !!b.config?.dateFin;
    if (b.type === "logos") return (b.config?.logos || []).some(Boolean);
    if (b.type === "confiance") return !!(b.config?.note || b.config?.nbClients || (b.config?.certifications || []).length);
    if (b.type === "liste") return (b.config?.items || []).some(Boolean);
    if (b.type === "spacer") return true;
    return false;
  });
  if (!list.length) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {list.map(bloc => {
        if (bloc.type === "photos") {
          const images: string[] = (bloc.config.images || []).filter(Boolean);
          return (
            <div key={bloc.id} className={`grid gap-3 ${images.length >= 3 ? "grid-cols-3" : images.length === 2 ? "grid-cols-2" : "grid-cols-1 max-w-md mx-auto"}`}>
              {images.map((src, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden" style={{ border: `1px solid ${accent}15` }}>
                  <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>
          );
        }
        if (bloc.type === "temoignage") {
          return (
            <div key={bloc.id} className="rounded-2xl p-6 max-w-xl mx-auto text-center" style={{ background: `${accent}08`, border: `1px solid ${accent}15` }}>
              <div className="flex justify-center gap-1 mb-3">
                {Array.from({ length: bloc.config.note || 5 }).map((_, i) => <Star key={i} size={14} fill={accent} style={{ color: accent }} />)}
              </div>
              <p className="italic mb-3" style={{ color: texte, opacity: 0.75 }}>"{bloc.config.texte}"</p>
              {bloc.config.nom && <p className="font-bold text-sm" style={{ color: texte }}>{bloc.config.nom}</p>}
            </div>
          );
        }
        if (bloc.type === "promo") {
          return (
            <div key={bloc.id} className="rounded-2xl p-8 text-center" style={{ background: accent }}>
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
        if (bloc.type === "video") {
          const isEmbed = /youtube|vimeo/.test(bloc.config.videoUrl || "");
          return (
            <div key={bloc.id} className="max-w-3xl mx-auto rounded-2xl overflow-hidden" style={{ aspectRatio: "16/9", border: `1px solid ${accent}15` }}>
              {isEmbed ? (
                <iframe className="w-full h-full" src={bloc.config.videoUrl} allow="autoplay; fullscreen" allowFullScreen style={{ border: "none" }} />
              ) : (
                <video className="w-full h-full object-cover" src={bloc.config.videoUrl} controls playsInline />
              )}
            </div>
          );
        }
        if (bloc.type === "stats") {
          const items: any[] = bloc.config.items || [];
          return (
            <div key={bloc.id} className="grid gap-6 text-center" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0,1fr))` }}>
              {items.map((it, i) => (
                <div key={i}>
                  <p className="text-3xl font-bold font-playfair" style={{ color: accent }}>{it.valeur}</p>
                  <p className="text-sm mt-1" style={{ color: texte, opacity: 0.6 }}>{it.label}</p>
                </div>
              ))}
            </div>
          );
        }
        if (bloc.type === "features") {
          const items: any[] = bloc.config.items || [];
          return (
            <div key={bloc.id} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {items.map((it, i) => (
                <div key={i} className="flex flex-col items-center text-center gap-2 p-5 rounded-2xl" style={{ background: `${accent}08`, border: `1px solid ${accent}15` }}>
                  <span className="text-2xl">{it.icone}</span>
                  <p className="font-bold text-sm" style={{ color: texte }}>{it.titre}</p>
                  {it.texte && <p className="text-xs" style={{ color: texte, opacity: 0.6 }}>{it.texte}</p>}
                </div>
              ))}
            </div>
          );
        }
        if (bloc.type === "countdown") {
          const date = bloc.config.dateFin ? new Date(bloc.config.dateFin) : null;
          return (
            <div key={bloc.id} className="rounded-2xl p-8 text-center" style={{ background: `${accent}08`, border: `1px solid ${accent}15` }}>
              {bloc.config.texte && <p className="font-bold mb-2" style={{ color: texte }}>{bloc.config.texte}</p>}
              {date && (
                <p className="text-sm mb-4" style={{ color: accent }}>
                  Jusqu'au {date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {bloc.config.ctaTexte && (
                <span className="inline-flex px-6 py-2.5 rounded-xl font-bold text-sm" style={{ background: accent, color: "white" }}>
                  {bloc.config.ctaTexte}
                </span>
              )}
            </div>
          );
        }
        if (bloc.type === "logos") {
          const logos: string[] = (bloc.config.logos || []).filter(Boolean);
          return (
            <div key={bloc.id} className="flex flex-wrap items-center justify-center gap-8">
              {logos.map((src, i) => (
                <img key={i} src={src} alt="" className="h-8 object-contain opacity-60 hover:opacity-100 transition-opacity" loading="lazy" />
              ))}
            </div>
          );
        }
        if (bloc.type === "confiance") {
          const certs: string[] = bloc.config.certifications || [];
          return (
            <div key={bloc.id} className="flex flex-wrap items-center justify-center gap-6 text-center py-2">
              {bloc.config.note && (
                <div className="flex items-center gap-1.5">
                  <Star size={14} fill={accent} style={{ color: accent }} />
                  <span className="font-bold text-sm" style={{ color: texte }}>{bloc.config.note}</span>
                </div>
              )}
              {bloc.config.nbClients && <span className="text-sm" style={{ color: texte, opacity: 0.6 }}>{bloc.config.nbClients} clients</span>}
              {certs.map((cert, i) => <span key={i} className="text-sm" style={{ color: texte, opacity: 0.6 }}>{cert}</span>)}
            </div>
          );
        }
        if (bloc.type === "liste") {
          const items: string[] = (bloc.config.items || []).filter(Boolean);
          return (
            <ul key={bloc.id} className="max-w-md mx-auto space-y-2">
              {items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: texte, opacity: 0.8 }}>
                  <Check size={14} className="mt-0.5 flex-shrink-0" style={{ color: accent }} />
                  {it}
                </li>
              ))}
            </ul>
          );
        }
        if (bloc.type === "spacer") {
          return <div key={bloc.id} style={{ height: bloc.config.hauteur || "40px" }} />;
        }
        return (
          <div key={bloc.id} className="max-w-2xl mx-auto text-center">
            {bloc.config.titre && <p className="text-lg font-bold mb-2" style={{ color: texte }}>{bloc.config.titre}</p>}
            {bloc.config.texte && <p style={{ color: texte, opacity: 0.65 }}>{bloc.config.texte}</p>}
          </div>
        );
      })}
    </div>
  );
}
