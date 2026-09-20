"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string }

interface Props {
  // Flush les changements locaux non sauvegardés vers le serveur avant
  // qu'AXIA ne lise l'arbre, puis recharge le config depuis le serveur après
  // sa réponse (les outils AXIA écrivent directement en base, comme tout le
  // reste du système AXIA — voir lib/axia/tools.ts) : ce garde-fou évite
  // qu'AXIA écrase un changement en cours d'édition, ou que son résultat
  // n'apparaisse pas tant que la page n'est pas rechargée.
  onSyncWithServer: () => Promise<void>;
}

const SUGGESTIONS = [
  "Ajoute une section avec 3 avantages : livraison rapide, paiement sécurisé, support réactif",
  "Mets le titre principal plus grand et centré",
  "Ajoute une grille de nos produits en bas de page",
];

export function AxiaBuilderPanel({ onSyncWithServer }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const envoyer = async (texte: string) => {
    const contenu = texte.trim();
    if (!contenu || loading) return;
    const historique = [...messages, { role: "user" as const, content: contenu }];
    setMessages(historique);
    setInput("");
    setLoading(true);
    try {
      await onSyncWithServer();
      const messagesEnvoyes = historique.map((m, i) =>
        i === historique.length - 1
          ? { ...m, content: `[Contexte : le marchand est dans le Constructeur libre, en train de composer la page d'accueil de sa boutique.] ${m.content}` }
          : m
      );
      const res = await fetch("/api/ai/axia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesEnvoyes, stream: false, fast: false }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reponse || "Je n'ai pas pu traiter cette demande." }]);
      await onSyncWithServer();
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "AXIA a rencontré une erreur momentanée — réessaie dans un instant." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[340px] h-[440px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-3.5 py-2.5 flex items-center justify-between flex-shrink-0" style={{ background: "linear-gradient(135deg,#0a0a0a,#1a1200)" }}>
            <div className="flex items-center gap-1.5 text-white">
              <Sparkles size={13} style={{ color: "#F5A623" }} />
              <span className="text-xs font-bold">AXIA</span>
              <span className="text-[9px] text-white/50">— personnalise ta page</span>
            </div>
            <button onClick={() => setOpen(false)} className="w-6 h-6 flex items-center justify-center text-white/60 hover:text-white rounded"><X size={13} /></button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2.5">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 leading-relaxed">Décris ce que tu veux changer sur ta page — AXIA ajoute, modifie ou réorganise les blocs à ta place.</p>
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => envoyer(s)} className="w-full text-left text-[11px] px-2.5 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-[#F5A623]/50 hover:bg-[#F5A623]/5 transition-all">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[12px] leading-snug whitespace-pre-wrap ${m.role === "user" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-800"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl px-2.5 py-1.5 bg-gray-100 text-gray-400 flex items-center gap-1.5 text-[11px]">
                  <Loader2 size={11} className="animate-spin" /> AXIA travaille sur ta page...
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); envoyer(input); }}
            className="flex items-center gap-1.5 p-2 border-t border-gray-200 flex-shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex : ajoute un bandeau promo en haut..."
              disabled={loading}
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:border-[#F5A623] outline-none disabled:opacity-50"
            />
            <button type="submit" disabled={loading || !input.trim()} className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg disabled:opacity-40" style={{ backgroundColor: "#F5A623", color: "#050508" }}>
              <Send size={13} />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ background: "linear-gradient(135deg,#0a0a0a,#1a1200)" }}
        title="Ouvrir AXIA"
      >
        {open ? <X size={18} className="text-white" /> : <Sparkles size={18} style={{ color: "#F5A623" }} />}
      </button>
    </div>
  );
}
