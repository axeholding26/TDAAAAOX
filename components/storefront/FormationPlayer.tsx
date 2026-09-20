"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, Circle, PlayCircle, FileText, Headphones,
  ChevronRight, ChevronLeft, Award, GraduationCap, Menu, X,
} from "lucide-react";

interface Lecon {
  id: string; titre: string; type: string; contenu: string | null;
  videoType: string | null; videoUrl: string | null; audioUrl: string | null;
  duree: number | null; gratuite: boolean;
}
interface Chapitre { id: string; titre: string; lecons: Lecon[]; }

interface Props {
  commandeId: string;
  clientEmail: string;
  nomBoutique: string;
  logoUrl: string | null;
  produitNom: string;
  niveau: string | null;
  certif: boolean;
  chapitres: Chapitre[];
  completedIds: string[];
  accent: string; fond: string; texte: string; surface: string;
}

function embedVideo(l: Lecon): string | null {
  if (!l.videoUrl) return null;
  if (l.videoType === "youtube") {
    const m = l.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : l.videoUrl;
  }
  if (l.videoType === "vimeo") {
    const m = l.videoUrl.match(/vimeo\.com\/(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : l.videoUrl;
  }
  return l.videoUrl; // "iframe" ou "upload" (mp4 direct — voir <video> fallback)
}

export function FormationPlayer(p: Props) {
  const toutesLecons = useMemo(() => p.chapitres.flatMap((c) => c.lecons), [p.chapitres]);
  const [leconActiveId, setLeconActiveId] = useState<string | null>(toutesLecons[0]?.id ?? null);
  const [completes, setCompletes] = useState<Set<string>>(new Set(p.completedIds));
  const [marquage, setMarquage] = useState(false);
  const [sidebarOuverte, setSidebarOuverte] = useState(false);

  const leconActive = toutesLecons.find((l) => l.id === leconActiveId) ?? null;
  const total = toutesLecons.length;
  const pct = total > 0 ? Math.round((completes.size / total) * 100) : 0;

  const idx = leconActive ? toutesLecons.findIndex((l) => l.id === leconActive.id) : -1;
  const precedente = idx > 0 ? toutesLecons[idx - 1] : null;
  const suivante = idx >= 0 && idx < toutesLecons.length - 1 ? toutesLecons[idx + 1] : null;

  async function marquerTermine() {
    if (!leconActive) return;
    setMarquage(true);
    try {
      const res = await fetch("/api/formations/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leconId: leconActive.id, commandeId: p.commandeId, clientEmail: p.clientEmail }),
      });
      if (!res.ok) throw new Error();
      setCompletes((s) => new Set(s).add(leconActive.id));
      toast.success("Leçon marquée comme terminée");
      if (suivante) setLeconActiveId(suivante.id);
    } catch {
      toast.error("Erreur — réessayez");
    } finally {
      setMarquage(false);
    }
  }

  const embed = leconActive ? embedVideo(leconActive) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: p.fond, color: p.texte }}>
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3 border-b" style={{ background: `${p.fond}f0`, backdropFilter: "blur(16px)", borderColor: `${p.accent}18` }}>
        <button onClick={() => setSidebarOuverte((v) => !v)} className="lg:hidden p-2 rounded-xl" style={{ background: `${p.accent}12` }}>
          {sidebarOuverte ? <X size={16} /> : <Menu size={16} />}
        </button>
        {p.logoUrl ? <img src={p.logoUrl} alt="" className="h-7 rounded" /> : <GraduationCap size={20} style={{ color: p.accent }} />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{p.produitNom}</p>
          <p className="text-[11px] opacity-50 truncate">{p.nomBoutique}{p.niveau ? ` · ${p.niveau}` : ""}</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <div className="w-28 h-1.5 rounded-full overflow-hidden" style={{ background: `${p.accent}15` }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: p.accent }} />
          </div>
          <span className="text-[11px] font-bold" style={{ color: p.accent }}>{pct}%</span>
        </div>
      </header>

      <div className="flex-1 flex relative">
        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-[57px] lg:top-[57px] left-0 h-[calc(100vh-57px)] w-72 flex-shrink-0 overflow-y-auto border-r z-20 transition-transform duration-300 ${sidebarOuverte ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
          style={{ background: p.surface, borderColor: `${p.accent}15` }}
        >
          <div className="p-4 space-y-4">
            {p.chapitres.map((ch, ci) => (
              <div key={ch.id}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-40">Chapitre {ci + 1} · {ch.titre}</p>
                <div className="space-y-1">
                  {ch.lecons.map((l) => {
                    const actif = l.id === leconActive?.id;
                    const fait = completes.has(l.id);
                    const Icon = l.type === "video" ? PlayCircle : l.type === "audio" ? Headphones : FileText;
                    return (
                      <button
                        key={l.id}
                        onClick={() => { setLeconActiveId(l.id); setSidebarOuverte(false); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                        style={{ background: actif ? `${p.accent}15` : "transparent" }}
                      >
                        {fait ? <CheckCircle2 size={15} style={{ color: p.accent, flexShrink: 0 }} /> : <Circle size={15} style={{ opacity: 0.25, flexShrink: 0 }} />}
                        <Icon size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
                        <span className="text-[13px] flex-1 min-w-0 truncate" style={{ fontWeight: actif ? 700 : 500, opacity: actif ? 1 : 0.75 }}>{l.titre}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {p.certif && pct === 100 && (
              <div className="rounded-xl p-3.5 text-center mt-4" style={{ background: `${p.accent}12`, border: `1px solid ${p.accent}30` }}>
                <Award size={20} className="mx-auto mb-1.5" style={{ color: p.accent }} />
                <p className="text-[11px] font-bold" style={{ color: p.accent }}>Formation terminée !</p>
              </div>
            )}
          </div>
        </aside>
        {sidebarOuverte && <div className="fixed inset-0 bg-black/40 z-10 lg:hidden" onClick={() => setSidebarOuverte(false)} />}

        {/* Contenu */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-10 max-w-3xl mx-auto w-full">
          {!leconActive ? (
            <p className="text-center opacity-50 py-20">Cette formation n'a pas encore de contenu.</p>
          ) : (
            <>
              <h1 className="text-xl sm:text-2xl font-bold font-playfair mb-5">{leconActive.titre}</h1>

              {leconActive.type === "video" && embed && (
                <div className="relative w-full overflow-hidden rounded-2xl mb-6" style={{ paddingBottom: "56.25%", background: "#000" }}>
                  {leconActive.videoType === "upload" ? (
                    <video src={embed} controls className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <iframe src={embed} className="absolute inset-0 w-full h-full border-0" allowFullScreen />
                  )}
                </div>
              )}

              {leconActive.type === "audio" && leconActive.audioUrl && (
                <audio src={leconActive.audioUrl} controls className="w-full mb-6" />
              )}

              {leconActive.contenu && (
                <div className="prose text-sm leading-relaxed opacity-85 mb-8" style={{ whiteSpace: "pre-line" }} dangerouslySetInnerHTML={{ __html: leconActive.contenu }} />
              )}

              <div className="flex items-center justify-between gap-3 pt-6 border-t" style={{ borderColor: `${p.accent}12` }}>
                <button
                  onClick={() => precedente && setLeconActiveId(precedente.id)}
                  disabled={!precedente}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-30"
                  style={{ border: `1px solid ${p.accent}25`, color: p.texte }}
                >
                  <ChevronLeft size={14} /> Précédent
                </button>

                {completes.has(leconActive.id) ? (
                  <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: p.accent }}>
                    <CheckCircle2 size={16} /> Terminé
                  </span>
                ) : (
                  <button onClick={marquerTermine} disabled={marquage}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                    style={{ background: p.accent, color: p.fond }}>
                    {marquage ? "…" : "Marquer comme terminé"}
                  </button>
                )}

                <button
                  onClick={() => suivante && setLeconActiveId(suivante.id)}
                  disabled={!suivante}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-30"
                  style={{ border: `1px solid ${p.accent}25`, color: p.texte }}
                >
                  Suivant <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      <footer className="border-t py-6 text-center text-xs opacity-40" style={{ borderColor: `${p.accent}12` }}>
        {p.nomBoutique} · Propulsé par <span style={{ color: p.accent }}>Axso</span>
      </footer>
    </div>
  );
}
