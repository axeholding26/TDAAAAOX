"use client";
import { useState, useEffect } from "react";
import {
  BotMessageSquare, Save, Loader2, CheckCircle2, Power,
  Clock, MessageSquare, Sparkles, Info, ChevronDown, ChevronUp,
  Phone, AlertCircle, Plus, Trash2
} from "lucide-react";

interface ChatbotConfig {
  delaiReponse: number;
  personnalite: string;
  messageAccueil: string;
  horaires: { actif: boolean; debut: string; fin: string };
  motsClesExclus: string[];
  instructionsSupp: string;
  langue: string;
}

const PERSONNALITES = [
  { id: "professionnel", label: "Professionnel", desc: "Formel, courtois, centré sur le service client" },
  { id: "chaleureux", label: "Chaleureux", desc: "Amical, enthousiaste, proche des clients" },
  { id: "concis", label: "Concis", desc: "Réponses courtes et directes, va à l'essentiel" },
  { id: "vendeur", label: "Commercial", desc: "Met en avant les produits, incite à l'achat" },
];

const LANGUES = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
  { id: "fr_en", label: "Français + English (auto)" },
  { id: "wo", label: "Wolof" },
  { id: "ha", label: "Haoussa" },
];

const EXEMPLES_EXCLUS = ["STOP", "Désabonner", "désabonnement", "unsubscribe"];

