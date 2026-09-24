"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Loader2, CheckCircle2, Zap, BrainCircuit,
  TrendingUp, Target, RefreshCw, ChevronRight, Sparkles,
  Mic, MicOff, Image as ImageIcon, X,
  BarChart3, DollarSign, Megaphone, Package, Users, Truck, User,
} from "lucide-react";
import { AgentAvatar3D, AGENT_META } from "@/components/dashboard/AgentAvatar3D";

import { useDevise } from "@/components/dashboard/DeviseProvider";
const SUGGESTIONS = [
  { cat: "Analytics",  Icon: BarChart3,  items: ["Fais un rapport complet de mes ventes", "Quels sont mes produits les plus rentables ?", "Analyse mes clients VIP"] },
  { cat: "Revenus",    Icon: DollarSign, items: ["Optimise mes prix pour maximiser le CA", "Crée une offre flash 24h", "Relance les paniers abandonnés"] },
  { cat: "Marketing",  Icon: Megaphone,  items: ["Génère un post Instagram pour mes produits", "Lance une campagne email à mes clients", "Crée un code promo -20%"] },
  { cat: "Stocks",     Icon: Package,    items: ["Quels produits risquent d'être en rupture ?", "Prépare mes stocks pour la Tabaski", "Audit complet de mon inventaire"] },
  { cat: "Clients",    Icon: Users,      items: ["Segmente mes clients en VIP / actifs / inactifs", "Génère un message de fidélité", "Qui n'a pas commandé depuis 30 jours ?"] },
  { cat: "Livraisons", Icon: Truck,      items: ["Assigne les livreurs disponibles", "Statut de toutes les livraisons en cours", "Combien de commandes à traiter ?"] },
];

interface Msg { role: "user" | "assistant"; content: string; actions?: string[]; imageUrl?: string; streaming?: boolean }

