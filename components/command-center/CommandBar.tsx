"use client";
// Recherche globale Ctrl/Cmd + K : pages, métriques, rapports, pays, fonctionnalités,
// marchands et commandes (côté serveur), et questions → Ask Axso.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Sparkles, Store, Hash, BarChart3, FileText, Globe2, Boxes, LayoutDashboard, Receipt } from "lucide-react";
import { NAV } from "@/lib/command-center/navigation";
import { METRIQUES } from "@/lib/command-center/moteur";
import { PAYS, NOM_FONCTION, FONCTIONS } from "@/lib/command-center/types";
import { NOM_RAPPORT } from "@/lib/command-center/reglages";
import { sectionDe, type Section } from "@/lib/command-center/rbac";
import type { Source } from "@/lib/command-center/types";
import { useT } from "@/components/I18nProvider";

type Resultat = { id: string; type: string; titre: string; sous?: string; href?: string; question?: string; fr?: string };
const ICONE: Record<string, typeof Search> = { Page: LayoutDashboard, Métrique: BarChart3, Rapport: FileText, Pays: Globe2, Fonctionnalité: Boxes, Marchand: Store, Commande: Receipt, Action: Hash, Question: Sparkles };

const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const QUESTION = /^(why|pourquoi|quel|quels|quelle|quelles|comment|combien|show|which|what|how|give|donne|montre|explique|qu)/i;

