"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2, Circle, PlayCircle, FileText, Headphones, ChevronRight, ChevronLeft, Award,
  GraduationCap, Menu, X, Lock, Star, Search, Download, HelpCircle, PenLine, Loader2, RotateCcw,
} from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { TuteurIA } from "@/components/storefront/TuteurIA";

interface LeconStructure {
  id: string; titre: string; type: string; duree: number | null; gratuite: boolean;
  verrou: string | null;   // raison lisible si verrouillée (drip ou prérequis)
  reussi: boolean | null;  // quiz réussi / devoir validé ; null pour les autres types
}
interface Chapitre { id: string; titre: string; lecons: LeconStructure[] }

interface Props {
  token: string;
  nomBoutique: string;
  logoUrl: string | null;
  produitNom: string;
  niveau: string | null;
  certif: boolean;
  certificatCode: string | null;
  derniereLeconId: string | null;
  chapitres: Chapitre[];
  completedIds: string[];
  favoriIds: string[];
  accent: string; fond: string; texte: string; surface: string;
}

type QuestionPublique = { id: string; type: "qcm" | "multiple" | "vrai_faux" | "courte"; enonce: string; options: string[]; points: number };
type Contenu = {
  lecon: { id: string; titre: string; type: string; contenu: string | null; videoType: string | null; videoUrl: string | null; audioUrl: string | null; ressources: { id: string; nom: string; taille: number | null }[] };
  progression: { complete: boolean; position: number | null; favori: boolean; note: string | null };
  quiz: { noteMin: number; tentativesMax: number | null; tentatives: { score: number; reussi: boolean; createdAt: string }[]; questions: QuestionPublique[] } | null;
  devoir: { texte: string; statut: string; note: number | null; feedback: string | null } | null;
};

function embedVideo(l: Contenu["lecon"]): string | null {
  if (!l.videoUrl) return null;
  if (l.videoType === "youtube") {
    const m = l.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return m ? `https://www.youtube.com/embed/${m[1]}` : l.videoUrl;
  }
  if (l.videoType === "vimeo") {
    const m = l.videoUrl.match(/vimeo\.com\/(\d+)/);
    return m ? `https://player.vimeo.com/video/${m[1]}` : l.videoUrl;
  }
  return l.videoUrl;
}

const icone = (type: string) => (type === "video" ? PlayCircle : type === "audio" ? Headphones : type === "quiz" ? HelpCircle : type === "devoir" ? PenLine : FileText);

