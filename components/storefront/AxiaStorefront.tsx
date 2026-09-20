"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Sparkles, Minus } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  slug: string;
  nomBoutique: string;
  accentColor?: string;
}

const THINKING_MSGS = [
  "AXIA réfléchit…",
  "AXIA consulte la boutique…",
  "AXIA prépare sa réponse…",
  "AXIA analyse ta question…",
  "AXIA vérifie les produits…",
];

export function AxiaStorefront({ slug, nomBoutique, accentColor = "#F5A623" }: Props) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [thinkingMsg, setThinkingMsg] = useState(THINKING_MSGS[0]);
  const [thinkingIdx, setThinkingIdx] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Rotate thinking messages
  useEffect(() => {
    if (!loading) return;
    const timer = setInterval(() => {
      setThinkingIdx((i) => {
        const next = (i + 1) % THINKING_MSGS.length;
        setThinkingMsg(THINKING_MSGS[next]);
        return next;
      });
    }, 2200);
    return () => clearInterval(timer);
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `Bonjour ! Je suis AXIA, l'assistante de ${nomBoutique}. Je peux t'aider à trouver des produits, répondre à tes questions sur les commandes, ou te guider. Comment puis-je t'aider ?`,
      }]);
    }
  }, [open, messages.length, nomBoutique]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      // Use a storefront-specific AXIA endpoint
      const res = await fetch(`/api/ai/storefront`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, slug, stream: false }),
      });

      if (!res.ok) throw new Error("Erreur réseau");
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reponse ?? "Je n'ai pas pu traiter ta demande." }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Désolée, je rencontre une difficulté technique. Essaie de me recontacter dans quelques instants." }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, slug]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ background: accentColor }}
        aria-label="Ouvrir AXIA"
      >
        <Sparkles size={22} className="text-white" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{ width: 340, height: minimized ? "auto" : 480, background: "white", border: "1px solid #F0F0F0" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0" style={{ background: accentColor }}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-white/80" />
          <div>
            <p className="text-[13px] font-semibold leading-tight">AXIA</p>
            <p className="text-[10px] text-white/70 leading-tight">{nomBoutique}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setMinimized((m) => !m)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <Minus size={13} />
          </button>
          <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X size={13} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[13px]">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] px-3 py-2 rounded-xl leading-relaxed"
                  style={
                    msg.role === "user"
                      ? { background: accentColor, color: "white", borderBottomRightRadius: 4 }
                      : { background: "#F5F5F5", color: "#111", borderBottomLeftRadius: 4 }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-3 py-2 rounded-xl" style={{ background: "#F5F5F5", borderBottomLeftRadius: 4 }}>
                  <div className="flex items-center gap-2">
                    <span className="flex gap-0.5">
                      {[0, 1, 2].map((j) => (
                        <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor, animation: `bounce 1s ${j * 0.15}s infinite` }} />
                      ))}
                    </span>
                    <span className="text-[11px] text-[#888]">{thinkingMsg}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-[#F0F0F0] px-3 py-2.5 flex items-end gap-2 shrink-0">
            <textarea
              ref={inputRef}
              className="flex-1 resize-none text-[13px] border-0 outline-none bg-transparent max-h-24 leading-relaxed"
              placeholder="Pose ta question…"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              style={{ fontFamily: "inherit" }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
              style={{ background: accentColor }}
            >
              <Send size={13} className="text-white" />
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
