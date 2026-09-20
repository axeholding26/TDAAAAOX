"use client";
import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Plus, ChevronDown, ChevronRight, Trash2, Edit2,
  Video, FileText, Music, Eye, EyeOff, GripVertical, Check, X,
  Loader2, Clock, Globe,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Lecon = {
  id: string;
  titre: string;
  type: "texte" | "video" | "audio";
  videoType: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  contenu: string | null;
  duree: number | null;
  gratuite: boolean;
  actif: boolean;
  ordre: number;
};

type Chapitre = {
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
] as const;

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
  onSave,
  onCancel,
}: {
  initial: Partial<Lecon>;
  produitId: string;
  chapitreId: string;
  leconId?: string;
  onSave: (l: Lecon) => void;
  onCancel: () => void;
}) {
  const [titre,     setTitre]     = useState(initial.titre ?? "");
  const [type,      setType]      = useState<"texte"|"video"|"audio">(initial.type ?? "texte");
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
    const body = { titre, type, videoType, videoUrl, audioUrl, contenu, duree: duree || null, gratuite };
    const r = leconId
      ? await fetch(`${base}/${leconId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    setSaving(false);
    if (r.ok) onSave(d.lecon);
    else alert(d.error ?? "Erreur");
  };

  const inputCls = "w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40";

  return (
    <div className="bg-[#F5A623]/8 border border-[#F5A623]/25 rounded-xl p-4 space-y-3">
      <input
        value={titre} onChange={(e) => setTitre(e.target.value)}
        placeholder="Titre de la leçon *"
        className={inputCls}
      />

      {/* Type */}
      <div className="flex gap-2">
        {TYPE_LECON.map(({ id, label, icon: Ic, color }) => (
          <button
            key={id}
            onClick={() => setType(id as any)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all"
            style={type === id
              ? { borderColor: color + "60", background: color + "12", color }
              : { borderColor: "#e5e7eb", background: "white", color: "#6b7280" }}
          >
            <Ic size={12} /> {label}
          </button>
        ))}
      </div>

      {/* Contenu selon type */}
      {type === "texte" && (
        <textarea
          value={contenu} onChange={(e) => setContenu(e.target.value)}
          rows={4} placeholder="Contenu de la leçon (HTML ou texte brut)…"
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
                {label}
              </button>
            ))}
          </div>
          <input
            value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
            placeholder={videoType === "youtube" ? "https://youtube.com/watch?v=..." : videoType === "vimeo" ? "https://vimeo.com/..." : "URL directe ou src iframe"}
            className={inputCls}
          />
        </div>
      )}
      {type === "audio" && (
        <input
          value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)}
          placeholder="URL du fichier audio (.mp3, .ogg…)"
          className={inputCls}
        />
      )}

      {/* Durée + Accès libre */}
      <div className="flex gap-3 items-center">
        <div className="flex items-center gap-1.5 flex-1">
          <Clock size={13} className="text-gray-400" />
          <input
            type="number" min={0} value={duree}
            onChange={(e) => setDuree(e.target.value)}
            placeholder="Durée (sec)"
            className="w-28 px-2 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-900 bg-white focus:outline-none"
          />
        </div>
        <button
          onClick={() => setGratuite(!gratuite)}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: gratuite ? "#16a34a" : "#9ca3af" }}
        >
          <Globe size={13} />
          {gratuite ? "Aperçu libre" : "Accès payant"}
        </button>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={sauvegarder} disabled={saving || !titre.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#F5A623] text-[#111111] text-xs font-medium hover:bg-[#D4911A] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {leconId ? "Enregistrer" : "Ajouter la leçon"}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700 border border-gray-200 bg-white transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
}

// ─── Chapitre Row ─────────────────────────────────────────────────────────────

function ChapitreRow({
  chapitre,
  produitId,
  onUpdate,
  onDelete,
}: {
  chapitre: Chapitre;
  produitId: string;
  onUpdate: (c: Chapitre) => void;
  onDelete: (id: string) => void;
}) {
  const [open,       setOpen]       = useState(false);
  const [editTitre,  setEditTitre]  = useState(false);
  const [titre,      setTitre]      = useState(chapitre.titre);
  const [ajoutLecon, setAjoutLecon] = useState(false);
  const [editLecon,  setEditLecon]  = useState<string | null>(null);
  const [lecons,     setLecons]     = useState<Lecon[]>(chapitre.lecons);

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
    if (!confirm("Supprimer cette leçon ?")) return;
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
            <span className="text-sm font-semibold text-gray-900 truncate">{chapitre.titre}</span>
          )}
          <span className="text-[10px] text-gray-400 flex-shrink-0">{lecons.length} leçon{lecons.length !== 1 ? "s" : ""}</span>
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
          <button onClick={toggleActif} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100">
            {chapitre.actif ? <Eye size={13} /> : <EyeOff size={13} />}
          </button>
          <button onClick={() => { if (confirm("Supprimer ce chapitre et ses leçons ?")) onDelete(chapitre.id); }} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Leçons */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-4 pt-3 space-y-2">
          {lecons.map((l) => (
            <div key={l.id}>
              {editLecon === l.id ? (
                <LeconForm
                  initial={l} produitId={produitId} chapitreId={chapitre.id} leconId={l.id}
                  onSave={(updated) => { setLecons((prev) => prev.map((x) => x.id === l.id ? updated : x)); setEditLecon(null); }}
                  onCancel={() => setEditLecon(null)}
                />
              ) : (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${l.actif ? "border-gray-100 bg-gray-50 dark:bg-gray-800/30" : "border-gray-100 bg-gray-50 opacity-50"} group`}>
                  <GripVertical size={12} className="text-gray-300 cursor-grab" />
                  {typeIcon(l.type)}
                  <span className="flex-1 text-xs text-gray-700 truncate">{l.titre}</span>
                  {l.gratuite && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium flex-shrink-0">Aperçu</span>}
                  {l.duree && <span className="text-[10px] text-gray-400 flex-shrink-0">{dureeLabel(l.duree)}</span>}
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
              initial={{}} produitId={produitId} chapitreId={chapitre.id}
              onSave={(l) => { setLecons((prev) => [...prev, l]); setAjoutLecon(false); }}
              onCancel={() => setAjoutLecon(false)}
            />
          ) : (
            <button
              onClick={() => setAjoutLecon(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 hover:text-[#D4911A] hover:border-[#F5A623]/40 transition-colors"
            >
              <Plus size={12} /> Ajouter une leçon
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FormationManager({ produitId }: { produitId: string }) {
  const [chapitres, setChapitres] = useState<Chapitre[]>([]);
  const [formation, setFormation] = useState<any>(null);
  const [loading,   setLoading]   = useState(true);
  const [ajoutOpen, setAjoutOpen] = useState(false);
  const [newTitre,  setNewTitre]  = useState("");
  const [saving,    setSaving]    = useState(false);

  const charger = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/formations/${produitId}/chapitres`);
    if (r.ok) { const d = await r.json(); setChapitres(d.chapitres); setFormation(d.formation); }
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
    else alert(d.error ?? "Erreur");
  };

  const deleteChapitre = async (id: string) => {
    const r = await fetch(`/api/formations/${produitId}/chapitres/${id}`, { method: "DELETE" });
    if (r.ok) setChapitres((prev) => prev.filter((c) => c.id !== id));
  };

  const totalLecons = chapitres.reduce((s, c) => s + (c.lecons?.length ?? 0), 0);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[#F5A623]" />
          <span className="font-semibold text-sm text-gray-900 dark:text-white">Contenu de la formation</span>
          {!loading && (
            <span className="text-xs text-gray-400">
              {chapitres.length} chapitre{chapitres.length !== 1 ? "s" : ""} · {totalLecons} leçon{totalLecons !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={() => setAjoutOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F5A623] text-[#111111] hover:bg-[#D4911A] transition-colors"
        >
          <Plus size={12} /> Chapitre
        </button>
      </div>

      {/* Formulaire nouveau chapitre */}
      {ajoutOpen && (
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-[#F5A623]/8">
          <input
            value={newTitre} onChange={(e) => setNewTitre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ajouterChapitre()}
            placeholder="Titre du chapitre…"
            autoFocus
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/40"
          />
          <button onClick={ajouterChapitre} disabled={saving || !newTitre.trim()} className="px-3 py-2 rounded-lg bg-[#F5A623] text-[#111111] text-xs font-medium disabled:opacity-50 hover:bg-[#D4911A] transition-colors">
            {saving ? <Loader2 size={13} className="animate-spin" /> : "Ajouter"}
          </button>
          <button onClick={() => { setAjoutOpen(false); setNewTitre(""); }} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-xs text-gray-500 hover:text-gray-700 transition-colors">
            Annuler
          </button>
        </div>
      )}

      {/* Liste chapitres */}
      {loading ? (
        <div className="py-10 text-center text-sm text-gray-400">
          <Loader2 size={20} className="animate-spin mx-auto mb-2 text-gray-300" />
          Chargement…
        </div>
      ) : chapitres.length === 0 ? (
        <div className="py-12 text-center">
          <BookOpen size={32} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
          <p className="text-sm text-gray-400 mb-1">Aucun chapitre encore</p>
          <p className="text-xs text-gray-300">Cliquez sur "Chapitre" pour commencer à structurer votre formation.</p>
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {chapitres.map((c) => (
            <ChapitreRow
              key={c.id}
              chapitre={c}
              produitId={produitId}
              onUpdate={(updated) => setChapitres((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
              onDelete={deleteChapitre}
            />
          ))}
        </div>
      )}
    </div>
  );
}
