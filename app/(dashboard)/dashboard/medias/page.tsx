"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Film, Image, Plus, Loader2, Trash2, Download, Copy,
  RefreshCw, Wand2, Play, CheckCircle2, XCircle, Clock, Sparkles, X
} from "lucide-react";

interface Media {
  id: string; prompt: string; style: string;
  videoUrl: string | null; thumbnailUrl: string | null;
  statut: "en_cours" | "pret" | "erreur"; erreur: string | null;
  createdAt: string;
}
interface Stats { total: number; pretes: number; enCours: number; erreurs: number }

const MODELES_VIDEO = [
  { id: "kling-3.0", label: "Kling 3.0", desc: "Haute qualité · 10s" },
  { id: "veo-3.1", label: "Veo 3.1", desc: "Google · Cinématique" },
  { id: "wan-2.5", label: "Wan 2.5", desc: "Rapide · Produit" },
];
const MODELES_IMAGE = [
  { id: "recraft-4.1", label: "Modèle HD", desc: "Photo produit ultra HD" },
  { id: "gpt-image", label: "Modèle Créatif", desc: "Créatif publicitaire" },
  { id: "seedream-4.0", label: "Modèle Artistique", desc: "Artistique · Lifestyle" },
];
const STYLES_VIDEO = ["product", "ugc", "ad", "cinematic", "demo"];
const STYLES_IMAGE = ["product_photo", "lifestyle", "advertisement", "minimal", "artistic"];

function StatutBadge({ statut }: { statut: string }) {
  if (statut === "pret") return <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium"><CheckCircle2 size={10}/> Prêt</span>;
  if (statut === "en_cours") return <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium"><Loader2 size={10} className="animate-spin"/> En cours</span>;
  return <span className="flex items-center gap-1 text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium"><XCircle size={10}/> Erreur</span>;
}

