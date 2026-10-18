"use client";
import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Plus, ChevronDown, ChevronRight, Trash2, Edit2,
  Video, FileText, Music, Eye, EyeOff, GripVertical, Check, X,
  Loader2, Clock, Globe, HelpCircle, PenLine, Lock, Paperclip, Users, Award,
} from "lucide-react";
import Link from "next/link";
import { useT } from "@/components/I18nProvider";
import { televerser } from "@/lib/televerser";

// ─── Types ───────────────────────────────────────────────────────────────────

type Statut = "brouillon" | "publie" | "archive";
type QuestionQuiz = { id: string; type: "qcm" | "multiple" | "vrai_faux" | "courte"; enonce: string; options: string[]; bonnes: number[]; acceptees: string[]; points: number; explication?: string };
type Quiz = { noteMin: number; tentativesMax: number | null; questions: QuestionQuiz[] };
type Ressource = { nom: string; url: string; mime?: string | null; taille?: number | null };
type Pedagogie = { statut: Statut; prerequis: string[]; dripJours: number | null; dripDate: string | null };

type Lecon = Pedagogie & {
  id: string;
  titre: string;
  type: "texte" | "video" | "audio" | "quiz" | "devoir";
  quiz: Quiz | null;
  ressources: Ressource[];
  videoType: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  contenu: string | null;
  duree: number | null;
  gratuite: boolean;
  actif: boolean;
  ordre: number;
};

type Chapitre = Pedagogie & {
  id: string;
  titre: string;
  actif: boolean;
  ordre: number;
  lecons: Lecon[];
  _count: { lecons: number };
};

const TYPE_LECON = [
  { id: "texte", label: "Texte / HTML", icon: FileText, color: "#111111" },
  { id: "video", label: "Vidéo",        icon: Video,    color: "#F5A623" },
  { id: "audio", label: "Audio",        icon: Music,    color: "#db2777" },
  { id: "quiz",  label: "Quiz",         icon: HelpCircle, color: "#7c3aed" },
  { id: "devoir", label: "Devoir",      icon: PenLine,  color: "#0891b2" },
] as const;

const STATUTS: { id: Statut; label: string }[] = [
  { id: "publie", label: "Publié" },
  { id: "brouillon", label: "Brouillon" },
  { id: "archive", label: "Archivé" },
];

const nouvelId = () => Math.random().toString(36).slice(2, 10);

// ─── Statut, prérequis, déblocage progressif (leçon ou module) ───────────────

