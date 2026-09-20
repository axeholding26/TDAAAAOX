"use client";
import { useState, useRef, useEffect } from "react";
import {
  Video, Mic, FileText, Zap, Loader2, Play, Download,
  Pause, RefreshCw, Sparkles, ChevronDown, Copy, Check,
  Film, Volume2, Camera, Share2, BookOpen, Package, Megaphone
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────
type TabId = "video" | "voix" | "script" | "ugc";

const TABS: { id: TabId; icon: any; label: string; desc: string }[] = [
  { id: "video",  icon: Film,     label: "Vidéo IA",   desc: "Génère des vidéos produit en quelques secondes" },
  { id: "voix",   icon: Mic,      label: "Voix off IA", desc: "Voix professionnelle pour vos contenus" },
  { id: "script", icon: FileText, label: "Scripts",    desc: "Scripts pub, démo, email et plus" },
  { id: "ugc",    icon: Sparkles, label: "UGC & Ads",  desc: "Contenu authentique style créateur" },
];

const VIDEO_STYLES = [
  { id: "product", label: "Produit", Icon: Package,  desc: "Fond blanc, studio pro" },
  { id: "ugc",     label: "UGC",    Icon: Camera,   desc: "Style créateur authentique" },
  { id: "ad",      label: "Pub",    Icon: Megaphone,desc: "Dynamique, conversion" },
  { id: "demo",    label: "Démo",   Icon: Film,     desc: "Démonstration produit" },
];

const SCRIPT_TYPES = [
  { id: "pub_30s",    label: "Pub 30s",       plateformes: ["instagram", "tiktok"] },
  { id: "pub_15s",    label: "Pub 15s",       plateformes: ["instagram", "tiktok"] },
  { id: "ugc_60s",    label: "UGC 60s",       plateformes: ["tiktok", "youtube"] },
  { id: "demo_produit", label: "Démo produit", plateformes: ["facebook", "youtube"] },
  { id: "email_vente",  label: "Email vente",  plateformes: ["email"] },
  { id: "description",  label: "Description",  plateformes: ["boutique"] },
];

// ─── Tab Vidéo IA ─────────────────────────────────────────────────
function TabVideo() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("product");
  const [duree, setDuree] = useState<"5s"|"10s">("5s");
  const [ratio, setRatio] = useState<"16:9"|"9:16"|"1:1">("16:9");
  const [generating, setGenerating] = useState(false);
  const [videoId, setVideoId] = useState<string|null>(null);
  const [video, setVideo] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const pollStatus = (id: string) => {
    intervalRef.current = setInterval(async () => {
      const res = await fetch(`/api/ai/video?videoId=${id}`);
      const data = await res.json();
      if (data.progress) setProgress(Math.round(data.progress * 100));
      if (data.statut === "pret") {
        setVideo(data);
        setProgress(100);
        clearInterval(intervalRef.current);
        toast.success("Vidéo générée !");
      } else if (data.statut === "erreur") {
        toast.error(data.erreur || "Erreur génération");
        setGenerating(false);
        clearInterval(intervalRef.current);
      }
    }, 4000);
  };

  useEffect(() => () => clearInterval(intervalRef.current), []);

  async function generer() {
    if (!prompt.trim()) { toast.error("Décrivez votre vidéo"); return; }
    setGenerating(true);
    setVideo(null);
    setProgress(5);
    try {
      const res = await fetch("/api/ai/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, duree, ratio }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) {
          toast.error(data.message);
          window.open(data.signup, "_blank");
        } else {
          toast.error(data.message || "Erreur");
        }
        setGenerating(false);
        return;
      }
      setVideoId(data.videoId);
      pollStatus(data.videoId);
    } catch { toast.error("Erreur réseau"); setGenerating(false); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Config */}
      <div className="space-y-5">
        <div>
          <label className="text-gray-600 text-sm font-medium block mb-2">Décrivez votre vidéo</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
            placeholder="Ex: Sac à main en cuir marron pour femme, montrez les détails du cuir, les coutures et la fermeture dorée..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50 resize-none" />
        </div>

        <div>
          <label className="text-gray-600 text-sm font-medium block mb-2">Style</label>
          <div className="grid grid-cols-2 gap-2">
            {VIDEO_STYLES.map(s => (
              <button key={s.id} onClick={() => setStyle(s.id)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${style === s.id ? "border-[#F5A623]/50 bg-[#F5A623]/8" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                <s.Icon size={20} className={style === s.id ? "text-[#F5A623]" : "text-gray-400"} />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{s.label}</p>
                  <p className="text-[11px] text-gray-400">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-gray-600 text-sm font-medium block mb-2">Durée</label>
            <div className="flex gap-2">
              {(["5s", "10s"] as const).map(d => (
                <button key={d} onClick={() => setDuree(d)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${duree === d ? "bg-[#F5A623] text-white border-[#F5A623]" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-gray-600 text-sm font-medium block mb-2">Format</label>
            <div className="flex gap-2">
              {(["16:9", "9:16", "1:1"] as const).map(r => (
                <button key={r} onClick={() => setRatio(r)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${ratio === r ? "bg-[#F5A623] text-white border-[#F5A623]" : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button onClick={generer} disabled={generating || !prompt.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #F5A623, #e8950f)", color: "white", boxShadow: "0 4px 20px rgba(245,166,35,0.3)" }}>
          {generating ? <><Loader2 size={16} className="animate-spin" /> Génération en cours…</> : <><Film size={16} /> Générer la vidéo</>}
        </button>

        <p className="text-center text-xs text-gray-400">
          Génération vidéo IA haute définition
        </p>
      </div>

      {/* Preview */}
      <div className="flex flex-col">
        <div className="aspect-video bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center relative">
          {!generating && !video && (
            <div className="text-center">
              <Film size={40} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Votre vidéo apparaîtra ici</p>
            </div>
          )}
          {generating && !video && (
            <div className="text-center space-y-4 px-8 w-full">
              <Loader2 size={40} className="text-[#F5A623] animate-spin mx-auto" />
              <div>
                <p className="text-white text-sm font-medium mb-2">Génération en cours…</p>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, background: "linear-gradient(90deg, #F5A623, #FFD280)" }} />
                </div>
                <p className="text-gray-400 text-xs mt-2">{progress}% · ~30-60 secondes</p>
              </div>
            </div>
          )}
          {video?.videoUrl && (
            <video src={video.videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
          )}
        </div>

        {video?.videoUrl && (
          <div className="mt-4 flex gap-3">
            <a href={video.videoUrl} download target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#F5A623] text-white rounded-xl text-sm font-semibold hover:bg-[#e8950f] transition-all">
              <Download size={14} /> Télécharger
            </a>
            <button onClick={() => { setVideo(null); setVideoId(null); setGenerating(false); setProgress(0); }}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition-all">
              <RefreshCw size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Voix Off ─────────────────────────────────────────────────
function TabVoixOff() {
  const [texte, setTexte] = useState("");
  const [voixId, setVoixId] = useState("Kore");
  const [voix, setVoix] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string|null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch("/api/ai/voix-off").then(r => r.json()).then(d => setVoix(d.voix || []));
  }, []);

  async function generer() {
    if (!texte.trim()) { toast.error("Entrez du texte"); return; }
    setGenerating(true);
    setAudioUrl(null);
    try {
      const res = await fetch("/api/ai/voix-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte, voixId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) { toast.error(data.message); window.open(data.signup, "_blank"); }
        else toast.error(data.message);
        return;
      }
      setAudioUrl(data.audioUrl);
      toast.success("Voix générée !");
    } catch { toast.error("Erreur réseau"); }
    finally { setGenerating(false); }
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-gray-600 text-sm font-medium">Texte à vocaliser</label>
            <span className="text-xs text-gray-400">{texte.length}/5000 caractères</span>
          </div>
          <textarea value={texte} onChange={e => setTexte(e.target.value)} rows={6}
            placeholder="Ex: Découvrez notre nouvelle collection de sacs en cuir artisanal. Qualité premium, livraison rapide dans toute l'Afrique de l'Ouest..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50 resize-none" />
        </div>

        <div>
          <label className="text-gray-600 text-sm font-medium block mb-2">Voix</label>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {voix.map(v => (
              <button key={v.id} onClick={() => setVoixId(v.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${voixId === v.id ? "border-[#F5A623]/50 bg-[#F5A623]/8" : "border-gray-100 bg-white hover:border-gray-200"}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-[#F5A623] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {v.nom[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{v.nom}</p>
                  <p className="text-xs text-gray-400">{v.style} · {v.genre === "F" ? "Féminin" : "Masculin"}</p>
                </div>
                {voixId === v.id && <span className="text-[#F5A623] text-xs font-bold">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <button onClick={generer} disabled={generating || !texte.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #1B2A4A, #3a5480)", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}>
          {generating ? <><Loader2 size={16} className="animate-spin" /> Génération…</> : <><Volume2 size={16} /> Générer la voix</>}
        </button>
        <p className="text-center text-xs text-gray-400">
          Synthèse vocale IA multilingue
        </p>
      </div>

      <div className="flex flex-col items-center justify-center">
        <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center min-h-48 gap-4">
          {!audioUrl && !generating && (
            <div className="text-center">
              <Mic size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Votre audio apparaîtra ici</p>
            </div>
          )}
          {generating && (
            <div className="text-center">
              <Loader2 size={36} className="text-[#F5A623] animate-spin mx-auto" />
              <p className="text-gray-500 text-sm mt-3">Synthèse vocale en cours…</p>
            </div>
          )}
          {audioUrl && (
            <div className="w-full space-y-4">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white flex-shrink-0 transition-all hover:scale-110"
                  style={{ background: "linear-gradient(135deg, #1B2A4A, #3a5480)", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}>
                  {playing ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <div className="flex-1">
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full w-1/3 transition-all" />
                  </div>
                </div>
                <a href={audioUrl} download="voix-off.wav"
                  className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-all">
                  <Download size={14} />
                </a>
              </div>
              <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
              <p className="text-xs text-gray-400 text-center">Cliquez sur ▶ pour écouter · Icône ↓ pour télécharger</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Scripts ──────────────────────────────────────────────────
function TabScript() {
  const [type, setType] = useState(SCRIPT_TYPES[0].id);
  const [produit, setProduit] = useState("");
  const [cible, setCible] = useState("");
  const [generating, setGenerating] = useState(false);
  const [script, setScript] = useState("");
  const [copied, setCopied] = useState(false);

  async function genererScript() {
    if (!produit.trim()) { toast.error("Décrivez votre produit"); return; }
    setGenerating(true);
    setScript("");
    const typeInfo = SCRIPT_TYPES.find(t => t.id === type);
    try {
      const res = await fetch("/api/ai/universal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Écris un script ${typeInfo?.label} professionnel pour ce produit :
Produit: ${produit}
Cible: ${cible || "entrepreneurs africains 25-45 ans"}
Type: ${type}

Le script doit être:
- Adapté au marché africain francophone
- Avec un hook fort au début
- CTA clair à la fin
- Formaté avec [Scène 1], [Voix], [Texte écran] si pertinent
- En français naturel et engageant

Réponds UNIQUEMENT avec le script, aucun commentaire avant/après.`,
          }],
        }),
      });
      const data = await res.json();
      setScript(data.reponse || "");
    } catch { toast.error("Erreur IA"); }
    finally { setGenerating(false); }
  }

  function copier() {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Script copié !");
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div>
          <label className="text-gray-600 text-sm font-medium block mb-2">Type de contenu</label>
          <div className="grid grid-cols-2 gap-2">
            {SCRIPT_TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                className={`p-3 rounded-xl border text-left transition-all ${type === t.id ? "border-[#F5A623]/50 bg-[#F5A623]/8" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                <p className="text-sm font-semibold text-gray-800">{t.label}</p>
                <div className="flex gap-1 mt-1">
                  {t.plateformes.map(p => (
                    <span key={p} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{p}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-gray-600 text-sm font-medium block mb-2">Produit / Service</label>
          <textarea value={produit} onChange={e => setProduit(e.target.value)} rows={3}
            placeholder="Ex: Crème hydratante au karité naturel, 150ml, prix 8000 FCFA..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50 resize-none" />
        </div>
        <div>
          <label className="text-gray-600 text-sm font-medium block mb-2">Cible (optionnel)</label>
          <input value={cible} onChange={e => setCible(e.target.value)}
            placeholder="Ex: Femmes 25-40 ans, Dakar et Abidjan..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50" />
        </div>
        <button onClick={genererScript} disabled={generating || !produit.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #F5A623, #e8950f)" }}>
          {generating ? <><Loader2 size={16} className="animate-spin" /> Écriture…</> : <><Zap size={16} /> Générer le script</>}
        </button>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <label className="text-gray-600 text-sm font-medium">Script généré</label>
          {script && (
            <button onClick={copier}
              className="flex items-center gap-1.5 text-xs text-[#F5A623] bg-[#F5A623]/10 px-3 py-1.5 rounded-lg border border-[#F5A623]/20 hover:bg-[#F5A623]/20 transition-all">
              {copied ? <><Check size={11} /> Copié !</> : <><Copy size={11} /> Copier</>}
            </button>
          )}
        </div>
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-80 overflow-y-auto">
          {generating ? (
            <div className="flex items-center gap-3 text-gray-400 text-sm">
              <Loader2 size={18} className="text-[#F5A623] animate-spin flex-shrink-0" />
              <span>Génération du script…</span>
            </div>
          ) : script ? (
            <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-sans">{script}</pre>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <BookOpen size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Votre script apparaîtra ici</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab UGC & Ads ────────────────────────────────────────────────
function TabUGC() {
  const [platform, setPlatform] = useState("instagram");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{post: string; hashtags: string[]; imageUrl?: string} | null>(null);
  const [copied, setCopied] = useState(false);

  const PLATFORMS = [
    { id: "instagram", icon: Camera, label: "Instagram", color: "#E1306C" },
    { id: "facebook", icon: Share2, label: "Facebook", color: "#1877F2" },
    { id: "tiktok", icon: Film, label: "TikTok", color: "#000000" },
    { id: "whatsapp", icon: Volume2, label: "WhatsApp", color: "#25D366" },
  ];

  async function generer() {
    if (!prompt.trim()) { toast.error("Décrivez ce que vous voulez promouvoir"); return; }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/ai/universal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Génère un post ${platform} ultra-engageant pour : "${prompt}".
Réponds en JSON :
{
  "post": "contenu complet du post avec emojis",
  "hashtags": ["tag1", "tag2", ...10 hashtags],
  "conseil": "conseil pour maximiser l'engagement sur ${platform}"
}
Adapté au marché africain francophone. Style authentique et engageant. Réponds UNIQUEMENT en JSON.`,
          }],
        }),
      });
      const data = await res.json();
      const jsonMatch = (data.reponse || "").match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Générer une image pour le post
        const imagePrompt = `${prompt}, social media post visual, ${platform} style, vibrant African aesthetic, professional`;
        const encoded = encodeURIComponent(imagePrompt);
        const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1080&height=1080&nologo=true&model=flux&seed=${Math.floor(Math.random()*999999)}`;
        setResult({ ...parsed, imageUrl });
      }
    } catch { toast.error("Erreur IA"); }
    finally { setGenerating(false); }
  }

  function copier() {
    if (!result) return;
    navigator.clipboard.writeText(`${result.post}\n\n${result.hashtags.map(h => `#${h}`).join(" ")}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Post copié !");
  }

  const platInfo = PLATFORMS.find(p => p.id === platform);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="space-y-5">
        <div>
          <label className="text-gray-600 text-sm font-medium block mb-2">Plateforme</label>
          <div className="grid grid-cols-4 gap-2">
            {PLATFORMS.map(p => {
              const Icone = p.icon;
              return (
                <button key={p.id} onClick={() => setPlatform(p.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${platform === p.id ? "border-2" : "border-gray-200"}`}
                  style={platform === p.id ? { borderColor: p.color, background: p.color + "10" } : {}}>
                  <Icone size={20} style={{ color: platform === p.id ? p.color : "#9ca3af" }} />
                  <span className="text-[11px] font-medium" style={{ color: platform === p.id ? p.color : "#6b7280" }}>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-gray-600 text-sm font-medium block mb-2">Que voulez-vous promouvoir ?</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
            placeholder="Ex: Notre nouvelle collection de robes wax premium, disponible en 5 couleurs, livraison 24h à Dakar..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50 resize-none" />
        </div>

        <button onClick={generer} disabled={generating || !prompt.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
          style={platInfo ? { background: platInfo.color, boxShadow: `0 4px 20px ${platInfo.color}40` } : {}}>
          {generating ? <><Loader2 size={16} className="animate-spin" /> Création…</> : <><Sparkles size={16} /> Créer le post</>}
        </button>
      </div>

      <div className="space-y-4">
        {!result && !generating && (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-8 text-center">
            <Sparkles size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Votre post + visuel IA apparaîtront ici</p>
          </div>
        )}
        {generating && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 flex flex-col items-center gap-3">
            <Loader2 size={32} className="text-[#F5A623] animate-spin" />
            <p className="text-gray-500 text-sm">Génération du contenu…</p>
          </div>
        )}
        {result && (
          <div className="space-y-3">
            {result.imageUrl && (
              <img src={result.imageUrl} alt="Visuel généré" className="w-full aspect-square object-cover rounded-2xl" />
            )}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-sans">{result.post}</pre>
              <div className="flex flex-wrap gap-1">
                {result.hashtags?.map((h: string) => (
                  <span key={h} className="text-xs px-2 py-0.5 rounded-full" style={{ background: platInfo?.color + "12", color: platInfo?.color }}>#{h}</span>
                ))}
              </div>
              <button onClick={copier}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">
                {copied ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier le post</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────
export default function StudioPage() {
  const [tab, setTab] = useState<TabId>("video");

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F5A623] to-purple-600 flex items-center justify-center">
          <Film size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-poppins">Studio de Contenu IA</h1>
          <p className="text-gray-400 text-sm">Vidéos, voix off, scripts, posts — tout généré par l'IA</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        {TABS.map(t => {
          const Icone = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <Icone size={15} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 bg-white border border-gray-100 rounded-2xl p-6">
        {tab === "video"  && <TabVideo />}
        {tab === "voix"   && <TabVoixOff />}
        {tab === "script" && <TabScript />}
        {tab === "ugc"    && <TabUGC />}
      </div>
    </div>
  );
}
