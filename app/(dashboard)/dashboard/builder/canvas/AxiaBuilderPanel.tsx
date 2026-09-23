"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, X, Send, Loader2, PanelRightClose, PanelRightOpen } from "lucide-react";
import { IconAxia } from "@/components/dashboard/AppIcons";

interface Msg { role: "user" | "assistant"; content: string }

interface Props {
  // Flush les changements locaux non sauvegardés vers le serveur avant
  // qu'AXIA ne lise l'arbre, puis recharge le config depuis le serveur après
  // sa réponse (les outils AXIA écrivent directement en base, comme tout le
  // reste du système AXIA — voir lib/axia/tools.ts) : ce garde-fou évite
  // qu'AXIA écrase un changement en cours d'édition, ou que son résultat
  // n'apparaisse pas tant que la page n'est pas rechargée.
  onSyncWithServer: () => Promise<void>;
  // Ouvert par défaut pour une page de vente digitale (variante "landing" du
  // canevas) — dans l'esprit Lovable, chat-first plutôt qu'une bulle repliée
  // qu'il faut découvrir. Une boutique physique garde la bulle repliée par défaut.
  defaultOpen?: boolean;
  variante?: "boutique" | "landing";
  // Décale la bulle vers la gauche quand un panneau occupe le bord droit.
  decalageDroite?: number;
}

const SUGGESTIONS_BOUTIQUE = [
  "Ajoute une section avec 3 avantages : livraison rapide, paiement sécurisé, support réactif",
  "Mets le titre principal plus grand et centré",
  "Ajoute une grille de nos produits en bas de page",
];

const SUGGESTIONS_LANDING = [
  "Crée une page de vente pour ma formation : accroche, avantages, témoignages, FAQ et bouton d'achat",
  "Ajoute un compte à rebours avant le bouton d'achat",
  "Ajoute une FAQ avec les questions qu'on me pose le plus",
];

function useAxiaChat(onSyncWithServer: () => Promise<void>) {
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

  return { messages, input, setInput, loading, scrollRef, envoyer };
}

function ChatBody({ messages, loading, scrollRef, suggestions, onSuggestion }: { messages: Msg[]; loading: boolean; scrollRef: React.RefObject<HTMLDivElement | null>; suggestions: string[]; onSuggestion: (s: string) => void }) {
  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-3">
      {messages.length === 0 && (
        <div className="space-y-3">
          <p className="text-[14px] text-[#666666] leading-relaxed">Décris ce que tu veux changer sur ta page : AXIA ajoute, modifie ou réorganise les sections à ta place.</p>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[#999999] pt-1">Suggestions</p>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <button key={s} onClick={() => onSuggestion(s)}
                className="w-full text-left text-[13.5px] leading-snug px-3.5 py-2.5 rounded-xl border border-[#E8E8E8] bg-white text-[#333333] hover:border-[#F5A623] hover:bg-[#FFF7EA] transition-colors">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-[#111111] text-white rounded-br-md" : "bg-[#F4F4F5] text-[#111111] rounded-bl-md"}`}>
            {m.content}
          </div>
        </div>
      ))}
      {loading && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-[#F4F4F5] text-[#666666] flex items-center gap-2 text-[14px]">
            <Loader2 size={14} className="animate-spin text-[#F5A623]" /> AXIA travaille sur ta page…
          </div>
        </div>
      )}
    </div>
  );
}

function ChatInput({ input, setInput, loading, onSubmit }: { input: string; setInput: (v: string) => void; loading: boolean; onSubmit: () => void }) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex items-center gap-2 p-3 border-t border-[#EEEEEE] flex-shrink-0">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ex : ajoute un bandeau promo en haut…"
        disabled={loading}
        aria-label="Message pour AXIA"
        className="flex-1 min-w-0 h-11 px-3.5 text-[14px] rounded-xl border border-[#E0E0E0] bg-white text-[#111111] placeholder:text-[#AAAAAA] focus:border-[#F5A623] focus:ring-2 focus:ring-[#F5A623]/20 outline-none disabled:opacity-50"
      />
      <button type="submit" disabled={loading || !input.trim()} aria-label="Envoyer"
        className="w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#F5A623] text-[#111111] hover:bg-[#E8990F] disabled:opacity-40 transition-colors">
        <Send size={16} />
      </button>
    </form>
  );
}

