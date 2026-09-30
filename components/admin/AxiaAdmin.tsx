"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Check, Loader2 } from "lucide-react";
import { IconAxia } from "@/components/dashboard/AppIcons";
import { useT } from "@/components/I18nProvider";

type Confirmation = { id: string; message: string; etat?: "en_cours" | "fait" | "echec" | "refuse"; resultat?: string };
type Message = { role: "user" | "assistant"; content: string; confirmations?: Confirmation[] };

const ACCENT = "#F5A623";

/** AXIA, assistante de l'administrateur — bulle fixe en bas à droite de toute l'administration. */
export function AxiaAdmin() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/axia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.slice(-40).map(({ role, content }) => ({ role, content })) }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reponse || t("Je n'ai pas pu traiter ta demande."), confirmations: data.confirmations }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: t("Désolée, je rencontre une difficulté technique. Réessaie dans un instant.") }]);
    } finally {
      setLoading(false);
    }
  }

  function majConfirmation(id: string, maj: Partial<Confirmation>) {
    setMessages(prev => prev.map(m => m.confirmations?.some(c => c.id === id)
      ? { ...m, confirmations: m.confirmations.map(c => (c.id === id ? { ...c, ...maj } : c)) }
      : m));
  }

  async function decider(c: Confirmation, decision: "accepter" | "refuser") {
    majConfirmation(c.id, { etat: "en_cours" });
    try {
      const res = await fetch("/api/admin/axia/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, decision }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) majConfirmation(c.id, { etat: "echec", resultat: data.error || t("Erreur") });
      else if (decision === "refuser") majConfirmation(c.id, { etat: "refuse" });
      else majConfirmation(c.id, { etat: data.succes ? "fait" : "echec", resultat: data.resultat });
    } catch {
      majConfirmation(c.id, { etat: "echec", resultat: t("Erreur réseau") });
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ background: ACCENT }}
        aria-label={t("Ouvrir AXIA")}
      >
        <IconAxia size={48} />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
      style={{ width: 360, height: 520, maxHeight: "calc(100vh - 48px)", background: "white", border: "1px solid #F0F0F0" }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0" style={{ background: ACCENT }}>
        <div className="flex items-center gap-2">
          <IconAxia size={20} />
          <div>
            <p className="text-[13px] font-semibold leading-tight">AXIA</p>
            <p className="text-[10px] text-white/80 leading-tight">{t("Assistante de l'administrateur")}</p>
          </div>
        </div>
        <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" aria-label={t("Fermer")}>
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-[13px]">
        {messages.length === 0 && (
          <p className="text-[#888] leading-relaxed">
            {t("Bonjour ! Je suis AXIA. Demande-moi les chiffres de la plateforme, ou ce que tu veux faire : suspendre une boutique, changer un plan, publier sur AxSocial… Je te demande toujours ton accord avant d'agir.")}
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[85%] px-3 py-2 rounded-xl leading-relaxed whitespace-pre-wrap"
              style={msg.role === "user"
                ? { background: ACCENT, color: "white", borderBottomRightRadius: 4 }
                : { background: "#F5F5F5", color: "#111", borderBottomLeftRadius: 4 }}
            >
              {msg.content}
              {msg.confirmations?.map(c => (
                <div key={c.id} className="mt-2 rounded-lg p-2.5 bg-white" style={{ border: `1px solid ${ACCENT}66` }}>
                  <p className="text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#B7791F" }}>{t("Ton accord est nécessaire")}</p>
                  <p className="text-[12px] leading-snug">{c.message}</p>
                  {c.etat === "fait" || c.etat === "echec" || c.etat === "refuse" ? (
                    <p className={`text-[12px] mt-1.5 font-semibold ${c.etat === "fait" ? "text-green-600" : c.etat === "echec" ? "text-red-600" : "text-[#888]"}`}>
                      {c.etat === "refuse" ? t("Refusé.") : c.resultat}
                    </p>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => decider(c, "accepter")} disabled={c.etat === "en_cours"}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>
                        {c.etat === "en_cours" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}{t("Autoriser")}
                      </button>
                      <button onClick={() => decider(c, "refuser")} disabled={c.etat === "en_cours"}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#666] hover:bg-black/5">{t("Refuser")}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {loading && <p className="text-[11px] text-[#888]">{t("AXIA réfléchit…")}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#F0F0F0] px-3 py-2.5 flex items-end gap-2 shrink-0">
        <textarea
          className="flex-1 resize-none text-[13px] border-0 outline-none bg-transparent max-h-24 leading-relaxed text-[#111]"
          placeholder={t("Pose ta question…")}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          style={{ fontFamily: "inherit" }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40"
          style={{ background: ACCENT }}
          aria-label={t("Envoyer")}
        >
          <Send size={13} className="text-white" />
        </button>
      </div>
    </div>
  );
}