function ReglagesPedagogie({ valeur, onChange, candidats, libellePrerequis }: {
  valeur: Pedagogie; onChange: (v: Pedagogie) => void; candidats: { id: string; titre: string }[]; libellePrerequis: string;
}) {
  const tr = useT();
  const cls = "px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 bg-white";
  return (
    <div className="grid sm:grid-cols-3 gap-2 text-xs">
      <label className="space-y-1"><span className="text-gray-500">{tr("Statut")}</span>
        <select value={valeur.statut} onChange={(e) => onChange({ ...valeur, statut: e.target.value as Statut })} className={`${cls} w-full`}>
          {STATUTS.map((s) => <option key={s.id} value={s.id}>{tr(s.label)}</option>)}
        </select>
      </label>
      <label className="space-y-1"><span className="text-gray-500">{tr("Ouvrir X jours après l'inscription")}</span>
        <input type="number" min={0} value={valeur.dripJours ?? ""} onChange={(e) => onChange({ ...valeur, dripJours: e.target.value ? Number(e.target.value) : null })} placeholder={tr("Tout de suite")} className={`${cls} w-full`} />
      </label>
      <label className="space-y-1"><span className="text-gray-500">{tr("ou à partir du")}</span>
        <input type="date" value={valeur.dripDate?.slice(0, 10) ?? ""} onChange={(e) => onChange({ ...valeur, dripDate: e.target.value || null })} className={`${cls} w-full`} />
      </label>
      {candidats.length > 0 && (
        <details className="sm:col-span-3">
          <summary className="cursor-pointer text-gray-500"><Lock size={11} className="inline mr-1" />{tr(libellePrerequis)} ({valeur.prerequis.length})</summary>
          <div className="mt-1 max-h-36 overflow-y-auto space-y-0.5">
            {candidats.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-gray-700">
                <input type="checkbox" checked={valeur.prerequis.includes(c.id)}
                  onChange={(e) => onChange({ ...valeur, prerequis: e.target.checked ? [...valeur.prerequis, c.id] : valeur.prerequis.filter((x) => x !== c.id) })} />
                {c.titre}
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Éditeur de quiz (les bonnes réponses ne quittent le serveur que vers le formateur) ──

function QuizEditeur({ quiz, onChange }: { quiz: Quiz; onChange: (q: Quiz) => void }) {
  const tr = useT();
  const cls = "px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 bg-white";
  const majQ = (i: number, q: Partial<QuestionQuiz>) => onChange({ ...quiz, questions: quiz.questions.map((x, j) => (j === i ? { ...x, ...q } : x)) });
  return (
    <div className="space-y-3 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-1.5">{tr("Note minimale (%)")}<input type="number" min={0} max={100} value={quiz.noteMin} onChange={(e) => onChange({ ...quiz, noteMin: Number(e.target.value) })} className={`${cls} w-16`} /></label>
        <label className="flex items-center gap-1.5">{tr("Tentatives max")}<input type="number" min={1} value={quiz.tentativesMax ?? ""} placeholder="∞" onChange={(e) => onChange({ ...quiz, tentativesMax: e.target.value ? Number(e.target.value) : null })} className={`${cls} w-16`} /></label>
      </div>
      {quiz.questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
          <div className="flex gap-2">
            <select value={q.type} onChange={(e) => majQ(i, { type: e.target.value as QuestionQuiz["type"], bonnes: [], options: e.target.value === "vrai_faux" ? [] : q.options })} className={cls}>
              <option value="qcm">{tr("Choix unique")}</option>
              <option value="multiple">{tr("Choix multiples")}</option>
              <option value="vrai_faux">{tr("Vrai / Faux")}</option>
              <option value="courte">{tr("Réponse courte")}</option>
            </select>
            <input value={q.enonce} onChange={(e) => majQ(i, { enonce: e.target.value })} placeholder={tr("Question")} className={`${cls} flex-1`} />
            <input type="number" min={1} value={q.points} onChange={(e) => majQ(i, { points: Number(e.target.value) || 1 })} title={tr("Points")} className={`${cls} w-14`} />
            <button onClick={() => onChange({ ...quiz, questions: quiz.questions.filter((_, j) => j !== i) })} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
          </div>
          {q.type === "courte" ? (
            <input value={q.acceptees.join(" | ")} onChange={(e) => majQ(i, { acceptees: e.target.value.split("|").map((x) => x.trim()).filter(Boolean) })}
              placeholder={tr("Réponses acceptées, séparées par | (casse et accents ignorés)")} className={`${cls} w-full`} />
          ) : (
            <div className="space-y-1">
              {(q.type === "vrai_faux" ? ["Vrai", "Faux"] : q.options).map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type={q.type === "multiple" ? "checkbox" : "radio"} name={`bonne-${q.id}`} checked={q.bonnes.includes(oi)} title={tr("Bonne réponse")}
                    onChange={(e) => majQ(i, { bonnes: q.type === "multiple" ? (e.target.checked ? [...q.bonnes, oi] : q.bonnes.filter((x) => x !== oi)) : [oi] })} />
                  {q.type === "vrai_faux" ? <span className="text-xs">{tr(o)}</span> : (
                    <>
                      <input value={o} onChange={(e) => majQ(i, { options: q.options.map((x, k) => (k === oi ? e.target.value : x)) })} className={`${cls} flex-1`} />
                      <button onClick={() => majQ(i, { options: q.options.filter((_, k) => k !== oi), bonnes: q.bonnes.filter((b) => b !== oi).map((b) => (b > oi ? b - 1 : b)) })} className="text-gray-300 hover:text-red-500"><X size={11} /></button>
                    </>
                  )}
                </div>
              ))}
              {q.type !== "vrai_faux" && q.options.length < 10 && <button onClick={() => majQ(i, { options: [...q.options, ""] })} className="text-[11px] text-violet-600">+ {tr("Choix")}</button>}
            </div>
          )}
          <input value={q.explication ?? ""} onChange={(e) => majQ(i, { explication: e.target.value })} placeholder={tr("Explication montrée après correction (facultatif)")} className={`${cls} w-full`} />
        </div>
      ))}
      <button onClick={() => onChange({ ...quiz, questions: [...quiz.questions, { id: nouvelId(), type: "qcm", enonce: "", options: ["", ""], bonnes: [], acceptees: [], points: 1 }] })}
        className="flex items-center gap-1 text-xs font-medium text-violet-700"><Plus size={12} />{" "}{tr("Ajouter une question")}</button>
    </div>
  );
}

// ─── Ressources téléchargeables (stockage de la boutique, servies par une route contrôlée) ──

function RessourcesEditeur({ ressources, onChange }: { ressources: Ressource[]; onChange: (r: Ressource[]) => void }) {
  const tr = useT();
  const [envoi, setEnvoi] = useState(false);
  async function ajouter(fichier: File | undefined) {
    if (!fichier) return;
    setEnvoi(true);
    const fd = new FormData();
    fd.append("file", fichier);
    const r = await televerser(fd, "digital");
    const d = await r.json();
    setEnvoi(false);
    if (!r.ok) { alert(tr(d.error) ?? tr("Erreur")); return; }
    onChange([...ressources, { nom: d.nom, url: d.url, mime: d.type || null, taille: d.taille ?? null }]);
  }
  return (
    <div className="space-y-1 text-xs">
      {ressources.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-gray-700"><Paperclip size={11} /><span className="flex-1 truncate">{r.nom}</span>
          <button onClick={() => onChange(ressources.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><X size={11} /></button>
        </div>
      ))}
      <label className="inline-flex items-center gap-1.5 cursor-pointer text-gray-500 hover:text-[#D4911A]">
        {envoi ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}{" "}{tr("Ajouter une ressource téléchargeable")}
        <input type="file" className="hidden" disabled={envoi} onChange={(e) => { ajouter(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
    </div>
  );
}

const VIDEO_TYPE_OPTS = [
  { id: "youtube", label: "YouTube" },
  { id: "vimeo",   label: "Vimeo" },
  { id: "iframe",  label: "Lien direct / iframe" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dureeLabel(sec: number | null): string {
  if (!sec) return "";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m${s}s` : `${m}min`;
}

// ─── Lecon Form (inline) ─────────────────────────────────────────────────────

function LeconForm({
  initial,
  produitId,
  chapitreId,
  leconId,
  autres,
  onSave,
  onCancel,
}: {
  initial: Partial<Lecon>;
  autres: { id: string; titre: string }[];
  produitId: string;
  chapitreId: string;
  leconId?: string;
  onSave: (l: Lecon) => void;
  onCancel: () => void;
}) {
  const tr = useT();
  const [titre,     setTitre]     = useState(initial.titre ?? "");
  const [type,      setType]      = useState<Lecon["type"]>(initial.type ?? "texte");
  const [peda,      setPeda]      = useState<Pedagogie>({ statut: initial.statut ?? "publie", prerequis: initial.prerequis ?? [], dripJours: initial.dripJours ?? null, dripDate: initial.dripDate ?? null });
  const [quiz,      setQuiz]      = useState<Quiz>(initial.quiz ?? { noteMin: 70, tentativesMax: null, questions: [] });
  const [ressources, setRessources] = useState<Ressource[]>(initial.ressources ?? []);
  const [videoType, setVideoType] = useState(initial.videoType ?? "youtube");
  const [videoUrl,  setVideoUrl]  = useState(initial.videoUrl ?? "");
  const [audioUrl,  setAudioUrl]  = useState(initial.audioUrl ?? "");
  const [contenu,   setContenu]   = useState(initial.contenu ?? "");
  const [duree,     setDuree]     = useState(initial.duree?.toString() ?? "");
  const [gratuite,  setGratuite]  = useState(initial.gratuite ?? false);
  const [saving,    setSaving]    = useState(false);

  const base = `/api/formations/${produitId}/chapitres/${chapitreId}/lecons`;

  const sauvegarder = async () => {
    if (!titre.trim()) return;
    setSaving(true);
    if (type === "quiz" && quiz.questions.length === 0) { alert(tr("Ajoute au moins une question au quiz")); setSaving(false); return; }
    const body = {
      titre, type, videoType, videoUrl, audioUrl, contenu, duree: duree || null, gratuite,
      ...peda, dripDate: peda.dripDate ? new Date(peda.dripDate).toISOString() : null,
      ressources: ressources.map((r) => ({ nom: r.nom, url: r.url, mime: r.mime ?? null, taille: r.taille ?? null })),
      ...(type === "quiz" ? { quiz } : initial.quiz ? { quiz: null } : {}),
    };
    const r = leconId
      ? await fetch(`${base}/${leconId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    setSaving(false);
    if (r.ok) onSave(d.lecon);
    else alert(tr(d.error) ?? tr("Erreur"));
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40";

  return (
    <div className="bg-[#F5A623]/8 border border-[#F5A623]/25 rounded-xl p-4 space-y-3">
      <input
        value={titre} onChange={(e) => setTitre(e.target.value)}
        placeholder={tr("Titre de la leçon *")}
        className={inputCls}
      />

      {/* Type */}
      <div className="flex flex-wrap gap-2">
        {TYPE_LECON.map(({ id, label, icon: Ic, color }) => (
          <button
            key={id}
            onClick={() => setType(id as any)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
            style={type === id
              ? { borderColor: color + "60", background: color + "12", color }
              : { borderColor: "#e5e7eb", background: "white", color: "#6b7280" }}
          >
            <Ic size={12} /> {tr(label)}
          </button>
        ))}
      </div>

      {/* Contenu selon type */}
      {(type === "texte" || type === "quiz" || type === "devoir") && (
        <textarea
          value={contenu} onChange={(e) => setContenu(e.target.value)}
          rows={4} placeholder={tr(type === "devoir" ? "Consigne du devoir (l'apprenant répond par écrit, tu corriges depuis « Suivi des apprenants »)…" : type === "quiz" ? "Introduction du quiz (facultatif)…" : "Contenu de la leçon (HTML ou texte brut)…")}
          className={`${inputCls} resize-none font-mono text-xs`}
        />
      )}
      {type === "video" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {VIDEO_TYPE_OPTS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setVideoType(id)}
                className="flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all"
                style={videoType === id
                  ? { borderColor: "#F5A62360", background: "#F5A62312", color: "#D4911A" }
                  : { borderColor: "#e5e7eb", background: "white", color: "#6b7280" }}
              >
                {tr(label)}
              </button>
            ))}
          </div>
          <input
            value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
            placeholder={videoType === "youtube" ? "https://youtube.com/watch?v=..." : videoType === "vimeo" ? "https://vimeo.com/..." : tr("URL directe ou src iframe")}
            className={inputCls}
          />
        </div>
      )}
      {type === "audio" && (
        <input
          value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)}
          placeholder={tr("URL du fichier audio (.mp3, .ogg…)")}
          className={inputCls}
        />
      )}

      {type === "quiz" && <QuizEditeur quiz={quiz} onChange={setQuiz} />}
      <RessourcesEditeur ressources={ressources} onChange={setRessources} />
      <ReglagesPedagogie valeur={peda} onChange={setPeda} candidats={autres.filter((a) => a.id !== leconId)} libellePrerequis="Leçons à terminer avant" />

      {/* Durée + Accès libre */}
      <div className="flex gap-3 items-center">
        <div className="flex items-center gap-1.5 flex-1">
          <Clock size={13} className="text-gray-400" />
          <input
            type="number" min={0} value={duree}
            onChange={(e) => setDuree(e.target.value)}
            placeholder={tr("Durée (sec)")}
            className="w-28 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 bg-white focus:outline-none"
          />
        </div>
        <button
          onClick={() => setGratuite(!gratuite)}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: gratuite ? "#16a34a" : "#9ca3af" }}
        >
          <Globe size={13} />
          {gratuite ? tr("Aperçu libre") : tr("Accès payant")}
        </button>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={sauvegarder} disabled={saving || !titre.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#F5A623] text-[#111111] text-xs font-medium hover:bg-[#D4911A] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {leconId ? tr("Enregistrer") : tr("Ajouter la leçon")}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white transition-colors">
          {tr("Annuler")}
        </button>
      </div>
    </div>
  );
}

// ─── Chapitre Row ─────────────────────────────────────────────────────────────

function ChapitreRow({
  chapitre,
  produitId,
  toutesLecons,
  autresChapitres,
  onUpdate,
  onDelete,
}: {
  chapitre: Chapitre;
  toutesLecons: { id: string; titre: string }[];
  autresChapitres: { id: string; titre: string }[];
  produitId: string;
  onUpdate: (c: Chapitre) => void;
  onDelete: (id: string) => void;
}) {
  const tr = useT();
  const [open,       setOpen]       = useState(false);
  const [editTitre,  setEditTitre]  = useState(false);
  const [titre,      setTitre]      = useState(chapitre.titre);
  const [ajoutLecon, setAjoutLecon] = useState(false);
  const [editLecon,  setEditLecon]  = useState<string | null>(null);
  const [lecons,     setLecons]     = useState<Lecon[]>(chapitre.lecons);
  const [reglages,   setReglages]   = useState(false);
  const [peda,       setPeda]       = useState<Pedagogie>({ statut: chapitre.statut ?? "publie", prerequis: chapitre.prerequis ?? [], dripJours: chapitre.dripJours ?? null, dripDate: chapitre.dripDate ?? null });

  const savePeda = async () => {
    const r = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...peda, dripDate: peda.dripDate ? new Date(peda.dripDate).toISOString() : null }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok) { onUpdate({ ...chapitre, ...d.chapitre, lecons }); setReglages(false); } else alert(tr(d.error) ?? tr("Erreur"));
  };

  const base = `/api/formations/${produitId}/chapitres/${chapitre.id}`;

  const saveTitre = async () => {
    if (!titre.trim()) return;
    const r = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titre }) });
    if (r.ok) { onUpdate({ ...chapitre, titre, lecons }); setEditTitre(false); }
  };

  const toggleActif = async () => {
    const r = await fetch(base, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !chapitre.actif }) });
    if (r.ok) onUpdate({ ...chapitre, actif: !chapitre.actif, lecons });
  };

  const deleteLecon = async (leconId: string) => {
    if (!confirm(tr("Supprimer cette leçon ?"))) return;
    const r = await fetch(`${base}/lecons/${leconId}`, { method: "DELETE" });
    if (r.ok) setLecons((prev) => prev.filter((l) => l.id !== leconId));
  };

  const toggleLeconActif = async (l: Lecon) => {
    const r = await fetch(`${base}/lecons/${l.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actif: !l.actif }) });
    if (r.ok) setLecons((prev) => prev.map((x) => x.id === l.id ? { ...x, actif: !l.actif } : x));
  };

  const typeIcon = (t: string) => {
    if (t === "video") return <Video size={11} className="text-[#F5A623]" />;
    if (t === "audio") return <Music size={11} className="text-[#db2777]" />;
    if (t === "quiz") return <HelpCircle size={11} className="text-[#7c3aed]" />;
    if (t === "devoir") return <PenLine size={11} className="text-[#0891b2]" />;
    return <FileText size={11} className="text-[#111111]" />;
  };

  return (
    <div className={`rounded-xl border ${chapitre.actif ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 dark:bg-gray-800/30 opacity-70"} overflow-hidden`}>
      {/* Header chapitre */}
      <div className="flex items-center gap-2 px-4 py-3">
        <GripVertical size={14} className="text-gray-300 flex-shrink-0 cursor-grab" />
        <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          {open ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
          {editTitre ? (
            <input
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveTitre()}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-2 py-0.5 rounded border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#F5A623]"
              autoFocus
            />
          ) : (
            <span className="text-sm font-semibold text-gray-900 truncate">{tr(chapitre.titre)}</span>
          )}
          <span className="text-[10px] text-gray-400 flex-shrink-0">{lecons.length}{" "}{tr("leçon")}{lecons.length !== 1 ? "s" : ""}</span>
          {chapitre.statut && chapitre.statut !== "publie" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 flex-shrink-0">{tr(chapitre.statut === "brouillon" ? "Brouillon" : "Archivé")}</span>}
          {(chapitre.dripJours || chapitre.dripDate || chapitre.prerequis?.length) ? <Lock size={11} className="text-gray-400 flex-shrink-0" /> : null}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {editTitre ? (
            <>
              <button onClick={saveTitre} className="p-1 rounded text-green-600 hover:bg-green-50"><Check size={13} /></button>
              <button onClick={() => { setEditTitre(false); setTitre(chapitre.titre); }} className="p-1 rounded text-gray-400 hover:bg-gray-100"><X size={13} /></button>
            </>
          ) : (
            <button onClick={() => setEditTitre(true)} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Edit2 size={13} /></button>
          )}
          <button onClick={() => setReglages((v) => !v)} title={tr("Statut, prérequis, ouverture progressive")} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"><Clock size={13} /></button>
          <button onClick={toggleActif} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            {chapitre.actif ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={() => { if (confirm(tr("Supprimer ce chapitre et ses leçons ?"))) onDelete(chapitre.id); }} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {reglages && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-2">
          <ReglagesPedagogie valeur={peda} onChange={setPeda} candidats={autresChapitres} libellePrerequis="Modules à terminer avant" />
          <button onClick={savePeda} className="px-3 py-1.5 rounded-lg bg-[#F5A623] text-[#111111] text-xs font-medium">{tr("Enregistrer")}</button>
        </div>
      )}

      {/* Leçons */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3 space-y-2">
          {lecons.map((l) => (
            <div key={l.id}>
              {editLecon === l.id ? (
                <LeconForm
                  initial={l} produitId={produitId} chapitreId={chapitre.id} leconId={l.id} autres={toutesLecons}
                  onSave={(updated) => { setLecons((prev) => prev.map((x) => x.id === l.id ? updated : x)); setEditLecon(null); }}
                  onCancel={() => setEditLecon(null)}
                />
              ) : (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${l.actif ? "border-gray-100 bg-gray-50 dark:bg-gray-800/30" : "border-gray-100 bg-gray-50 opacity-50"} group`}>
                  <GripVertical size={12} className="text-gray-300 cursor-grab" />
                  {typeIcon(l.type)}
                  <span className="flex-1 text-xs text-gray-700 truncate">{tr(l.titre)}</span>
                  {l.statut && l.statut !== "publie" && <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">{tr(l.statut === "brouillon" ? "Brouillon" : "Archivé")}</span>}
                  {(l.dripJours || l.dripDate || l.prerequis?.length) ? <Lock size={10} className="text-gray-400 flex-shrink-0" /> : null}
                  {l.ressources?.length ? <Paperclip size={10} className="text-gray-400 flex-shrink-0" /> : null}
                  {l.gratuite && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium flex-shrink-0">{tr("Aperçu")}</span>}
                  {l.duree && <span className="text-[10px] text-gray-400 flex-shrink-0">{tr(dureeLabel(l.duree))}</span>}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => setEditLecon(l.id)} className="p-1 rounded hover:bg-white text-gray-400 hover:text-gray-700"><Edit2 size={11} /></button>
                    <button onClick={() => toggleLeconActif(l)} className="p-1 rounded hover:bg-white text-gray-400 hover:text-gray-700">{l.actif ? <Eye size={11} /> : <EyeOff size={11} />}</button>
                    <button onClick={() => deleteLecon(l.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {ajoutLecon ? (
            <LeconForm
              initial={{}} produitId={produitId} chapitreId={chapitre.id} autres={toutesLecons}
              onSave={(l) => { setLecons((prev) => [...prev, l]); setAjoutLecon(false); }}
              onCancel={() => setAjoutLecon(false)}
            />
          ) : (
            <button
              onClick={() => setAjoutLecon(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 hover:text-[#D4911A] hover:border-[#F5A623]/40 transition-colors"
            >
              <Plus size={12} />{" "}{tr("Ajouter une leçon")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FormationManager({ produitId }: { produitId: string }) {
  const tr = useT();
  const [chapitres, setChapitres] = useState<Chapitre[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [ajoutOpen, setAjoutOpen] = useState(false);
  const [newTitre,  setNewTitre]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [criteres,  setCriteres]  = useState<{ certif: boolean; certifLeconsPct: number; certifQuizRequis: boolean; certifDevoirsRequis: boolean } | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/formations/${produitId}/chapitres`);
    if (r.ok) {
      const d = await r.json();
      setChapitres(d.chapitres);
      const f = d.formation;
      setCriteres({ certif: f.certif, certifLeconsPct: f.certifLeconsPct ?? 100, certifQuizRequis: f.certifQuizRequis ?? true, certifDevoirsRequis: f.certifDevoirsRequis ?? true });
    }
    setLoading(false);
  }, [produitId]);

  useEffect(() => { charger(); }, [charger]);

  const ajouterChapitre = async () => {
    if (!newTitre.trim()) return;
    setSaving(true);
    const r = await fetch(`/api/formations/${produitId}/chapitres`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titre: newTitre }),
    });
    const d = await r.json();
    setSaving(false);
    if (r.ok) { setChapitres((prev) => [...prev, { ...d.chapitre, lecons: [] }]); setNewTitre(""); setAjoutOpen(false); }
    else alert(tr(d.error) ?? tr("Erreur"));
  };

  const deleteChapitre = async (id: string) => {
    const r = await fetch(`/api/formations/${produitId}/chapitres/${id}`, { method: "DELETE" });
    if (r.ok) setChapitres((prev) => prev.filter((c) => c.id !== id));
  };

  const totalLecons = chapitres.reduce((s, c) => s + (c.lecons?.length ?? 0), 0);
  // Tous les titres, pour choisir les prérequis (les leçons ajoutées depuis restent au prochain chargement).
  const toutesLecons = chapitres.flatMap((c) => (c.lecons ?? []).map((l) => ({ id: l.id, titre: `${c.titre} › ${l.titre}` })));

  const majCriteres = async (maj: Partial<NonNullable<typeof criteres>>) => {
    if (!criteres) return;
    const suivant = { ...criteres, ...maj };
    setCriteres(suivant);
    const r = await fetch(`/api/formations/${produitId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(maj) });
    if (!r.ok) { setCriteres(criteres); alert(tr("Réglage non enregistré")); }
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[#F5A623]" />
          <span className="font-semibold text-sm text-gray-900 dark:text-white">{tr("Contenu de la formation")}</span>
          {!loading && (
            <span className="text-xs text-gray-400">
              {chapitres.length} chapitre{chapitres.length !== 1 ? "s" : ""} · {tr(totalLecons)}{" "}{tr("leçon")}{totalLecons !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={() => setAjoutOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F5A623] text-[#111111] hover:bg-[#D4911A] transition-colors"
        >
          <Plus size={12} />{" "}{tr("Chapitre")}
        </button>
      </div>

      {/* Suivi + attestation */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 text-xs">
        <Link href={`/dashboard/produits/${produitId}/apprenants`} className="flex items-center gap-1.5 font-medium text-[#B45309] hover:underline"><Users size={13} />{" "}{tr("Suivi des apprenants, devoirs et statistiques")}</Link>
        {criteres && (
          <div className="flex flex-wrap items-center gap-3 ml-auto text-gray-600">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={criteres.certif} onChange={(e) => majCriteres({ certif: e.target.checked })} /><Award size={12} className="text-[#F5A623]" />{tr("Attestation automatique")}</label>
            {criteres.certif && (
              <>
                <label className="flex items-center gap-1">{tr("Leçons terminées")}<input type="number" min={0} max={100} defaultValue={criteres.certifLeconsPct} onBlur={(e) => majCriteres({ certifLeconsPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="w-14 px-1.5 py-0.5 rounded border border-gray-200" />%</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={criteres.certifQuizRequis} onChange={(e) => majCriteres({ certifQuizRequis: e.target.checked })} />{tr("Quiz réussis")}</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={criteres.certifDevoirsRequis} onChange={(e) => majCriteres({ certifDevoirsRequis: e.target.checked })} />{tr("Devoirs validés")}</label>
              </>
            )}
          </div>
        )}
      </div>

      {/* Formulaire nouveau chapitre */}
      {ajoutOpen && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-[#F5A623]/8">
          <input
            value={newTitre} onChange={(e) => setNewTitre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ajouterChapitre()}
            placeholder={tr("Titre du chapitre…")}
            autoFocus
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40"
          />
          <button onClick={ajouterChapitre} disabled={saving || !newTitre.trim()} className="px-3 py-2 rounded-lg bg-[#F5A623] text-[#111111] text-xs font-medium disabled:opacity-50 hover:bg-[#D4911A] transition-colors">
            {saving ? <Loader2 size={13} className="animate-spin" /> : tr("Ajouter")}
          </button>
          <button onClick={() => { setAjoutOpen(false); setNewTitre(""); }} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-500 hover:text-gray-700 transition-colors">
            {tr("Annuler")}
          </button>
        </div>
      )}

      {/* Liste chapitres */}
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">
          <Loader2 size={20} className="animate-spin mx-auto mb-2 text-gray-300" />
          {tr("Chargement…")}
        </div>
      ) : chapitres.length === 0 ? (
        <div className="py-12 text-center">
          <BookOpen size={32} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
          <p className="text-sm text-gray-400 mb-1">{tr("Aucun chapitre encore")}</p>
          <p className="text-xs text-gray-300">{tr("Cliquez sur \"Chapitre\" pour commencer à structurer votre formation.")}</p>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {chapitres.map((c) => (
            <ChapitreRow
              key={c.id}
              chapitre={c}
              produitId={produitId}
              toutesLecons={toutesLecons}
              autresChapitres={chapitres.filter((x) => x.id !== c.id).map((x) => ({ id: x.id, titre: x.titre }))}
              onUpdate={(updated) => setChapitres((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              onDelete={deleteChapitre}
            />
          ))}
        </div>
      )}
    </div>
  );
}
