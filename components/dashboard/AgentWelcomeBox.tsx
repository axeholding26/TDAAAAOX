"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, ChevronDown, ChevronUp, Zap, CheckCircle2, User } from "lucide-react";
import { AgentAvatar3D, AGENT_META, type AgentId } from "./AgentAvatar3D";

interface Message { role: "user" | "assistant"; content: string; actions?: string[] }

interface Props {
  agentId: AgentId;
  greeting: string;
  endpoint: string;
  suggestions?: string[];
}

export function AgentWelcomeBox({ agentId, greeting, endpoint, suggestions = [] }: Props) {
  const meta = AGENT_META[agentId];
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: greeting }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, open]);

  const envoyer = async (txt?: string) => {
    const msg = (txt || input).trim();
    if (!msg || loading) return;
    const hist: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(hist);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: hist.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMessages([...hist, {
        role: "assistant",
        content: data.reponse || data.message || "Fait !",
        actions: data.actions,
      }]);
    } catch {
      setMessages([...hist, { role: "assistant", content: "Erreur — réessayez." }]);
    } finally { setLoading(false); }
  };

  return (
    <div className="mb-6 rounded-2xl border overflow-hidden"
      style={{
        borderColor: meta.color + "30",
        boxShadow: `0 4px 24px ${meta.glow.replace("0.5","0.1")}`,
        background: "white",
      }}>

      {/* ── Header agent ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50/60"
        style={{ borderBottom: open ? `1px solid ${meta.color}18` : "none" }}
      >
        <div style={{ filter: `drop-shadow(0 0 10px ${meta.glow})` }}>
          <AgentAvatar3D agentId={agentId} size={46} pulse={loading}/>
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900 text-base">{meta.nom}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: meta.color + "15", color: meta.color }}>
              {meta.role}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"/>
              Actif
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
            {messages.length > 1 ? `${messages.length - 1} message${messages.length > 2 ? "s" : ""} · Cliquez pour continuer` : "Cliquez pour commencer"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" style={{ color: meta.color }}/>}
          {open ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
        </div>
      </button>

      {/* ── Corps (collapsible) ── */}
      {open && (
        <div>
          {/* Messages */}
          <div className="px-5 py-4 space-y-3 max-h-64 overflow-y-auto bg-gray-50/40" style={{ scrollbarWidth: "thin" }}>
            {messages.map((m, i) => {
              const estIA = m.role === "assistant";
              return (
                <div key={i} className={`flex gap-2.5 ${estIA ? "" : "flex-row-reverse"}`}>
                  {estIA ? (
                    <div className="flex-shrink-0 mt-0.5">
                      <AgentAvatar3D agentId={agentId} size={32} pulse={loading && i === messages.length - 1}/>
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User size={14} className="text-gray-500" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1 max-w-[85%]">
                    <div className="rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                      style={estIA
                        ? { background: "white", border: `1px solid ${meta.color}18`, color: "#1a1a2e" }
                        : { background: `linear-gradient(135deg, ${meta.color}, ${meta.color}dd)`, color: "white" }
                      }>
                      {m.content}
                    </div>
                    {m.actions?.map((a, j) => (
                      <span key={j} className="inline-flex items-center gap-1 text-[10px] bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-lg w-fit">
                        <CheckCircle2 size={8}/>{a}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex gap-2.5">
                <AgentAvatar3D agentId={agentId} size={32} pulse/>
                <div className="bg-white border rounded-xl px-3 py-2 flex items-center gap-1.5" style={{ borderColor: meta.color + "20" }}>
                  <Loader2 size={11} className="animate-spin" style={{ color: meta.color }}/>
                  <span className="text-xs text-gray-400">{meta.nom} travaille…</span>
                  {[0,1,2].map(i=><span key={i} className="w-1 h-1 rounded-full" style={{ background: meta.color, animation: `wbDot 1s ${i*.2}s ease-in-out infinite` }}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Suggestions (seulement premier message) */}
          {messages.length <= 1 && suggestions.length > 0 && (
            <div className="px-5 py-3 flex flex-wrap gap-2 border-t border-gray-50">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => envoyer(s)}
                  className="text-xs px-3 py-1.5 rounded-xl border transition-all hover:shadow-sm"
                  style={{ borderColor: meta.color + "30", color: meta.color, background: meta.color + "08" }}
                  onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = meta.color + "18"; }}
                  onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = meta.color + "08"; }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-50 bg-white">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); }}}
                placeholder={`Demandez à ${meta.nom}…`}
                rows={1} disabled={loading}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none transition-colors focus:border-[var(--agent-color)]"
                style={{ maxHeight: "80px", "--agent-color": meta.color } as any}
                onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 80) + "px"; }}
              />
              <button onClick={() => envoyer()} disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40 transition-all flex-shrink-0"
                style={{ background: input.trim() && !loading ? `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` : "#f3f4f6" }}>
                {loading ? <Loader2 size={13} className="animate-spin text-gray-400"/> : <Send size={13} style={{ color: input.trim() ? "white" : "#9ca3af" }}/>}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes wbDot { 0%,80%,100%{transform:scale(.5);opacity:.3} 40%{transform:scale(1.2);opacity:1} }
      `}</style>
    </div>
  );
}