export default function ChatbotPage() {
  const [actif, setActif] = useState(false);
  const [config, setConfig] = useState<ChatbotConfig>({
    delaiReponse: 0,
    personnalite: "professionnel",
    messageAccueil: "",
    horaires: { actif: false, debut: "08:00", fin: "20:00" },
    motsClesExclus: [],
    instructionsSupp: "",
    langue: "fr",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newMotsCle, setNewMotsCle] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/chatbot");
      const data = await res.json();
      setActif(data.actif ?? false);
      if (data.config) setConfig(c => ({ ...c, ...data.config }));
      setLoading(false);
    })();
  }, []);

  async function sauvegarder() {
    setSaving(true);
    await fetch("/api/chatbot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif, config }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function ajouterMotCle() {
    if (!newMotsCle.trim() || config.motsClesExclus.includes(newMotsCle.trim())) return;
    setConfig(c => ({ ...c, motsClesExclus: [...c.motsClesExclus, newMotsCle.trim()] }));
    setNewMotsCle("");
  }

  const promptPreview = `Tu es AXIA, l'assistante IA de cette boutique.
Style: ${PERSONNALITES.find(p => p.id === config.personnalite)?.desc}
Langue: ${config.langue}
${config.instructionsSupp ? `Instructions: ${config.instructionsSupp}` : ""}
${config.messageAccueil ? `Message d'accueil: ${config.messageAccueil}` : ""}`;

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-300"/></div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chatbot WhatsApp IA</h1>
          <p className="text-gray-400 text-sm mt-0.5">AXIA répond automatiquement à vos messages WhatsApp</p>
        </div>
        {/* Toggle ON/OFF */}
        <button
          onClick={() => setActif(a => !a)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold text-sm transition-all ${actif ? "bg-green-500 text-white shadow-lg shadow-green-500/30" : "bg-gray-100 text-gray-500"}`}
        >
          <Power size={15}/>
          {actif ? "Actif" : "Inactif"}
        </button>
      </div>

      {/* Warning si WhatsApp pas connecté */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5"/>
        <div>
          <p className="text-sm font-semibold text-amber-800">WhatsApp Business requis</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Connectez votre compte WhatsApp Business dans <a href="/dashboard/connecteurs" className="underline font-bold">Connecteurs</a> pour activer le chatbot.
          </p>
        </div>
      </div>

      {/* Status card */}
      <div className={`rounded-2xl p-4 border flex items-center gap-3 ${actif ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${actif ? "bg-green-100" : "bg-gray-100"}`}>
          <BotMessageSquare size={18} className={actif ? "text-green-600" : "text-gray-400"}/>
        </div>
        <div>
          <p className={`font-bold text-sm ${actif ? "text-green-800" : "text-gray-600"}`}>
            {actif ? "AXIA répond automatiquement à vos messages" : "Chatbot désactivé — vous répondez manuellement"}
          </p>
          <p className={`text-xs mt-0.5 ${actif ? "text-green-600" : "text-gray-400"}`}>
            {actif ? `Personnalité: ${PERSONNALITES.find(p => p.id === config.personnalite)?.label} · Délai: ${config.delaiReponse}s` : "Activez le toggle ci-dessus pour démarrer"}
          </p>
        </div>
        {actif && <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse ml-auto"/>}
      </div>

      {/* ── Personnalité ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
          <Sparkles size={15} className="text-violet-500"/> Personnalité d'AXIA
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {PERSONNALITES.map(p => (
            <button
              key={p.id}
              onClick={() => setConfig(c => ({ ...c, personnalite: p.id }))}
              className={`text-left p-3 rounded-xl border-2 transition-all ${config.personnalite === p.id ? "border-[#F5A623] bg-amber-50" : "border-gray-100 hover:border-gray-200"}`}
            >
              <p className={`text-sm font-bold ${config.personnalite === p.id ? "text-[#e8950f]" : "text-gray-700"}`}>{p.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Message d'accueil ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
          <MessageSquare size={15} className="text-[#D4911A]"/> Message d'accueil
        </h2>
        <p className="text-xs text-gray-400 mb-3">Envoyé automatiquement quand quelqu'un contacte pour la première fois (optionnel)</p>
        <textarea
          value={config.messageAccueil}
          onChange={e => setConfig(c => ({ ...c, messageAccueil: e.target.value }))}
          placeholder="Ex: Bonjour ! Je suis AXIA, votre assistante chez [Boutique]. Comment puis-je vous aider ?"
          rows={3}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#F5A623]/50 resize-none"
        />
      </div>

      {/* ── Langue ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="font-bold text-gray-900 text-sm mb-3">Langue de réponse</h2>
        <div className="flex flex-wrap gap-2">
          {LANGUES.map(l => (
            <button
              key={l.id}
              onClick={() => setConfig(c => ({ ...c, langue: l.id }))}
              className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${config.langue === l.id ? "border-[#F5A623] bg-amber-50 text-[#e8950f]" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Délai de réponse ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
          <Clock size={15} className="text-gray-400"/> Délai avant réponse
        </h2>
        <p className="text-xs text-gray-400 mb-4">Un délai naturel évite l'effet "bot évident"</p>
        <div className="flex items-center gap-4">
          <input
            type="range" min={0} max={30} step={5}
            value={config.delaiReponse}
            onChange={e => setConfig(c => ({ ...c, delaiReponse: parseInt(e.target.value) }))}
            className="flex-1 accent-[#F5A623]"
          />
          <span className="text-lg font-bold text-gray-900 w-16 text-right">{config.delaiReponse}s</span>
        </div>
        <div className="flex justify-between text-[10px] text-gray-300 mt-1 px-0.5">
          <span>Immédiat</span><span>10s</span><span>20s</span><span>30s</span>
        </div>
      </div>

      {/* ── Horaires ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Clock size={15} className="text-indigo-500"/> Horaires de réponse
          </h2>
          <button
            onClick={() => setConfig(c => ({ ...c, horaires: { ...c.horaires, actif: !c.horaires.actif } }))}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.horaires.actif ? "bg-[#F5A623]" : "bg-gray-200"}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${config.horaires.actif ? "translate-x-4.5" : "translate-x-0.5"}`}/>
          </button>
        </div>
        {config.horaires.actif && (
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Début</label>
              <input type="time" value={config.horaires.debut} onChange={e => setConfig(c => ({ ...c, horaires: { ...c.horaires, debut: e.target.value } }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"/>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Fin</label>
              <input type="time" value={config.horaires.fin} onChange={e => setConfig(c => ({ ...c, horaires: { ...c.horaires, fin: e.target.value } }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"/>
            </div>
          </div>
        )}
        {!config.horaires.actif && <p className="text-xs text-gray-400">AXIA répondra 24h/24 — 7j/7</p>}
      </div>

      {/* ── Mots-clés exclus ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="font-bold text-gray-900 text-sm mb-1">Mots-clés exclus</h2>
        <p className="text-xs text-gray-400 mb-3">AXIA ne répondra pas si le message contient ces mots (ex: STOP, désabonner)</p>
        <div className="flex gap-2 mb-3">
          <input
            value={newMotsCle}
            onChange={e => setNewMotsCle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ajouterMotCle()}
            placeholder="Ajouter un mot-clé…"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-300"
          />
          <button onClick={ajouterMotCle} className="px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all">
            <Plus size={14}/>
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {config.motsClesExclus.map(mc => (
            <span key={mc} className="flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-600">
              {mc}
              <button onClick={() => setConfig(c => ({ ...c, motsClesExclus: c.motsClesExclus.filter(m => m !== mc) }))} className="text-gray-300 hover:text-red-400 transition-all">
                <Trash2 size={10}/>
              </button>
            </span>
          ))}
          {config.motsClesExclus.length === 0 && (
            <div className="text-xs text-gray-300">
              Suggestions: {EXEMPLES_EXCLUS.map(e => (
                <button key={e} onClick={() => setConfig(c => ({ ...c, motsClesExclus: [...c.motsClesExclus, e] }))} className="mx-1 underline hover:text-gray-500">{e}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Instructions supplémentaires ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-bold text-gray-900 text-sm">Instructions personnalisées</h2>
          <button onClick={() => setShowPreview(p => !p)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            {showPreview ? <><ChevronUp size={12}/> Masquer prompt</> : <><ChevronDown size={12}/> Voir prompt</>}
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">Ajoutez des règles spécifiques (ex: "Ne jamais mentionner les concurrents")</p>
        <textarea
          value={config.instructionsSupp}
          onChange={e => setConfig(c => ({ ...c, instructionsSupp: e.target.value }))}
          placeholder="Ex: Toujours proposer le paiement par Wave ou Orange Money. Ne jamais promettre une livraison en moins de 24h..."
          rows={3}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#F5A623]/50 resize-none"
        />
        {showPreview && (
          <div className="mt-3 bg-gray-900 rounded-xl p-4">
            <p className="text-[10px] text-gray-400 mb-2 font-mono uppercase tracking-wider">Prompt système généré</p>
            <pre className="text-[11px] text-green-400 font-mono whitespace-pre-wrap leading-relaxed">{promptPreview}</pre>
          </div>
        )}
      </div>

      {/* Bouton sauvegarder */}
      <button
        onClick={sauvegarder}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white text-sm transition-all disabled:opacity-50 sticky bottom-4"
        style={{ background: saved ? "#059669" : "linear-gradient(135deg, #F5A623, #e8950f)", boxShadow: saved ? "0 4px 16px rgba(5,150,105,0.3)" : "0 4px 16px rgba(245,166,35,0.3)" }}
      >
        {saving ? <><Loader2 size={15} className="animate-spin"/> Sauvegarde…</> : saved ? <><CheckCircle2 size={15}/> Sauvegardé !</> : <><Save size={15}/> Sauvegarder la configuration</>}
      </button>
    </div>
  );
}
