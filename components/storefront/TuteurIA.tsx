"use client";
// Tuteur IA du lecteur de formation (lib/academie/tuteur.ts) : répond uniquement à partir des leçons
// ouvertes à l'apprenant, cite ses extraits ; sur un quiz, seul le mode « indice » est proposé.
import { useState } from "react";
import { Bot, Loader2, Send, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";

type Mode = "question" | "indice" | "resume" | "exercices";
type Message = { de: "moi" | "tuteur"; texte: string; sources?: { leconId: string; titre: string }[] };

export function TuteurIA(p: { api: string; leconId: string | null; quiz: boolean; accent: string; fond: string; texte: string; onOuvrir: (leconId: string) => void }) {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [envoi, setEnvoi] = useState(false);

  async function demander(mode: Mode, q: string) {
    if (envoi || q.trim().length < 2) return;
    setEnvoi(true);
    setMessages((m) => [...m, { de: "moi", texte: q }]);
    setQuestion("");
    const r = await fetch(`${p.api}/tuteur`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q, mode: p.quiz ? "indice" : mode, ...(p.leconId && { leconId: p.leconId }) }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setMessages((m) => [...m, r?.ok && d ? { de: "tuteur", texte: d.reponse, sources: d.sources } : { de: "tuteur", texte: d?.error ?? t("Le tuteur est momentanément indisponible.") }]);
    setEnvoi(false);
  }

  if (!ouvert) {
    return (
      <button onClick={() => setOuvert(true)} className="fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-sm font-bold" style={{ background: p.accent, color: p.fond }}>
        <Bot size={16} />{t("Tuteur IA")}
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-5 sm:right-5 z-40 w-full sm:w-96 h-[70vh] sm:h-[32rem] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-2xl border" style={{ background: p.fond, color: p.texte, borderColor: `${p.accent}25` }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: `${p.accent}18` }}>
        <Bot size={16} style={{ color: p.accent }} />
        <p className="flex-1 text-sm font-bold">{t("Tuteur IA")}</p>
        <button onClick={() => setOuvert(false)} aria-label={t("Fermer")} className="p-1 opacity-60"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
        <p className="text-xs opacity-60">
          {p.quiz ? t("Tu es sur un quiz : je te donne des indices, jamais la réponse.") : t("Je réponds uniquement à partir des leçons auxquelles tu as accès, avec mes sources.")}
        </p>
        {messages.map((m, i) => (
          <div key={i} className={m.de === "moi" ? "text-right" : ""}>
            <div className="inline-block text-left px-3 py-2 rounded-xl whitespace-pre-wrap max-w-[90%]" style={{ background: m.de === "moi" ? `${p.accent}20` : `${p.accent}0a` }}>{m.texte}</div>
            {m.sources?.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {m.sources.map((s, j) => (
                  <button key={j} onClick={() => p.onOuvrir(s.leconId)} className="text-[11px] underline opacity-70">[{j + 1}] {s.titre}</button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {envoi && <Loader2 size={16} className="animate-spin opacity-60" />}
      </div>
      {!p.quiz && p.leconId && (
        <div className="flex gap-2 px-4 pb-2">
          <button disabled={envoi} onClick={() => demander("resume", t("Résume cette leçon"))} className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${p.accent}30` }}>{t("Résumé")}</button>
          <button disabled={envoi} onClick={() => demander("exercices", t("Propose-moi des exercices"))} className="text-xs px-2.5 py-1 rounded-full" style={{ border: `1px solid ${p.accent}30` }}>{t("Exercices")}</button>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); demander("question", question); }} className="flex gap-2 px-4 pb-4 pt-1">
        <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={800} placeholder={p.quiz ? t("Demande un indice…") : t("Pose ta question…")}
          className="flex-1 px-3 py-2 rounded-xl text-sm bg-transparent outline-none" style={{ border: `1px solid ${p.accent}30` }} />
        <button type="submit" disabled={envoi || question.trim().length < 2} aria-label={t("Envoyer")} className="px-3 rounded-xl disabled:opacity-40" style={{ background: p.accent, color: p.fond }}><Send size={14} /></button>
      </form>
    </div>
  );
}