function MediaCard({ media, onDelete, onCopy }: { media: Media; onDelete: (id: string) => void; onCopy: (url: string) => void }) {
  const url = media.videoUrl ?? media.thumbnailUrl;
  const estVideo = !!media.videoUrl;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden group hover:shadow-lg transition-all">
      {/* Aperçu */}
      <div className="relative aspect-video bg-gray-50">
        {media.statut === "en_cours" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 size={28} className="text-[#F5A623] animate-spin"/>
            <p className="text-xs text-gray-400">Génération en cours…</p>
          </div>
        ) : media.statut === "erreur" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            <XCircle size={24} className="text-red-400"/>
            <p className="text-xs text-red-500 text-center line-clamp-2">{media.erreur ?? "Erreur de génération"}</p>
          </div>
        ) : url && estVideo ? (
          <video src={url} className="w-full h-full object-cover" muted loop/>
        ) : url ? (
          <img src={url} alt={media.prompt} className="w-full h-full object-cover"/>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Wand2 size={24} className="text-gray-300"/>
          </div>
        )}

        {/* Overlay actions */}
        {url && media.statut === "pret" && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            {estVideo && (
              <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all">
                <Play size={16} className="text-white ml-0.5"/>
              </button>
            )}
            <a href={url} download className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all">
              <Download size={16} className="text-white"/>
            </a>
            <button onClick={() => onCopy(url)} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-all">
              <Copy size={16} className="text-white"/>
            </button>
          </div>
        )}

        {/* Badge type */}
        <div className="absolute top-2 left-2">
          <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur-sm flex items-center gap-1">
            {estVideo ? <Film size={10}/> : <Image size={10}/>}
            {estVideo ? "Vidéo" : "Image"}
          </span>
        </div>
      </div>

      {/* Infos */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-xs text-gray-700 line-clamp-2 flex-1 leading-relaxed">{media.prompt}</p>
          <button onClick={() => onDelete(media.id)} className="w-6 h-6 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
            <Trash2 size={12}/>
          </button>
        </div>
        <div className="flex items-center justify-between">
          <StatutBadge statut={media.statut}/>
          <span className="text-[10px] text-gray-400">
            {new Date(media.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MediasPage() {
  const [medias, setMedias] = useState<Media[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pretes: 0, enCours: 0, erreurs: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"tous" | "video" | "image">("tous");
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Formulaire génération
  const [type, setType] = useState<"video" | "image">("image");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("recraft-4.1");
  const [style, setStyle] = useState("product_photo");
  const [generating, setGenerating] = useState(false);

  const charger = useCallback(async () => {
    try {
      const url = filter === "tous" ? "/api/medias" : `/api/medias?type=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setMedias(data.medias ?? []);
      setStats(data.stats ?? { total: 0, pretes: 0, enCours: 0, erreurs: 0 });
    } catch {}
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { charger(); }, [charger]);

  // Polling auto si des médias sont en cours
  useEffect(() => {
    if (!medias.some(m => m.statut === "en_cours")) return;
    const t = setInterval(charger, 5000);
    return () => clearInterval(t);
  }, [medias, charger]);

  // Changer modèle par défaut selon type
  useEffect(() => {
    setModel(type === "video" ? "kling-3.0" : "recraft-4.1");
    setStyle(type === "video" ? "product" : "product_photo");
  }, [type]);

  async function generer() {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      await fetch("/api/medias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, prompt, model, style }),
      });
      setShowModal(false);
      setPrompt("");
      await charger();
    } catch {}
    finally { setGenerating(false); }
  }

  async function supprimer(id: string) {
    await fetch(`/api/medias?id=${id}`, { method: "DELETE" });
    setMedias(ms => ms.filter(m => m.id !== id));
  }

  function copier(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Médiathèque IA</h1>
          <p className="text-gray-400 text-sm mt-0.5">Vidéos et images générées par IA</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={charger} className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-all">
            <RefreshCw size={15}/>
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm text-white transition-all"
            style={{ background: "linear-gradient(135deg, #F5A623, #e8950f)", boxShadow: "0 4px 16px rgba(245,166,35,0.3)" }}
          >
            <Wand2 size={14}/> Générer
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Sparkles, color: "#6366f1", bg: "#eef2ff" },
          { label: "Prêts", value: stats.pretes, icon: CheckCircle2, color: "#059669", bg: "#ecfdf5" },
          { label: "En cours", value: stats.enCours, icon: Clock, color: "#d97706", bg: "#fffbeb" },
          { label: "Erreurs", value: stats.erreurs, icon: XCircle, color: "#dc2626", bg: "#fef2f2" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: s.bg }}>
              <s.icon size={16} style={{ color: s.color }}/>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {(["tous", "image", "video"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all capitalize ${filter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"}`}
          >
            {f === "video" && <Film size={13}/>}
            {f === "image" && <Image size={13}/>}
            {f === "tous" ? "Tous les médias" : f === "video" ? "Vidéos" : "Images"}
          </button>
        ))}
      </div>

      {/* Grille médias */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="text-gray-300 animate-spin"/></div>
      ) : medias.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-16 text-center">
          <Wand2 size={40} className="mx-auto text-gray-300 mb-4"/>
          <h3 className="text-lg font-bold text-gray-700 mb-2">Médiathèque vide</h3>
          <p className="text-gray-400 text-sm mb-6">Générez des vidéos et images IA pour vos produits et campagnes</p>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm text-white mx-auto" style={{ background: "linear-gradient(135deg, #F5A623, #e8950f)" }}>
            <Sparkles size={14}/> Générer mon premier média
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {medias.map(m => (
            <MediaCard key={m.id} media={m} onDelete={supprimer} onCopy={copier}/>
          ))}
        </div>
      )}

      {/* Toast copié */}
      {copied && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 z-50">
          <CheckCircle2 size={14} className="text-green-400"/> URL copiée !
        </div>
      )}

      {/* ── Modal Génération ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Générer un média IA</h2>
                <p className="text-xs text-gray-400 mt-0.5">Higgsfield · Kling 3.0 · Recraft 4.1 · Veo 3.1</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-all">
                <X size={18}/>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Type */}
              <div className="grid grid-cols-2 gap-3">
                {(["image", "video"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-semibold text-sm transition-all ${type === t ? "border-[#F5A623] bg-amber-50 text-[#F5A623]" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                  >
                    {t === "image" ? <Image size={16}/> : <Film size={16}/>}
                    {t === "image" ? "Image" : "Vidéo"}
                  </button>
                ))}
              </div>

              {/* Prompt */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Décrivez ce que vous voulez générer *</label>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={type === "video"
                    ? "Ex: Sac à main en cuir marron, fond blanc, rotation 360°, lumière studio professionnelle…"
                    : "Ex: Photo produit robe wax premium sur fond blanc, ultra HD, éclairage professionnel…"}
                  rows={3}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-[#F5A623]/60 resize-none"
                />
              </div>

              {/* Modèle */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Modèle</label>
                <div className="space-y-1.5">
                  {(type === "video" ? MODELES_VIDEO : MODELES_IMAGE).map(m => (
                    <button
                      key={m.id}
                      onClick={() => setModel(m.id)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all text-sm ${model === m.id ? "border-[#F5A623] bg-amber-50" : "border-gray-100 hover:border-gray-200"}`}
                    >
                      <span className={`font-semibold ${model === m.id ? "text-[#e8950f]" : "text-gray-700"}`}>{m.label}</span>
                      <span className="text-xs text-gray-400">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style */}
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">Style</label>
                <div className="flex flex-wrap gap-2">
                  {(type === "video" ? STYLES_VIDEO : STYLES_IMAGE).map(s => (
                    <button
                      key={s}
                      onClick={() => setStyle(s)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all capitalize ${style === s ? "border-[#F5A623] bg-amber-50 text-[#e8950f]" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                    >
                      {s.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info Higgsfield requis */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 flex items-start gap-2">
                <Sparkles size={13} className="flex-shrink-0 mt-0.5"/>
                <span>Nécessite Higgsfield connecté dans <a href="/dashboard/connecteurs" className="font-bold underline">Connecteurs</a>. Sans connexion, une image placeholder sera générée.</span>
              </div>

              <button
                onClick={generer}
                disabled={generating || !prompt.trim()}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-sm transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #F5A623, #e8950f)" }}
              >
                {generating ? <><Loader2 size={14} className="animate-spin"/> Lancement…</> : <><Wand2 size={14}/> Générer {type === "video" ? "la vidéo" : "l'image"}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