// Boutique (physique) : bulle flottante repliable — l'IA est un coup de
// pouce ponctuel, le constructeur reste centré sur le canevas/plan de page
// façon Shopify. Landing (digital) : voir AxiaDockedPanel ci-dessous — rail
// permanent façon Lovable, l'IA est le point d'entrée principal.
function AxiaFloatingBubble({ onSyncWithServer, defaultOpen, variante, decalageDroite = 0 }: { onSyncWithServer: () => Promise<void>; defaultOpen: boolean; variante: "boutique" | "landing"; decalageDroite?: number }) {
  const [open, setOpen] = useState(defaultOpen);
  const suggestions = variante === "landing" ? SUGGESTIONS_LANDING : SUGGESTIONS_BOUTIQUE;
  const { messages, input, setInput, loading, scrollRef, envoyer } = useAxiaChat(onSyncWithServer);

  return (
    <div className="fixed bottom-5 z-30 flex flex-col items-end gap-3 transition-[right] duration-300" style={{ right: 20 + decalageDroite }}>
      {open && (
        <div role="dialog" aria-label="AXIA" className="w-[380px] h-[520px] max-h-[calc(100vh-140px)] bg-white rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.18)] border border-[#E8E8E8] flex flex-col overflow-hidden">
          <div className="px-4 h-14 flex items-center justify-between flex-shrink-0 bg-[#111111]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-[#F5A623]/15 flex items-center justify-center flex-shrink-0"><Sparkles size={16} className="text-[#F5A623]" /></span>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-white leading-tight">AXIA</p>
                <p className="text-[12px] text-white/55 leading-tight">Personnalise ta page</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer AXIA" className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10"><X size={16} /></button>
          </div>
          <ChatBody messages={messages} loading={loading} scrollRef={scrollRef} suggestions={suggestions} onSuggestion={envoyer} />
          <ChatInput input={input} setInput={setInput} loading={loading} onSubmit={() => envoyer(input)} />
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.22)] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 bg-[#111111]"
        title={open ? "Fermer AXIA" : "Ouvrir AXIA"}
        aria-label={open ? "Fermer AXIA" : "Ouvrir AXIA"}
      >
        {open ? <X size={20} className="text-white" /> : <IconAxia size={44} />}
      </button>
    </div>
  );
}

// Landing (digital) : rail permanent à droite, occupe l'espace comme
// BlockStylePanel plutôt qu'une bulle flottante par-dessus le canevas — le
// signal visuel voulu (« on sent la différence ») : une page de vente
// digitale s'ouvre sur un vrai poste de pilotage IA, pas un outil qu'on
// découvre. Repliable en rail étroit (icône seule) pour rendre de la place
// au canevas sans revenir à une bulle superposée.
function AxiaDockedPanel({ onSyncWithServer }: { onSyncWithServer: () => Promise<void> }) {
  const [collapsed, setCollapsed] = useState(false);
  const { messages, input, setInput, loading, scrollRef, envoyer } = useAxiaChat(onSyncWithServer);

  if (collapsed) {
    return (
      <div className="w-14 flex-shrink-0 h-full flex flex-col items-center pt-3 gap-3" style={{ background: "linear-gradient(180deg,#0a0a0a,#1a1200)" }}>
        <button onClick={() => setCollapsed(false)} title="Ouvrir AXIA" className="w-9 h-9 flex items-center justify-center rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all">
          <PanelRightOpen size={16} />
        </button>
        <IconAxia size={30} />
      </div>
    );
  }

  return (
    <div className="w-[360px] flex-shrink-0 h-full bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ background: "linear-gradient(135deg,#0a0a0a,#1a1200)" }}>
        <div className="flex items-center gap-2 text-white">
          <IconAxia size={22} />
          <div>
            <p className="text-sm font-bold leading-none">AXIA</p>
            <p className="text-[11px] text-white/50 mt-0.5">Construis ta page de vente</p>
          </div>
        </div>
        <button onClick={() => setCollapsed(true)} title="Réduire" className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-white rounded-lg hover:bg-white/10">
          <PanelRightClose size={15} />
        </button>
      </div>
      <ChatBody messages={messages} loading={loading} scrollRef={scrollRef} suggestions={SUGGESTIONS_LANDING} onSuggestion={envoyer} />
      <ChatInput input={input} setInput={setInput} loading={loading} onSubmit={() => envoyer(input)} />
    </div>
  );
}

export function AxiaBuilderPanel({ onSyncWithServer, defaultOpen = false, variante = "boutique", decalageDroite }: Props) {
  if (variante === "landing") return <AxiaDockedPanel onSyncWithServer={onSyncWithServer} />;
  return <AxiaFloatingBubble onSyncWithServer={onSyncWithServer} defaultOpen={defaultOpen} variante={variante} decalageDroite={decalageDroite} />;
}
