"use client";
// « Ask Axso » : questions en langage naturel, réponses construites UNIQUEMENT à
// partir des métriques calculées (réponse, preuves, métriques, entités, actions).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Sparkles, X, Send, Loader2, AlertTriangle, ArrowRight } from "lucide-react";

export interface ReponseCopilote {
  question: string;
  reponse: string;
  preuves: string[];
  metriques: { nom: string; valeur: string; variation?: string; ton?: "good" | "bad" | "neutre" }[];
  entites: { nom: string; detail?: string; href?: string }[];
  actions: { titre: string; href?: string }[];
  confiance: "elevee" | "moyenne" | "faible";
  hypothese: boolean;
}

const SUGGESTIONS = [
  "Pourquoi le revenu a-t-il baissé ?",
  "Quels sont mes meilleurs marchés ?",
  "Quels marchands risquent de partir ?",
  "Qu'est-ce qui a causé la baisse d'activation ?",
  "Quelles fonctionnalités promouvoir ?",
  "Donne-moi un plan pour augmenter le MRR de 20 %",
];

export function Copilote({ contexte }: { contexte: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [fil, setFil] = useState<ReponseCopilote[]>([]);
  const [charge, setCharge] = useState(false);
  const bas = useRef<HTMLDivElement>(null);

  const demander = async (question: string) => {
    if (!question.trim() || charge) return;
    setQ(""); setCharge(true);
    try {
      const r = await fetch(`/api/admin/command-center/copilote${contexte}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      const d = await r.json();
      setFil((f) => [...f, r.ok ? d : { question, reponse: d?.erreur ?? "La réponse n'a pas pu être calculée.", preuves: [], metriques: [], entites: [], actions: [], confiance: "faible", hypothese: false }]);
    } catch {
      setFil((f) => [...f, { question, reponse: "Connexion impossible. Réessayez.", preuves: [], metriques: [], entites: [], actions: [], confiance: "faible", hypothese: false }]);
    } finally { setCharge(false); }
  };

  useEffect(() => {
    const ouvrir = (e: Event) => { setOuvert(true); const d = (e as CustomEvent<string>).detail; if (d) demander(d); };
    window.addEventListener("cc:copilote", ouvrir);
    return () => window.removeEventListener("cc:copilote", ouvrir);
  });
  useEffect(() => { bas.current?.scrollIntoView({ behavior: "smooth" }); }, [fil, charge]);

  if (!ouvert) return null;
  return (
    <aside className="fixed inset-y-0 right-0 z-[60] w-full sm:w-[440px] flex flex-col border-l cc-sep cc-no-print" style={{ background: "var(--cc-surface)", boxShadow: "var(--cc-shadow)" }} aria-label="Ask Axso">
      <div className="h-14 px-4 flex items-center gap-2 border-b cc-sep">
        <Sparkles size={16} style={{ color: "var(--cc-accent)" }} aria-hidden />
        <div><p className="text-[14px] font-semibold">Ask Axso</p><p className="text-[11px] cc-faint">Réponses calculées sur les données affichées, filtres compris</p></div>
        <button onClick={() => setOuvert(false)} className="ml-auto cc-btn cc-btn-ghost cc-btn-sm" aria-label="Fermer"><X size={15} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {!fil.length && (
          <div className="space-y-2">
            <p className="cc-faint text-[12.5px]">Exemples :</p>
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => demander(s)} className="block w-full text-left text-[13px] px-3 py-2 rounded-lg border cc-sep cc-hover">{s}</button>)}
          </div>
        )}
        {fil.map((r, i) => (
          <div key={i} className="space-y-3 cc-fade">
            <p className="text-[13px] font-medium px-3 py-2 rounded-lg ml-8" style={{ background: "var(--cc-surface-2)" }}>{r.question}</p>
            <div className="space-y-3">
              {r.hypothese && <p className="flex items-center gap-1.5 text-[11.5px] cc-warn"><AlertTriangle size={12} aria-hidden />Hypothèse à vérifier, pas un fait établi.</p>}
              <p className="text-[13.5px] leading-relaxed whitespace-pre-line">{r.reponse}</p>
              {r.metriques.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {r.metriques.map((m) => (
                    <div key={m.nom} className="rounded-lg border cc-sep px-2.5 py-2">
                      <p className="text-[11px] cc-faint truncate">{m.nom}</p>
                      <p className="text-[14px] font-semibold cc-num">{m.valeur}</p>
                      {m.variation && <p className={`text-[11px] cc-num ${m.ton === "good" ? "cc-good" : m.ton === "bad" ? "cc-bad" : "cc-faint"}`}>{m.variation}</p>}
                    </div>
                  ))}
                </div>
              )}
              {r.preuves.length > 0 && (
                <div><p className="cc-eyebrow mb-1">Éléments factuels</p><ul className="space-y-1 text-[12.5px] cc-muted list-disc pl-4">{r.preuves.map((p, k) => <li key={k}>{p}</li>)}</ul></div>
              )}
              {r.entites.length > 0 && (
                <div><p className="cc-eyebrow mb-1">Concernés</p><ul className="space-y-0.5">{r.entites.slice(0, 8).map((e, k) => <li key={k} className="text-[12.5px] flex justify-between gap-2">{e.href ? <Link href={e.href} className="hover:underline truncate">{e.nom}</Link> : <span className="truncate">{e.nom}</span>}<span className="cc-faint shrink-0">{e.detail}</span></li>)}</ul></div>
              )}
              {r.actions.length > 0 && (
                <div><p className="cc-eyebrow mb-1">Actions recommandées</p><ol className="space-y-1">{r.actions.map((a, k) => <li key={k} className="text-[12.5px]">{a.href ? <Link href={a.href} className="inline-flex items-center gap-1 hover:underline" style={{ color: "var(--cc-accent-text)" }}>{k + 1}. {a.titre}<ArrowRight size={11} /></Link> : `${k + 1}. ${a.titre}`}</li>)}</ol></div>
              )}
              <p className="text-[11px] cc-faint">Confiance : {r.confiance === "elevee" ? "élevée" : r.confiance}</p>
            </div>
          </div>
        ))}
        {charge && <p className="flex items-center gap-2 text-[12.5px] cc-faint"><Loader2 size={13} className="animate-spin" />Analyse des données…</p>}
        <div ref={bas} />
      </div>
      <form className="p-3 border-t cc-sep flex gap-2" onSubmit={(e) => { e.preventDefault(); demander(q); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Posez une question sur Axso…" className="cc-input flex-1" maxLength={300} aria-label="Question" autoFocus />
        <button className="cc-btn cc-btn-primary" disabled={charge || !q.trim()} aria-label="Envoyer"><Send size={14} /></button>
      </form>
    </aside>
  );
}
