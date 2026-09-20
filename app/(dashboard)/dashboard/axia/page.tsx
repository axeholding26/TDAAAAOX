"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Send, Loader2, User, Mic, MicOff, History } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string; streaming?: boolean }

export default function AxiaPage() {
  const [messages, setMessages] = useState<Msg[]>([{
    role: "assistant",
    content: "Bonjour ! Je suis Axia, ton assistante IA.\n\nPose-moi n'importe quelle question sur ta boutique : ventes, stocks, clients, marketing…",
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.onresult = (e: any) => setInput(Array.from(e.results).map((r: any) => r[0].transcript).join(""));
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const envoyer = async (txt?: string) => {
    const msg = (txt ?? input).trim();
    if (!msg || loading) return;

    const hist: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages([...hist, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/axia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: hist.map(m => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Erreur ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "token" && data.text) {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.streaming) return [...prev.slice(0, -1), { ...last, content: last.content + data.text }];
                return prev;
              });
            } else if (data.type === "done") {
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false }];
                return prev;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { role: "assistant", content: `Erreur : ${err.message}` }];
        return prev;
      });
    } finally {
      setLoading(false);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return [...prev.slice(0, -1), { ...last, streaming: false }];
        return prev;
      });
      inputRef.current?.focus();
    }
  };

  const SUGGESTIONS = [
    "Fais un rapport complet de mes ventes",
    "Quels produits risquent d'être en rupture ?",
    "Génère un post Instagram pour mes produits",
    "Quels clients VIP relancer ?",
  ];

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-100">
        <div className="w-10 h-10 rounded-2xl overflow-hidden flex-shrink-0">
          <img src="/axia-icon.png" alt="Axia" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900">Axia — Assistante IA</h1>
          <p className="text-xs text-gray-400">Marketing · Stocks · Revenus · Clients · Livraisons</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/dashboard/axia/journal"
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 border border-gray-200 rounded-full px-3 py-1 transition-colors">
            <History size={12} /> Journal
          </Link>
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-700">En ligne</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 min-h-0">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden ${m.role === "assistant" ? "" : "bg-[#F5A623]"}`}>
              {m.role === "assistant"
                ? <img src="/axia-icon.png" alt="Axia" className="w-full h-full object-cover" />
                : <User size={13} className="text-white" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "assistant"
                ? "bg-white border border-gray-100 text-gray-800 shadow-sm"
                : "bg-[#F5A623] text-white"
            }`}>
              {m.content}
              {m.streaming && (
                <span className="inline-flex gap-0.5 ml-1 align-middle">
                  {[0, 1, 2].map(k => (
                    <span key={k} className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block"
                      style={{ animation: `xdot 1s ${k * 0.15}s ease-in-out infinite` }} />
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}

        {messages.length === 1 && !loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => envoyer(s)}
                className="text-left px-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm text-gray-600 hover:border-[#F5A623] hover:text-gray-900 transition-all">
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:border-[#F5A623] transition-colors">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); envoyer(); } }}
            placeholder="Pose une question à Axia…"
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          <button onClick={toggleVoice}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${listening ? "bg-red-100" : "hover:bg-gray-100"}`}>
            {listening
              ? <MicOff size={13} className="text-red-500 animate-pulse" />
              : <Mic size={13} className="text-gray-400" />}
          </button>
          <button onClick={() => envoyer()} disabled={!input.trim() || loading}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: input.trim() && !loading ? "#F5A623" : "#e5e7eb" }}>
            {loading
              ? <Loader2 size={12} className="animate-spin text-gray-400" />
              : <Send size={12} className={input.trim() ? "text-white" : "text-gray-400"} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-300 mt-2">
          Axia peut créer des produits, envoyer des campagnes et analyser tes ventes.
        </p>
      </div>

      <style>{`@keyframes xdot{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}}`}</style>
    </div>
  );
}