// ── Markdown léger ───────────────────────────────────────────────────────────
function MdText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let i = 0;

  const push = (node: React.ReactNode) => parts.push(<span key={i++}>{node}</span>);

  // Split paragraphes
  const paragraphs = remaining.split(/\n\n+/);
  return (
    <div className="space-y-2">
      {paragraphs.map((para, pi) => {
        const lines = para.split("\n");
        return (
          <div key={pi}>
            {lines.map((line, li) => {
              // Header
              if (line.startsWith("### ")) return <h4 key={li} className="font-bold text-[13px] mt-1 text-[#111]">{line.slice(4)}</h4>;
              if (line.startsWith("## ")) return <h3 key={li} className="font-bold text-[14px] mt-1 text-[#111]">{line.slice(3)}</h3>;
              if (line.startsWith("# ")) return <h2 key={li} className="font-bold text-[15px] mt-1 text-[#111]">{line.slice(2)}</h2>;
              // Separator
              if (line.trim() === "---" || line.trim() === "━━━") return <hr key={li} className="border-gray-200 my-1"/>;
              // List item
              if (line.match(/^[-*•]\s/)) {
                return (
                  <div key={li} className="flex gap-2">
                    <span className="text-[#F5A623] mt-0.5 flex-shrink-0">·</span>
                    <span>{inlineMarkdown(line.slice(2))}</span>
                  </div>
                );
              }
              // Numbered list
              if (line.match(/^\d+\.\s/)) {
                const match = line.match(/^(\d+)\.\s(.*)/)!;
                return (
                  <div key={li} className="flex gap-2">
                    <span className="text-[#F5A623] font-bold text-xs mt-0.5 flex-shrink-0 w-4">{match[1]}.</span>
                    <span>{inlineMarkdown(match[2])}</span>
                  </div>
                );
              }
              // Media embeds
              if (line.startsWith("[IMAGE:")) {
                const url = line.slice(7, -1);
                return <img key={li} src={url} alt="Image générée" className="rounded-xl max-w-full mt-1 border border-gray-100" style={{ maxHeight: 260 }}/>;
              }
              if (line.startsWith("[VIDEO:")) {
                const url = line.slice(7, -1);
                return <video key={li} src={url} controls className="rounded-xl max-w-full mt-1 border border-gray-100" style={{ maxHeight: 260 }}/>;
              }
              if (line.startsWith("[AUDIO:")) {
                const url = line.slice(7, -1);
                return <audio key={li} src={url} controls className="w-full mt-1"/>;
              }
              // Normal line
              if (!line.trim()) return null;
              return <p key={li} className="leading-relaxed">{inlineMarkdown(line)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

function inlineMarkdown(text: string): React.ReactNode {
  // Bold + code + italic via regex splits
  const parts: React.ReactNode[] = [];
  // Split on **bold**, `code`, *italic*, [link](url)
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={i++}>{text.slice(last, m.index)}</span>);
    const token = m[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={i++} className="font-bold text-[#111]">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={i++} className="bg-gray-100 text-[#111111] text-[11px] px-1.5 py-0.5 rounded font-mono">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      parts.push(<em key={i++} className="italic">{token.slice(1, -1)}</em>);
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) parts.push(<a key={i++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-[#F5A623] underline">{linkMatch[1]}</a>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(<span key={i++}>{text.slice(last)}</span>);
  return parts.length ? parts : text;
}

// ── Panneau Orchestrateur ────────────────────────────────────────────────────
function OrchestratorPanel({ onClose }: { onClose: () => void }) {
  const { devise, fmt } = useDevise();
  const [loading, setLoading] = useState(false);
  const [etat, setEtat] = useState<any>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [objectifForm, setObjectifForm] = useState(false);
  const [objectifOk, setObjectifOk] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [cible, setCible] = useState("1000000");
  const [deadline, setDeadline] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().split("T")[0];
  });

  const charger = useCallback(() =>
    fetch("/api/ai/orchestrator")
      .then(r => r.json())
      .then(d => { if (!d.error) setEtat(d); })
      .catch(() => {}), []);

  useEffect(() => { charger(); }, [charger]);

  const orchestrer = async () => {
    setLoading(true); setActions([]); setErreur(null);
    try {
      const res = await fetch("/api/ai/orchestrator", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "orchestrer" }),
      });
      const data = await res.json();
      if (data.error) setErreur(data.error);
      else setActions(data.actions || []);
      await charger();
    } catch { setErreur("Erreur réseau — réessayez."); }
    finally { setLoading(false); }
  };

  const creerObjectif = async () => {
    setErreur(null);
    try {
      const res = await fetch("/api/ai/orchestrator", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "creer_objectif", type: "revenu_mensuel",
          titre: `Objectif ${new Date(deadline).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
          cible: parseFloat(cible), devise, deadline,
        }),
      });
      const data = await res.json();
      if (data.error) { setErreur(data.error); return; }
      setObjectifForm(false); setObjectifOk(true);
      setTimeout(() => setObjectifOk(false), 3000);
      await charger();
    } catch { setErreur("Erreur lors de la création."); }
  };

  const objectifs = etat?.objectifs ?? [];
  const decisions = etat?.decisions ?? [];

  return (
    <div className="absolute inset-0 bg-white z-20 flex flex-col rounded-3xl shadow-2xl overflow-hidden border border-purple-100">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-600">
          <BrainCircuit size={18} className="text-white"/>
        </div>
        <div>
          <p className="font-bold text-[#111111]">Mode Autonome</p>
          <p className="text-xs text-purple-600">AXIA coordonne tous les agents en arrière-plan</p>
        </div>
        <button onClick={onClose} className="ml-auto text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition-all">
          <X size={14}/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {erreur && <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-xs text-red-700">{erreur}</div>}
        {objectifOk && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-xs text-green-700">
            <CheckCircle2 size={13}/> Objectif créé avec succès !
          </div>
        )}

        <button onClick={orchestrer} disabled={loading}
          className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
          style={{ background: "linear-gradient(135deg, #111111, #333333)", boxShadow: "0 8px 20px rgba(17,17,17,0.3)" }}>
          {loading ? <><Loader2 size={14} className="animate-spin"/> Orchestration en cours…</> : <><Zap size={14}/> Activer tous les agents maintenant</>}
        </button>

        {actions.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-green-700">{actions.length} action(s) effectuée(s)</p>
            {actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-green-700">
                <CheckCircle2 size={11} className="mt-0.5 flex-shrink-0"/><span>{a}</span>
              </div>
            ))}
          </div>
        )}

        {/* Objectifs */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Objectifs Revenus</p>
            <button onClick={() => setObjectifForm(!objectifForm)} className="text-xs text-purple-600 font-semibold hover:underline flex items-center gap-1">
              <Target size={11}/> Ajouter
            </button>
          </div>
          {objectifForm && (
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 mb-3 space-y-2">
              <input type="number" value={cible} onChange={e => setCible(e.target.value)} placeholder={`Cible en ${devise}`} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-400"/>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-400"/>
              <button onClick={creerObjectif} disabled={!cible || parseFloat(cible) <= 0} className="w-full py-2 bg-purple-600 text-white rounded-xl text-sm font-bold disabled:opacity-50">Créer l'objectif</button>
            </div>
          )}
          {objectifs.length === 0 ? (
            <div className="text-center py-6 text-[#AAAAAA] text-xs bg-[#F9F9F9] rounded-2xl">Aucun objectif défini</div>
          ) : objectifs.map((obj: any) => {
            const pct = obj.cible > 0 ? Math.min(100, Math.round((obj.actuel / obj.cible) * 100)) : 0;
            return (
              <div key={obj.id} className="ax-card p-3 mb-2">
                <div className="flex justify-between mb-1.5">
                  <p className="text-sm font-semibold text-gray-800">{obj.titre}</p>
                  <span className="text-xs font-bold" style={{ color: pct >= 100 ? "#16a34a" : "#111111" }}>{pct}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#111111,#333333)" }}/>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-gray-400">{obj.actuel?.toLocaleString()} {obj.devise}</span>
                  <span className="text-[10px] text-gray-400">{obj.cible?.toLocaleString()} {obj.devise}</span>
                </div>
              </div>
            );
          })}
        </div>

        {decisions.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Décisions récentes</p>
            <div className="space-y-2">
              {decisions.slice(0, 5).map((d: any) => (
                <div key={d.id} className="flex items-start gap-2.5 bg-purple-50/50 border border-purple-100 rounded-xl p-3">
                  <Zap size={12} className="text-purple-500 mt-0.5 flex-shrink-0"/>
                  <div>
                    <p className="text-xs text-gray-700">{d.description}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{d.agentId} · {new Date(d.createdAt).toLocaleDateString("fr-FR")}</p>
                  </div>
                  {d.impactEstime && <span className="text-[10px] text-green-600 font-bold ml-auto flex-shrink-0">+{fmt(d.impactEstime)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function AgentsPage() {
  const meta = AGENT_META["axia"];
  const [messages, setMessages] = useState<Msg[]>([{
    role: "assistant",
    content: "Bonjour 👋 Je suis **AXIA**, votre agent IA tout-en-un.\n\nJe peux gérer votre boutique de A à Z : analytics, marketing, stocks, clients, livraisons, revenus — dites-moi simplement ce que vous voulez faire.",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOrchestrator, setShowOrchestrator] = useState(false);
  const [catOuverte, setCatOuverte] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ── Voice input (Web Speech API) ─────────────────────────────────────────
  const toggleVoice = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("La reconnaissance vocale n'est pas disponible sur ce navigateur.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join("");
      setInput(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening]);

  // ── Image upload ─────────────────────────────────────────────────────────
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setPendingImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  // ── Streaming chat ────────────────────────────────────────────────────────
  const envoyer = useCallback(async (txt?: string) => {
    const msg = (txt ?? input).trim();
    if (!msg || loading) return;

    const hist: Msg[] = [...messages, { role: "user", content: msg, imageUrl: pendingImage ?? undefined }];
    setMessages(hist);
    setInput("");
    setPendingImage(null);
    setLoading(true);

    // Placeholder streaming message
    setMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);

    try {
      const res = await fetch("/api/ai/universal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: hist.map(m => ({ role: m.role, content: m.content })),
          imageUrl: hist[hist.length - 1]?.imageUrl ?? undefined,
          stream: true,
        }),
      });

      if (!res.ok || !res.body) throw new Error("Erreur serveur");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalActions: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const data = JSON.parse(payload);
            if (data.type === "token" && data.text) {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.streaming) {
                  return [...prev.slice(0, -1), { ...last, content: last.content + data.text }];
                }
                return prev;
              });
            } else if (data.type === "done") {
              finalActions = data.actions ?? [];
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.streaming) {
                  return [...prev.slice(0, -1), { ...last, streaming: false, actions: finalActions }];
                }
                return prev;
              });
            }
          } catch {}
        }
      }

      // Finaliser si le stream s'est fermé sans "done"
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false }];
        return prev;
      });

    } catch {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return [...prev.slice(0, -1), { role: "assistant", content: "Une erreur s'est produite — réessayez." }];
        }
        return prev;
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, pendingImage]);

  const showSuggestions = messages.length <= 1 && !loading;

  return (
    <div className="h-full flex flex-col min-h-0 bg-gray-50/50">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center gap-4 px-6 py-4 bg-white border-b border-[#F3F3F3]">
        <div style={{ filter: `drop-shadow(0 0 14px ${meta.glow})` }}>
          <AgentAvatar3D agentId="axia" size={46} pulse={loading}/>
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[18px] font-bold text-[#111111]">AXIA</h1>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}bb)` }}>
              Agent IA
            </span>
            <span className="flex items-center gap-1 text-[11px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
              En ligne · Streaming actif
            </span>
          </div>
          <p className="text-[12px] text-[#AAAAAA] mt-0.5">Marketing · Stocks · Revenus · Analytics · Livraisons · Clients</p>
        </div>

        <button
          onClick={() => setShowOrchestrator(true)}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all border hover:shadow-md flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #11111112, #33333312)", borderColor: "#11111130", color: "#111111" }}
        >
          <BrainCircuit size={14}/>
          <span className="hidden sm:inline">Mode Autonome</span>
          <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.5 rounded-full">AUTO</span>
        </button>
      </div>

      {/* ── Corps ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col min-h-0 relative">

          {showOrchestrator && (
            <div className="absolute inset-4 z-20">
              <OrchestratorPanel onClose={() => setShowOrchestrator(false)}/>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 min-h-0">

            {showSuggestions && (
              <div className="space-y-3 pb-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Que voulez-vous faire ?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {SUGGESTIONS.map((cat) => (
                    <div key={cat.cat} className="ax-card overflow-hidden">
                      <button
                        onClick={() => setCatOuverte(catOuverte === cat.cat ? null : cat.cat)}
                        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                      >
                        <span className="flex items-center gap-1.5">
                          <cat.Icon size={14} className="text-gray-400"/>
                          {cat.cat}
                        </span>
                        <ChevronRight size={14} className={`text-gray-400 transition-transform ${catOuverte === cat.cat ? "rotate-90" : ""}`}/>
                      </button>
                      {catOuverte === cat.cat && (
                        <div className="border-t border-gray-50 divide-y divide-gray-50">
                          {cat.items.map((item) => (
                            <button
                              key={item}
                              onClick={() => { setCatOuverte(null); envoyer(item); }}
                              className="w-full text-left px-4 py-2.5 text-xs text-gray-600 hover:bg-amber-50 hover:text-gray-900 transition-all flex items-center gap-2"
                            >
                              <Sparkles size={10} className="text-[#F5A623] flex-shrink-0"/>
                              {item}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bulles de messages */}
            {messages.map((m, i) => {
              const estIA = m.role === "assistant";
              return (
                <div key={i} className={`flex gap-3 ${estIA ? "" : "flex-row-reverse"}`}>
                  {estIA ? (
                    <div className="flex-shrink-0 mt-1" style={{ filter: `drop-shadow(0 0 8px ${meta.glow})` }}>
                      <AgentAvatar3D agentId="axia" size={36} pulse={m.streaming}/>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <User size={14} className="text-gray-500"/>
                    </div>
                  )}
                  <div className={`flex flex-col gap-1.5 ${estIA ? "max-w-[82%]" : "max-w-[72%]"}`}>
                    {m.imageUrl && (
                      <img src={m.imageUrl} alt="Pièce jointe" className="rounded-2xl max-w-[200px] border border-gray-200 mb-1" style={{ maxHeight: 180 }}/>
                    )}
                    <div
                      className="rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm"
                      style={estIA
                        ? { background: "white", border: `1px solid ${meta.color}18`, color: "#111111" }
                        : { background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`, color: "white" }
                      }
                    >
                      {estIA ? (
                        <>
                          <MdText text={m.content || ""} />
                          {m.streaming && (
                            <span className="inline-flex gap-0.5 ml-1">
                              {[0, 1, 2].map(k => (
                                <span key={k} className="w-1.5 h-1.5 rounded-full inline-block"
                                  style={{ background: meta.color, animation: `dot 1s ${k * 0.2}s ease-in-out infinite` }}/>
                              ))}
                            </span>
                          )}
                        </>
                      ) : m.content}
                    </div>
                    {(m.actions ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(m.actions ?? []).map((a, j) => (
                          <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-green-50 border border-green-200 text-green-700 px-2.5 py-1 rounded-lg">
                            <CheckCircle2 size={9}/>{a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pré-chargement (non streaming) */}
            {loading && !messages[messages.length - 1]?.streaming && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-1" style={{ filter: `drop-shadow(0 0 8px ${meta.glow})` }}>
                  <AgentAvatar3D agentId="axia" size={36} pulse/>
                </div>
                <div className="bg-white border rounded-2xl px-4 py-3 flex items-center gap-2 shadow-sm" style={{ borderColor: meta.color + "25" }}>
                  <Loader2 size={13} className="animate-spin" style={{ color: meta.color }}/>
                  <span className="text-sm text-gray-400">AXIA réfléchit…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Zone de saisie */}
          <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100">
            {/* Preview image */}
            {pendingImage && (
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="relative">
                  <img src={pendingImage} alt="Pièce jointe" className="w-14 h-14 rounded-xl object-cover border border-gray-200"/>
                  <button onClick={() => setPendingImage(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-700 text-white rounded-full flex items-center justify-center hover:bg-gray-900">
                    <X size={10}/>
                  </button>
                </div>
                <span className="text-xs text-gray-400">Image jointe</span>
              </div>
            )}

            <div
              className="flex items-end gap-2 rounded-2xl border px-3 py-2.5 transition-all focus-within:border-[#F5A623]/50 focus-within:shadow-sm"
              style={{ background: "#fafafa", borderColor: "#e5e7eb" }}
            >
              {/* Image upload */}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload}/>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 hover:bg-gray-100 transition-all"
                title="Joindre une image"
              >
                <ImageIcon size={14} className="text-gray-400"/>
              </button>

              <div className="flex-shrink-0 pb-0.5">
                <AgentAvatar3D agentId="axia" size={20} pulse={loading}/>
              </div>

              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); }}}
                placeholder="Parlez à AXIA… (Entrée pour envoyer)"
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none resize-none min-w-0"
                style={{ maxHeight: 120 }}
                onInput={e => {
                  const t = e.target as HTMLTextAreaElement;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 120) + "px";
                }}
              />

              {/* Voice input */}
              <button
                onClick={toggleVoice}
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-all ${listening ? "bg-red-100" : "hover:bg-gray-100"}`}
                title={listening ? "Arrêter l'écoute" : "Parler à AXIA"}
              >
                {listening ? <MicOff size={14} className="text-red-500 animate-pulse"/> : <Mic size={14} className="text-gray-400"/>}
              </button>

              {/* Send */}
              <button
                onClick={() => envoyer()}
                disabled={(!input.trim() && !pendingImage) || loading}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mb-0.5 transition-all disabled:opacity-40"
                style={{ background: (input.trim() || pendingImage) && !loading ? `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` : "#f3f4f6" }}
              >
                {loading
                  ? <Loader2 size={13} className="animate-spin text-gray-400"/>
                  : <Send size={13} className={(input.trim() || pendingImage) ? "text-white" : "text-gray-400"}/>
                }
              </button>
            </div>

            <p className="text-center text-[10px] text-gray-300 mt-2">
              AXIA crée des produits, envoie des campagnes, publie sur les réseaux, analyse vos ventes et bien plus.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes dot { 0%,80%,100%{transform:scale(.5);opacity:.3} 40%{transform:scale(1.2);opacity:1} }
      `}</style>
    </div>
  );
}