export function CommandBar({ sections, contexte, source }: { sections: Section[]; contexte: string; source: Source }) {
  const t = useT();
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [distants, setDistants] = useState<Resultat[]>([]);
  const champ = useRef<HTMLInputElement>(null);
  const voit = (s: Section) => sections.includes(s);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOuvert((o) => !o); } if (e.key === "Escape") setOuvert(false); };
    const ouvrir = () => setOuvert(true);
    window.addEventListener("keydown", touche);
    window.addEventListener("cc:recherche", ouvrir);
    return () => { window.removeEventListener("keydown", touche); window.removeEventListener("cc:recherche", ouvrir); };
  }, []);
  useEffect(() => { if (ouvert) { setQ(""); setSel(0); setTimeout(() => champ.current?.focus(), 10); } }, [ouvert]);

  const index = useMemo<Resultat[]>(() => {
    const avec = (h: string) => (h.includes("?") ? h + contexte.replace("?", "&") : h + contexte);
    return [
      ...NAV.filter((n) => voit(n.section)).map((n) => ({ id: `p:${n.href}`, type: "Page", titre: t(n.nom), fr: n.nom, sous: n.mots, href: n.gestion ? n.href : avec(n.href) })),
      ...METRIQUES.filter((m) => voit(sectionDe(m.page))).map((m) => ({ id: `m:${m.id}`, type: "Métrique", titre: t(m.nom), fr: `${m.nom} ${m.description}`, sous: t(m.description), href: avec(m.page) })),
      ...(voit("rapports") ? Object.entries(NOM_RAPPORT).map(([k, v]) => ({ id: `r:${k}`, type: "Rapport", titre: t(v), fr: v, href: avec(`/admin/rapports/${k}`) })) : []),
      ...(voit("geographie") ? Object.entries(PAYS).map(([k, v]) => ({ id: `c:${k}`, type: "Pays", titre: t("Axso au {0}", t(v)).replace("au Côte", "en Côte").replace("au RD", "en RD"), fr: v, sous: t(v), href: `/admin/geographie${contexte}${contexte ? "&" : "?"}pays=${k}` })) : []),
      ...(voit("produit") ? FONCTIONS.map((f) => ({ id: `f:${f}`, type: "Fonctionnalité", titre: t(NOM_FONCTION[f]), fr: NOM_FONCTION[f], href: avec("/admin/produit") })) : []),
      ...(voit("succes") ? [
        { id: "a:risque", type: "Action", titre: t("Marchands à risque de churn"), fr: "Marchands à risque de churn", sous: "show merchants at risk churn radar", href: avec("/admin/succes-client") },
        { id: "a:expansion", type: "Action", titre: t("Candidats à l'upgrade"), fr: "Candidats à l'upgrade", sous: "expansion upgrade pro illimité", href: avec("/admin/succes-client#expansion") },
      ] : []),
      ...(voit("paiements") ? [{ id: "a:echecs", type: "Action", titre: t("Paiements échoués"), fr: "Paiements échoués", sous: "show failed payments", href: avec("/admin/paiements") }] : []),
      ...(voit("marchands") ? [{ id: "a:top", type: "Action", titre: t("Top marchands du mois"), fr: "Top marchands du mois", sous: "top merchants this month gmv", href: avec("/admin/marchands") }] : []),
    ];
  }, [contexte, sections, t]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (q.trim().length < 2 || !voit("marchands")) { setDistants([]); return; }
    const c = new AbortController();
    const minuterie = setTimeout(() => {
      fetch(`/api/admin/command-center/recherche?q=${encodeURIComponent(q.trim())}&source=${source}`, { signal: c.signal })
        .then((r) => (r.ok ? r.json() : { resultats: [] })).then((d) => setDistants(d.resultats ?? [])).catch(() => {});
    }, 180);
    return () => { clearTimeout(minuterie); c.abort(); };
  }, [q, source]); // eslint-disable-line react-hooks/exhaustive-deps

  const resultats = useMemo(() => {
    const n = sansAccent(q.trim());
    const locaux = !n ? index.filter((r) => r.type === "Page").slice(0, 8) : index.filter((r) => n.split(/\s+/).every((mot) => sansAccent(`${r.titre} ${r.fr ?? ""} ${r.sous ?? ""} ${r.type} ${t(r.type)}`).includes(mot))).slice(0, 12);
    const question: Resultat[] = q.trim().length > 3 && (QUESTION.test(q.trim()) || q.includes("?") || locaux.length === 0) ? [{ id: "q", type: "Question", titre: t("Demander à Axso : « {0} »", q.trim()), question: q.trim() }] : [];
    return [...question, ...locaux, ...distants.map((d) => ({ ...d, href: d.href ? d.href + (contexte ? (d.href.includes("?") ? "&" : "?") + contexte.slice(1) : "") : d.href }))];
  }, [q, index, distants, contexte, t]);

  const choisir = (r: Resultat) => {
    setOuvert(false);
    if (r.question) window.dispatchEvent(new CustomEvent("cc:copilote", { detail: r.question }));
    else if (r.href) router.push(r.href);
  };

  if (!ouvert) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-3 bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && setOuvert(false)} role="dialog" aria-modal="true" aria-label={t("Recherche globale")}>
      <div className="cc-card w-full max-w-xl overflow-hidden" style={{ boxShadow: "var(--cc-shadow)" }}>
        <div className="flex items-center gap-2 px-3 border-b cc-sep">
          <Search size={16} className="cc-faint" aria-hidden />
          <input ref={champ} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} placeholder={t("Marchand, commande, métrique, pays… ou une question")}
            className="flex-1 h-12 bg-transparent outline-none text-[14px]" aria-label={t("Rechercher")}
            onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, resultats.length - 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } if (e.key === "Enter" && resultats[sel]) choisir(resultats[sel]); }} />
          <kbd className="text-[10.5px] px-1.5 rounded border cc-sep cc-faint">{t("Échap")}</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5" role="listbox">
          {resultats.length === 0 && <li className="px-3 py-6 text-center cc-faint text-[13px]">{t("Aucun résultat")}</li>}
          {resultats.map((r, i) => {
            const I = ICONE[r.type] ?? Hash;
            return (
              <li key={r.id} role="option" aria-selected={i === sel}>
                <button onMouseEnter={() => setSel(i)} onClick={() => choisir(r)} className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-left" style={i === sel ? { background: "var(--cc-surface-2)" } : undefined}>
                  <I size={15} className={r.type === "Question" ? "" : "cc-faint"} style={r.type === "Question" ? { color: "var(--cc-accent)" } : undefined} aria-hidden />
                  <span className="min-w-0 flex-1"><span className="block text-[13px] truncate">{r.titre}</span>{r.sous && r.type !== "Page" && <span className="block text-[11.5px] cc-faint truncate">{r.sous}</span>}</span>
                  <span className="text-[11px] cc-faint shrink-0">{t(r.type)}</span>
                  {i === sel && <CornerDownLeft size={12} className="cc-faint" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