export function FormationPlayer(p: Props) {
  const t = useT();
  const api = `/api/apprenant/${p.token}`;
  const router = useRouter();
  const [chapitres, setChapitres] = useState(p.chapitres);
  useEffect(() => setChapitres(p.chapitres), [p.chapitres]);
  const toutes = useMemo(() => chapitres.flatMap((c) => c.lecons), [chapitres]);
  const [completes, setCompletes] = useState<Set<string>>(new Set(p.completedIds));
  const [favoris, setFavoris] = useState<Set<string>>(new Set(p.favoriIds));
  const [activeId, setActiveId] = useState<string | null>(() => {
    const ouvertes = p.chapitres.flatMap((c) => c.lecons).filter((l) => !l.verrou);
    return (ouvertes.find((l) => l.id === p.derniereLeconId) ?? ouvertes.find((l) => !p.completedIds.includes(l.id)) ?? ouvertes[0])?.id ?? null;
  });
  const [contenu, setContenu] = useState<Contenu | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const [filtreFavoris, setFiltreFavoris] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<{ id: string; titre: string; extrait: string | null }[] | null>(null);
  const [certificat, setCertificat] = useState(p.certificatCode);
  const [manque, setManque] = useState<string[] | null>(null);
  const cache = useRef(new Map<string, Contenu>());

  const active = toutes.find((l) => l.id === activeId) ?? null;
  const idx = active ? toutes.indexOf(active) : -1;
  const precedente = idx > 0 ? toutes[idx - 1] : null;
  const suivante = idx >= 0 && idx < toutes.length - 1 ? toutes[idx + 1] : null;
  const total = toutes.length;
  const pct = total ? Math.round((toutes.filter((l) => completes.has(l.id)).length / total) * 100) : 0;
  const nbReussites = toutes.filter((l) => l.reussi).length;
  const nbEvaluations = toutes.filter((l) => l.reussi !== null).length;

  // Une leçon à la fois, gardée en mémoire : naviguer en arrière ne recharge rien.
  const charger = useCallback(async (id: string) => {
    setErreur(null);
    const enCache = cache.current.get(id);
    if (enCache) { setContenu(enCache); return; }
    setContenu(null);
    setChargement(true);
    try {
      const r = await fetch(`${api}/lecons/${id}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErreur(d.error ?? t("Impossible de charger la leçon")); return; }
      cache.current.set(id, d);
      setContenu(d);
    } catch {
      setErreur(t("Connexion impossible. Vérifie ton réseau puis réessaie."));
    } finally {
      setChargement(false);
    }
  }, [api, t]);

  useEffect(() => {
    if (!active) return;
    if (active.verrou) { setContenu(null); setErreur(null); return; }
    charger(active.id);
    window.scrollTo({ top: 0 });
  }, [active, charger]);

  const aller = (id: string | undefined | null) => { if (id) { setActiveId(id); setSidebar(false); setResultats(null); } };

  // Clavier : Alt+← / Alt+→ pour changer de leçon (hors champs de saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || (e.target as HTMLElement)?.closest("input,textarea")) return;
      if (e.key === "ArrowLeft") aller(precedente?.id);
      if (e.key === "ArrowRight") aller(suivante?.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const poster = (id: string, body: object) =>
    fetch(`${api}/lecons/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });

  function majCache(id: string, f: (c: Contenu) => Contenu) {
    const c = cache.current.get(id);
    if (c) { const n = f(c); cache.current.set(id, n); if (id === activeId) setContenu(n); }
  }

  function apresTerminee(id: string, code: string | null) {
    setCompletes((s) => new Set(s).add(id));
    majCache(id, (c) => ({ ...c, progression: { ...c.progression, complete: true } }));
    if (code && !certificat) { setCertificat(code); toast.success(t("Bravo ! Ton attestation est disponible.")); }
    // Prérequis : les verrous sont recalculés côté serveur (nouvelle structure, sans rechargement de page).
    if (toutes.some((l) => l.verrou)) router.refresh();
  }

  async function terminer() {
    if (!active) return;
    const r = await poster(active.id, { action: "terminer" }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    if (!r?.ok) { toast.error(t(d?.error ?? "Erreur — réessayez")); return; }
    toast.success(t("Leçon terminée"));
    apresTerminee(active.id, d.certificat);
    if (suivante && !suivante.verrou) aller(suivante.id);
  }

  async function basculerFavori() {
    if (!active) return;
    const favori = !favoris.has(active.id);
    setFavoris((s) => { const n = new Set(s); if (favori) n.add(active.id); else n.delete(active.id); return n; });
    if (!(await poster(active.id, { action: "favori", favori }).catch(() => null))?.ok) toast.error(t("Favori non enregistré"));
  }

  async function chercher(e: React.FormEvent) {
    e.preventDefault();
    if (recherche.trim().length < 2) { setResultats(null); return; }
    const r = await fetch(`${api}/recherche?q=${encodeURIComponent(recherche.trim())}`).catch(() => null);
    setResultats(r?.ok ? (await r.json()).resultats : []);
  }

  async function voirManque() {
    const r = await fetch(`${api}/certificat?etat=1`).catch(() => null);
    const d = r?.ok ? await r.json() : null;
    if (d?.code) setCertificat(d.code);
    setManque(d?.manque ?? [t("Impossible de vérifier pour le moment")]);
  }

  const lecon = contenu?.lecon.id === activeId ? contenu : null;
  const embed = lecon ? embedVideo(lecon.lecon) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: p.fond, color: p.texte }}>
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 py-3 border-b" style={{ background: `${p.fond}f0`, backdropFilter: "blur(16px)", borderColor: `${p.accent}18` }}>
        <button onClick={() => setSidebar((v) => !v)} aria-label={t("Plan du cours")} className="lg:hidden p-2 rounded-xl" style={{ background: `${p.accent}12` }}>
          {sidebar ? <X size={16} /> : <Menu size={16} />}
        </button>
        {p.logoUrl ? <img src={p.logoUrl} alt="" className="h-7 rounded" /> : <GraduationCap size={20} style={{ color: p.accent }} />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{p.produitNom}</p>
          <p className="text-[11px] opacity-50 truncate">{p.nomBoutique}{p.niveau ? ` · ${p.niveau}` : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" title={t("Progression : leçons terminées")}>
          <div className="hidden sm:block w-28 h-1.5 rounded-full overflow-hidden" style={{ background: `${p.accent}15` }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: p.accent }} />
          </div>
          <span className="text-[11px] font-bold" style={{ color: p.accent }}>{pct}%</span>
        </div>
      </header>

      <div className="flex-1 flex relative">
        <aside
          className={`fixed lg:sticky top-[57px] left-0 h-[calc(100vh-57px)] w-80 max-w-[85vw] flex-shrink-0 overflow-y-auto border-r z-20 transition-transform duration-300 ${sidebar ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
          style={{ background: p.surface, borderColor: `${p.accent}15` }}
        >
          <div className="p-4 space-y-4">
            <form onSubmit={chercher} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: `${p.accent}0d` }}>
              <Search size={14} className="opacity-50 flex-shrink-0" />
              <input value={recherche} onChange={(e) => { setRecherche(e.target.value); if (!e.target.value) setResultats(null); }} placeholder={t("Rechercher dans le cours…")} aria-label={t("Rechercher dans le cours")} className="flex-1 min-w-0 bg-transparent text-base sm:text-sm outline-none" />
            </form>
            {resultats && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">{resultats.length} {t("résultat(s)")}</p>
                {resultats.length === 0 && <p className="text-xs opacity-60">{t("Rien trouvé dans les leçons ouvertes.")}</p>}
                {resultats.map((r) => (
                  <button key={r.id} onClick={() => aller(r.id)} className="w-full text-left px-3 py-2 rounded-xl hover:opacity-80" style={{ background: `${p.accent}0d` }}>
                    <p className="text-[13px] font-semibold">{r.titre}</p>
                    {r.extrait && <p className="text-[11px] opacity-60 line-clamp-2">{r.extrait}</p>}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] opacity-70">
              <span>{t("Terminées")} {toutes.filter((l) => completes.has(l.id)).length}/{total}{nbEvaluations ? ` · ${t("Réussies")} ${nbReussites}/${nbEvaluations}` : ""}</span>
              <button onClick={() => setFiltreFavoris((v) => !v)} aria-pressed={filtreFavoris} className="flex items-center gap-1 font-semibold" style={{ color: filtreFavoris ? p.accent : undefined }}>
                <Star size={12} fill={filtreFavoris ? p.accent : "none"} />{" "}{t("Favoris")}
              </button>
            </div>

            {chapitres.map((ch, ci) => {
              const lecons = filtreFavoris ? ch.lecons.filter((l) => favoris.has(l.id)) : ch.lecons;
              if (!lecons.length) return null;
              return (
                <div key={ch.id}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2 opacity-40">{t("Module")} {ci + 1} · {ch.titre}</p>
                  <div className="space-y-1">
                    {lecons.map((l) => {
                      const estActive = l.id === activeId;
                      const Icon = icone(l.type);
                      return (
                        <button key={l.id} onClick={() => aller(l.id)} aria-current={estActive ? "page" : undefined} title={l.verrou ?? undefined}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                          style={{ background: estActive ? `${p.accent}15` : "transparent", opacity: l.verrou ? 0.55 : 1 }}>
                          {l.verrou ? <Lock size={14} style={{ flexShrink: 0, opacity: 0.6 }} />
                            : completes.has(l.id) ? <CheckCircle2 size={15} style={{ color: p.accent, flexShrink: 0 }} />
                            : <Circle size={15} style={{ opacity: 0.25, flexShrink: 0 }} />}
                          <Icon size={13} style={{ opacity: 0.4, flexShrink: 0 }} />
                          <span className="text-[13px] flex-1 min-w-0 truncate" style={{ fontWeight: estActive ? 700 : 500 }}>{l.titre}</span>
                          {l.reussi && <Award size={12} style={{ color: p.accent, flexShrink: 0 }} aria-label={t("Réussi")} />}
                          {favoris.has(l.id) && <Star size={11} fill={p.accent} style={{ color: p.accent, flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {filtreFavoris && favoris.size === 0 && <p className="text-xs opacity-60">{t("Aucun favori. Clique sur l'étoile d'une leçon pour la retrouver ici.")}</p>}

            {p.certif && (
              <div className="rounded-xl p-3.5 text-center mt-4 space-y-2" style={{ background: `${p.accent}12`, border: `1px solid ${p.accent}30` }}>
                <Award size={20} className="mx-auto" style={{ color: p.accent }} />
                {certificat ? (
                  <>
                    <p className="text-[11px] font-bold" style={{ color: p.accent }}>{t("Attestation obtenue")}</p>
                    <a href={`${api}/certificat`} className="flex items-center justify-center gap-1.5 text-[12px] font-bold underline"><Download size={12} />{" "}{t("Télécharger (PDF)")}</a>
                    <p className="text-[10px] font-mono opacity-60">{certificat}</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-bold" style={{ color: p.accent }}>{t("Attestation de réussite")}</p>
                    {manque ? <ul className="text-[11px] opacity-75 text-left list-disc pl-4">{manque.map((m) => <li key={m}>{m}</li>)}</ul>
                      : <button onClick={voirManque} className="text-[11px] underline">{t("Voir ce qu'il reste à faire")}</button>}
                  </>
                )}
              </div>
            )}
          </div>
        </aside>
        {sidebar && <div className="fixed inset-0 bg-black/40 z-10 lg:hidden" onClick={() => setSidebar(false)} />}

        <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-10 max-w-3xl mx-auto w-full">
          {!active ? (
            <p className="text-center opacity-50 py-20">{toutes.length ? t("Toutes les leçons sont encore verrouillées. Reviens bientôt !") : t("Cette formation n'a pas encore de contenu.")}</p>
          ) : (
            <>
              <div className="flex items-start gap-3 mb-5">
                <h1 className="flex-1 text-xl sm:text-2xl font-bold font-playfair">{active.titre}</h1>
                {!active.verrou && (
                  <button onClick={basculerFavori} aria-pressed={favoris.has(active.id)} aria-label={t("Favori")} className="p-2 rounded-xl" style={{ background: `${p.accent}12` }}>
                    <Star size={16} fill={favoris.has(active.id) ? p.accent : "none"} style={{ color: p.accent }} />
                  </button>
                )}
              </div>

              {active.verrou ? (
                <div className="rounded-2xl p-8 text-center" style={{ background: `${p.accent}0d` }}>
                  <Lock size={28} className="mx-auto mb-3 opacity-60" />
                  <p className="font-semibold">{t("Leçon verrouillée")}</p>
                  <p className="text-sm opacity-70 mt-1">{active.verrou}</p>
                </div>
              ) : erreur ? (
                <div role="alert" className="rounded-2xl p-8 text-center" style={{ background: `${p.accent}0d` }}>
                  <p className="text-sm mb-3">{erreur}</p>
                  <button onClick={() => charger(active.id)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: p.accent, color: p.fond }}><RotateCcw size={14} />{" "}{t("Réessayer")}</button>
                </div>
              ) : chargement || !lecon ? (
                <div className="py-20 flex justify-center opacity-50" aria-busy="true"><Loader2 className="animate-spin" /></div>
              ) : (
                <>
                  {lecon.lecon.type === "video" && embed && (
                    <div className="relative w-full overflow-hidden rounded-2xl mb-6" style={{ paddingBottom: "56.25%", background: "#000" }}>
                      {lecon.lecon.videoType === "upload"
                        ? <Media key={lecon.lecon.id} kind="video" src={embed} position={lecon.progression.position} onPosition={(s) => poster(lecon.lecon.id, { action: "position", position: s })} />
                        : <iframe src={embed} title={active.titre} loading="lazy" className="absolute inset-0 w-full h-full border-0" allowFullScreen />}
                    </div>
                  )}
                  {lecon.lecon.type === "audio" && lecon.lecon.audioUrl && (
                    <Media key={lecon.lecon.id} kind="audio" src={lecon.lecon.audioUrl} position={lecon.progression.position} onPosition={(s) => poster(lecon.lecon.id, { action: "position", position: s })} />
                  )}
                  {lecon.lecon.contenu && (
                    <div className="prose text-sm leading-relaxed opacity-85 mb-8" style={{ whiteSpace: "pre-line" }} dangerouslySetInnerHTML={{ __html: lecon.lecon.contenu }} />
                  )}

                  {lecon.quiz && (
                    <Quiz key={lecon.lecon.id} api={`${api}/lecons/${lecon.lecon.id}/quiz`} quiz={lecon.quiz} accent={p.accent} fond={p.fond}
                      onReussi={(code) => { setChapitres((cs) => cs.map((c) => ({ ...c, lecons: c.lecons.map((l) => l.id === lecon.lecon.id ? { ...l, reussi: true } : l) }))); apresTerminee(lecon.lecon.id, code); cache.current.delete(lecon.lecon.id); }} />
                  )}
                  {lecon.lecon.type === "quiz" && !lecon.quiz && <p className="text-sm opacity-60">{t("Le quiz n'est pas encore prêt.")}</p>}
                  {lecon.lecon.type === "devoir" && (
                    <Devoir key={lecon.lecon.id} api={`${api}/lecons/${lecon.lecon.id}/devoir`} rendu={lecon.devoir} accent={p.accent} fond={p.fond}
                      onRendu={() => { apresTerminee(lecon.lecon.id, null); cache.current.delete(lecon.lecon.id); }} />
                  )}

                  {lecon.lecon.ressources.length > 0 && (
                    <div className="mb-8">
                      <p className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">{t("Ressources")}</p>
                      <div className="space-y-1.5">
                        {lecon.lecon.ressources.map((r) => (
                          <a key={r.id} href={`${api}/ressources/${r.id}`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm" style={{ background: `${p.accent}0d` }}>
                            <Download size={14} style={{ color: p.accent }} /><span className="flex-1 truncate">{r.nom}</span>
                            {r.taille ? <span className="text-[11px] opacity-50">{(r.taille / 1_048_576).toFixed(1)} Mo</span> : null}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <Notes key={lecon.lecon.id} initial={lecon.progression.note ?? ""} accent={p.accent}
                    onSave={async (note) => { const ok = (await poster(lecon.lecon.id, { action: "note", note }).catch(() => null))?.ok; if (ok) majCache(lecon.lecon.id, (c) => ({ ...c, progression: { ...c.progression, note } })); return !!ok; }} />
                </>
              )}

              <div className="flex items-center justify-between gap-3 pt-6 mt-6 border-t" style={{ borderColor: `${p.accent}12` }}>
                <button onClick={() => aller(precedente?.id)} disabled={!precedente} title="Alt + ←"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-30" style={{ border: `1px solid ${p.accent}25` }}>
                  <ChevronLeft size={14} /><span className="hidden sm:inline">{t("Précédent")}</span>
                </button>
                {completes.has(active.id) ? (
                  <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: p.accent }}><CheckCircle2 size={16} />{" "}{t("Terminé")}</span>
                ) : !active.verrou && lecon && !["quiz", "devoir"].includes(active.type) ? (
                  <button onClick={terminer} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: p.accent, color: p.fond }}>
                    {t("Marquer comme terminé")}
                  </button>
                ) : <span />}
                <button onClick={() => aller(suivante?.id)} disabled={!suivante} title="Alt + →"
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-30" style={{ border: `1px solid ${p.accent}25` }}>
                  <span className="hidden sm:inline">{t("Suivant")}</span><ChevronRight size={14} />
                </button>
              </div>
            </>
          )}
        </main>
      </div>

      <TuteurIA api={api} leconId={active && !active.verrou ? active.id : null} quiz={active?.type === "quiz"} accent={p.accent} fond={p.fond} texte={p.texte} onOuvrir={aller} />

      <footer className="border-t py-6 text-center text-xs opacity-40" style={{ borderColor: `${p.accent}12` }}>
        {p.nomBoutique}{" "}{t("· Propulsé par")}{" "}<span style={{ color: p.accent }}>Axso</span>
      </footer>
    </div>
  );
}

// Vidéo/audio hébergés : reprise à la dernière position, enregistrée toutes les 15 s de lecture et à la pause.
// (Les lecteurs YouTube/Vimeo intégrés ne donnent pas leur position : pas de reprise pour eux.)
function Media({ kind, src, position, onPosition }: { kind: "video" | "audio"; src: string; position: number | null; onPosition: (s: number) => void }) {
  const dernier = useRef(0);
  const props = {
    src, controls: true, preload: "metadata" as const,
    onLoadedMetadata: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const m = e.currentTarget;
      if (position && position > 5 && position < (m.duration || Infinity) - 5) m.currentTime = position;
    },
    onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const s = Math.floor(e.currentTarget.currentTime);
      if (Math.abs(s - dernier.current) >= 15) { dernier.current = s; onPosition(s); }
    },
    onPause: (e: React.SyntheticEvent<HTMLMediaElement>) => { dernier.current = Math.floor(e.currentTarget.currentTime); onPosition(dernier.current); },
  };
  return kind === "video" ? <video {...props} playsInline className="absolute inset-0 w-full h-full object-contain" /> : <audio {...props} className="w-full mb-6" />;
}

function Notes({ initial, accent, onSave }: { initial: string; accent: string; onSave: (n: string) => Promise<boolean> }) {
  const t = useT();
  const [note, setNote] = useState(initial);
  const [etat, setEtat] = useState<"" | "enregistrement" | "ok" | "erreur">("");
  const sauver = async () => {
    if (note === initial && etat !== "erreur") return;
    setEtat("enregistrement");
    setEtat((await onSave(note)) ? "ok" : "erreur");
  };
  return (
    <details className="mb-2 rounded-xl" style={{ background: `${accent}08` }} open={!!initial}>
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold flex items-center gap-2"><PenLine size={14} />{" "}{t("Mes notes")}</summary>
      <div className="px-3 pb-3">
        <textarea value={note} onChange={(e) => { setNote(e.target.value); setEtat(""); }} onBlur={sauver} rows={4} maxLength={20000}
          placeholder={t("Tes notes personnelles sur cette leçon (visibles par toi seul)…")} aria-label={t("Mes notes")}
          className="w-full rounded-lg p-2.5 text-base sm:text-sm bg-transparent outline-none" style={{ border: `1px solid ${accent}25` }} />
        <p className="text-[11px] opacity-60 h-4" aria-live="polite">{etat === "enregistrement" ? t("Enregistrement…") : etat === "ok" ? t("Enregistré") : etat === "erreur" ? t("Non enregistré — réessaie") : ""}</p>
      </div>
    </details>
  );
}

type Correction = { id: string; juste: boolean; bonnes?: number[]; acceptees?: string[]; explication?: string | null };

function Quiz({ api, quiz, accent, fond, onReussi }: { api: string; quiz: NonNullable<Contenu["quiz"]>; accent: string; fond: string; onReussi: (certificat: string | null) => void }) {
  const t = useT();
  const [reponses, setReponses] = useState<Record<string, number | number[] | string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState<{ score: number; reussi: boolean; tentativesRestantes: number | null; correction: Correction[] } | null>(null);
  const [historique, setHistorique] = useState(quiz.tentatives);
  const dejaReussi = historique.some((h) => h.reussi);
  const restantes = quiz.tentativesMax ? quiz.tentativesMax - historique.length : null;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reponses }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setEnvoi(false);
    if (!r?.ok) { toast.error(t(d?.error ?? "Envoi impossible — réessaie")); return; }
    setResultat(d);
    setHistorique((h) => [{ score: d.score, reussi: d.reussi, createdAt: new Date().toISOString() }, ...h]);
    if (d.reussi) { toast.success(t("Quiz réussi !")); onReussi(d.certificat); }
  }

  const corr = (id: string) => resultat?.correction.find((c) => c.id === id);
  const bloque = !!resultat || (restantes !== null && restantes <= 0);

  return (
    <div className="mb-8 space-y-4">
      <p className="text-sm opacity-75">
        {t("Note minimale")} : <b>{quiz.noteMin} %</b>
        {quiz.tentativesMax ? <> · {t("Tentatives restantes")} : <b>{Math.max(0, restantes ?? 0)}</b></> : null}
        {dejaReussi && <> · <span style={{ color: accent }}>{t("Déjà réussi")}</span></>}
      </p>
      <form onSubmit={soumettre} className="space-y-4">
        {quiz.questions.map((q, i) => {
          const c = corr(q.id);
          return (
            <fieldset key={q.id} className="rounded-xl p-4" style={{ border: `1px solid ${c ? (c.juste ? "#16a34a" : "#dc2626") : `${accent}25`}` }} disabled={bloque}>
              <legend className="px-1 text-sm font-semibold">{i + 1}. {q.enonce} <span className="opacity-50 font-normal">({q.points} pt{q.points > 1 ? "s" : ""})</span></legend>
              {q.type === "courte" ? (
                <input value={(reponses[q.id] as string) ?? ""} onChange={(e) => setReponses((r) => ({ ...r, [q.id]: e.target.value }))} maxLength={500}
                  className="w-full mt-2 rounded-lg p-2.5 text-base sm:text-sm bg-transparent outline-none" style={{ border: `1px solid ${accent}25` }} aria-label={q.enonce} />
              ) : (
                <div className="mt-2 space-y-1.5">
                  {q.options.map((o, oi) => {
                    const multiple = q.type === "multiple";
                    const coche = multiple ? ((reponses[q.id] as number[]) ?? []).includes(oi) : reponses[q.id] === oi;
                    return (
                      <label key={oi} className="flex items-center gap-2.5 text-sm cursor-pointer rounded-lg px-2 py-1.5" style={{ background: c?.bonnes?.includes(oi) ? "#16a34a1a" : undefined }}>
                        <input type={multiple ? "checkbox" : "radio"} name={q.id} checked={coche}
                          onChange={() => setReponses((r) => {
                            if (!multiple) return { ...r, [q.id]: oi };
                            const cur = new Set((r[q.id] as number[]) ?? []);
                            if (cur.has(oi)) cur.delete(oi); else cur.add(oi);
                            return { ...r, [q.id]: [...cur] };
                          })} />
                        {o}
                      </label>
                    );
                  })}
                </div>
              )}
              {c && <p className="text-xs mt-2" style={{ color: c.juste ? "#16a34a" : "#dc2626" }}>{c.juste ? t("Bonne réponse") : t("Réponse incorrecte")}{c.acceptees?.length && !c.juste ? ` — ${t("attendu")} : ${c.acceptees[0]}` : ""}</p>}
              {c?.explication && <p className="text-xs opacity-70 mt-1">{c.explication}</p>}
            </fieldset>
          );
        })}
        {resultat ? (
          <div className="rounded-xl p-4 text-sm" style={{ background: resultat.reussi ? "#16a34a1a" : "#dc26261a" }} role="status">
            <b>{resultat.score} %</b> — {resultat.reussi ? t("Réussi !") : t("Pas encore : il faut") + ` ${quiz.noteMin} %.`}
            {!resultat.reussi && resultat.tentativesRestantes !== 0 && (
              <button type="button" onClick={() => { setResultat(null); setReponses({}); }} className="ml-3 underline font-semibold">{t("Réessayer")}</button>
            )}
          </div>
        ) : restantes !== null && restantes <= 0 ? (
          <p className="text-sm opacity-70">{t("Tu as utilisé toutes tes tentatives pour ce quiz.")}</p>
        ) : (
          <button type="submit" disabled={envoi} className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: accent, color: fond }}>
            {envoi ? "…" : t("Valider mes réponses")}
          </button>
        )}
      </form>
      {historique.length > 0 && (
        <details className="text-xs opacity-75">
          <summary className="cursor-pointer">{t("Historique")} ({historique.length})</summary>
          <ul className="mt-1 space-y-0.5">{historique.map((h, i) => <li key={i}>{new Date(h.createdAt).toLocaleString("fr-FR")} — {h.score} % {h.reussi ? "✓" : "✗"}</li>)}</ul>
        </details>
      )}
    </div>
  );
}

const STATUT_DEVOIR: Record<string, string> = { soumis: "Rendu — en attente de correction", valide: "Validé par le formateur", a_refaire: "À reprendre" };

function Devoir({ api, rendu, accent, fond, onRendu }: { api: string; rendu: Contenu["devoir"]; accent: string; fond: string; onRendu: () => void }) {
  const t = useT();
  const [texte, setTexte] = useState(rendu?.texte ?? "");
  const [statut, setStatut] = useState(rendu?.statut ?? null);
  const [envoi, setEnvoi] = useState(false);
  async function rendre(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texte }) }).catch(() => null);
    const d = await r?.json().catch(() => ({}));
    setEnvoi(false);
    if (!r?.ok) { toast.error(t(d?.error ?? "Envoi impossible — réessaie")); return; }
    setStatut("soumis");
    toast.success(t("Devoir rendu"));
    onRendu();
  }
  return (
    <form onSubmit={rendre} className="mb-8 space-y-3">
      {statut && <p className="text-sm font-semibold" style={{ color: statut === "valide" ? "#16a34a" : statut === "a_refaire" ? "#dc2626" : accent }}>{t(STATUT_DEVOIR[statut] ?? statut)}{rendu?.note != null && statut !== "soumis" ? ` · ${rendu.note}/100` : ""}</p>}
      {rendu?.feedback && <div className="rounded-xl p-3 text-sm" style={{ background: `${accent}0d` }}><b>{t("Retour du formateur")} :</b> {rendu.feedback}</div>}
      <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={8} maxLength={20000} disabled={statut === "valide"} required
        placeholder={t("Ta réponse…")} aria-label={t("Ta réponse")} className="w-full rounded-xl p-3 text-base sm:text-sm bg-transparent outline-none" style={{ border: `1px solid ${accent}25` }} />
      {statut !== "valide" && (
        <button type="submit" disabled={envoi || !texte.trim()} className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50" style={{ background: accent, color: fond }}>
          {envoi ? "…" : statut ? t("Mettre à jour mon rendu") : t("Rendre le devoir")}
        </button>
      )}
    </form>
  );
}
