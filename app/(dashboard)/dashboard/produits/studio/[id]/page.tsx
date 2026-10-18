"use client";

// Un studio de l'AI Course Studio : 1 curriculum → 2 validation → 3 leçons → 4 contrôle qualité
// → 5 aperçu → 6 publication. Toute génération affiche son coût estimé et attend l'accord.
// La file de tâches avance tant que cette page est ouverte (et via le cron sinon).
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Loader2, Sparkles, CheckCircle2, RotateCcw, History, Archive, AlertTriangle, ChevronDown, ChevronRight, Send, Pencil, X,
} from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { STATUT_STUDIO } from "../statuts";

interface Alerte { type: string; extrait: string; raison: string }
interface Element { id: string; type: string; parentId: string | null; ordre: number; titre: string; contenu: any; statut: string; version: number; alertes: Alerte[]; erreur: string | null; publieId: string | null }
interface Tache { id: string; type: string; cible: string | null; statut: string; progression: number; etape: string | null; erreur: string | null; tentatives: number; maxTentatives: number; coutEstime: number | null; coutReel: number | null }
interface Donnees {
  studio: { id: string; titre: string; statut: string; produitId: string | null; brief: any; elements: Element[] };
  etape: number; taches: Tache[]; budget: { plafond: number; depense: number; reste: number };
}
type TypeTache = "studio_curriculum" | "studio_lecon" | "studio_vente";

const ETAPES = ["Curriculum", "Validation", "Leçons", "Contrôle qualité", "Aperçu", "Publication"];
const bouton = "flex items-center gap-1.5 text-xs bg-white border border-[#E8E8E8] text-[#666666] px-3 py-1.5 rounded-lg hover:border-[#111111] hover:text-[#111111] disabled:opacity-50";
const principal = "flex items-center gap-1.5 text-sm bg-[#111111] text-white px-4 py-2 rounded-xl hover:bg-black disabled:opacity-50";

export default function StudioDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const [d, setD] = useState<Donnees | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const traitement = useRef(false);
  const api = `/api/academie/studio/${id}`;

  const charger = useCallback(async () => {
    const r = await fetch(api);
    if (r.ok) setD(await r.json());
    else toast.error((await r.json().catch(() => ({}))).error ?? t("Studio introuvable"));
  }, [api, t]);
  useEffect(() => { charger(); }, [charger]);

  const enAttente = d?.taches.some((x) => x.statut === "en_attente" || x.statut === "en_cours") ?? false;

  // Fait avancer la file tant qu'il reste des tâches (une route courte à la fois, compatible Vercel).
  useEffect(() => {
    if (!enAttente || traitement.current) return;
    traitement.current = true;
    (async () => {
      await fetch("/api/academie/studio/taches", { method: "POST" }).catch(() => null);
      await new Promise((r) => setTimeout(r, 1500));
      traitement.current = false;
      await charger();
    })();
  }, [enAttente, d, charger]);

  async function action(body: object, succes?: string) {
    setOccupe(true);
    const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setOccupe(false);
    if (!r.ok) { toast.error(j.error ?? t("Action impossible")); return null; }
    if (succes) toast.success(succes);
    await charger();
    return j;
  }

  async function generer(type: TypeTache, elementId?: string) {
    const e = await action({ action: "estimer", type, elementId });
    if (!e) return;
    if (!e.nombre) return toast.info(t("Rien à générer"));
    if (!e.budget.ok) return toast.error(e.budget.message);
    if (!window.confirm(`${e.nombre} ${t("génération(s) IA")} · ${t("coût estimé")} ${e.coutEstime} FCFA\n${t("Budget restant ce mois")} : ${e.budget.reste} FCFA.\n\n${t("Lancer ?")}`)) return;
    await action({ action: "lancer", type, elementId, accord: true }, t("Génération lancée"));
  }

  async function valider(el: Element) {
    const alertes = el.alertes.length > 0;
    if (alertes && !window.confirm(t("Le contrôle qualité signale des points (références, chiffres, certifications). Confirmes-tu les avoir vérifiés ?"))) return;
    await action({ action: "statut", elementId: el.id, statut: "valide", confirmerAlertes: alertes });
  }

  async function renommer(el: Element) {
    const titre = window.prompt(t("Nouveau titre"), el.titre)?.trim();
    if (titre && titre !== el.titre) await action({ action: "editer", elementId: el.id, titre });
  }

  if (!d) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>;

  const actifs = d.studio.elements.filter((e) => e.statut !== "archive");
  const pos = actifs.find((e) => e.type === "positionnement");
  const modules = actifs.filter((e) => e.type === "module").sort((a, b) => a.ordre - b.ordre);
  const lecons = actifs.filter((e) => e.type === "lecon").sort((a, b) => a.ordre - b.ordre);
  const vente = actifs.filter((e) => e.type === "page_vente" || e.type === "email").sort((a, b) => (a.type === b.type ? a.ordre - b.ordre : a.type === "page_vente" ? -1 : 1));
  const tachesActives = d.taches.filter((x) => ["en_attente", "en_cours", "echec"].includes(x.statut)).slice(0, 10);
  const basculer = (k: string) => setOuverts((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <div className="space-y-5">
      <Link href="/dashboard/produits/studio" className="text-xs text-[#666666] flex items-center gap-1 hover:text-[#111111]"><ArrowLeft size={12} />{t("Studio de cours IA")}</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#111111]">{d.studio.titre}</h1>
          <p className="text-xs text-[#AAAAAA] mt-1">{t("Budget IA")} : {d.budget.reste} / {d.budget.plafond} FCFA {t("restants ce mois")}</p>
        </div>
        <div className="flex gap-2">
          {enAttente && <button onClick={() => action({ action: "annuler" }, t("File annulée"))} disabled={occupe} className={bouton}><X size={11} />{t("Annuler la file")}</button>}
          <button onClick={() => window.confirm(t("Archiver ce studio ?")) && action({ action: "archiver" }, t("Studio archivé"))} disabled={occupe} className={bouton}><Archive size={11} />{t("Archiver")}</button>
        </div>
      </div>

      <ol className="flex flex-wrap gap-1.5">
        {ETAPES.map((e, i) => (
          <li key={e} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${i + 1 === d.etape ? "bg-[#111111] text-white" : i + 1 < d.etape ? "bg-[#ECFDF5] text-[#16A34A]" : "bg-[#F3F4F6] text-[#AAAAAA]"}`}>{i + 1}. {t(e)}</li>
        ))}
      </ol>

      {tachesActives.length > 0 && (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-4 space-y-2">
          {tachesActives.map((x) => (
            <div key={x.id} className="text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-[#111111]">{x.type === "studio_lecon" ? `${t("Leçon")} : ${d.studio.elements.find((e) => e.id === x.cible)?.titre ?? ""}` : x.type === "studio_vente" ? t("Page de vente et e-mails") : t("Curriculum")}</span>
                <span className={x.statut === "echec" ? "text-[#DC2626]" : "text-[#666666]"}>{x.etape} {x.tentatives > 1 && `(${x.tentatives}/${x.maxTentatives})`}</span>
              </div>
              {x.statut !== "echec" && <div className="h-1 rounded-full bg-[#F3F4F6] mt-1 overflow-hidden"><div className="h-full bg-[#F5A623] transition-all" style={{ width: `${x.progression}%` }} /></div>}
              {x.erreur && <p className="text-[#DC2626] mt-0.5">{x.erreur}</p>}
            </div>
          ))}
        </div>
      )}

      {!pos && (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm text-[#666666]">{t("Étape 1 : l'IA propose le positionnement et le programme (modules et leçons) à partir de ton brief.")}</p>
          <button onClick={() => generer("studio_curriculum")} disabled={occupe || enAttente} className={`${principal} mx-auto`}><Sparkles size={14} />{t("Proposer le curriculum")}</button>
        </div>
      )}

      {pos && (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-[#111111]">{t("Positionnement")}</p>
            <Statut s={pos.statut} />
          </div>
          <p className="text-sm text-[#333333]">{pos.contenu?.promesse}</p>
          {pos.contenu?.public_cible && <p className="text-xs text-[#666666]"><b>{t("Pour qui")} :</b> {pos.contenu.public_cible}</p>}
          {pos.contenu?.resultats?.length > 0 && <ul className="text-xs text-[#666666] list-disc pl-5">{pos.contenu.resultats.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>}
          <Alertes alertes={pos.alertes} />
          {d.etape === 2 && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[#F3F4F6]">
              <button onClick={() => action({ action: "valider_curriculum" }, t("Curriculum validé"))} disabled={occupe} className={principal}><CheckCircle2 size={14} />{t("Valider le curriculum")}</button>
              <button onClick={() => generer("studio_curriculum")} disabled={occupe || enAttente} className={bouton}><RotateCcw size={11} />{t("Proposer un autre curriculum")}</button>
            </div>
          )}
        </div>
      )}

      {modules.map((m) => {
        const ls = lecons.filter((l) => l.parentId === m.id);
        return (
          <div key={m.id} className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-[#111111]">{m.titre}</p>
              <div className="flex gap-1.5 items-center">
                <Statut s={m.statut} />
                <button onClick={() => renommer(m)} disabled={occupe} className={bouton} aria-label={t("Renommer")}><Pencil size={11} /></button>
                {d.etape >= 3 && <button onClick={() => generer("studio_lecon", m.id)} disabled={occupe} className={bouton}><RotateCcw size={11} />{t("Régénérer le module")}</button>}
              </div>
            </div>
            {m.contenu?.objectif && <p className="text-xs text-[#666666]">{m.contenu.objectif}</p>}
            <ul className="divide-y divide-[#F3F4F6]">
              {ls.map((l) => (
                <Lecon key={l.id} l={l} ouvert={ouverts.has(l.id)} basculer={() => basculer(l.id)} etape={d.etape} occupe={occupe}
                  generer={() => generer("studio_lecon", l.id)} valider={() => valider(l)} renommer={() => renommer(l)} action={action} />
              ))}
            </ul>
          </div>
        );
      })}

      {d.etape === 3 && lecons.some((l) => l.statut === "brouillon") && (
        <button onClick={() => generer("studio_lecon")} disabled={occupe || enAttente} className={principal}><Sparkles size={14} />{t("Rédiger les leçons restantes")}</button>
      )}

      {d.etape >= 5 && (
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 space-y-3">
          <p className="font-semibold text-[#111111]">{t("Page de vente et e-mails de lancement (brouillons)")}</p>
          {vente.map((v) => (
            <div key={v.id} className="border border-[#F3F4F6] rounded-xl p-3 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-[#111111]">{v.type === "email" ? `${t("E-mail")} ${v.ordre + 1} : ` : ""}{v.titre}</p>
                <div className="flex gap-1.5 items-center">
                  <Statut s={v.statut} />
                  {v.statut === "a_verifier" && <button onClick={() => valider(v)} disabled={occupe} className={bouton}><CheckCircle2 size={11} />{t("Valider")}</button>}
                </div>
              </div>
              <p className="text-xs text-[#666666] whitespace-pre-wrap line-clamp-6">{v.type === "email" ? v.contenu?.corps : v.contenu?.description}</p>
              <Alertes alertes={v.alertes} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => generer("studio_vente")} disabled={occupe || enAttente} className={bouton}><Sparkles size={11} />{vente.length ? t("Réécrire la page de vente") : t("Rédiger la page de vente et les e-mails")}</button>
            <button onClick={() => window.confirm(t("Publier crée (ou met à jour) la formation dans ta boutique, INACTIVE : tu la mets en vente toi-même. Continuer ?")) && action({ action: "publier" }, t("Formation publiée"))} disabled={occupe || enAttente} className={principal}><Send size={14} />{t("Publier en formation")}</button>
            {d.studio.produitId && <Link href={`/dashboard/produits/${d.studio.produitId}`} className={bouton}>{t("Voir le produit")}</Link>}
          </div>
        </div>
      )}
    </div>
  );
}

function Statut({ s }: { s: string }) {
  const t = useT();
  const st = STATUT_STUDIO[s] ?? STATUT_STUDIO.brouillon;
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.couleur, background: st.fond }}>{t(st.label)}</span>;
}

function Alertes({ alertes }: { alertes: Alerte[] }) {
  const t = useT();
  if (!alertes?.length) return null;
  return (
    <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-2.5 text-xs space-y-1">
      <p className="font-semibold text-[#92400E] flex items-center gap-1"><AlertTriangle size={12} />{t("Contrôle qualité : à vérifier")}</p>
      {alertes.slice(0, 8).map((a, i) => <p key={i} className="text-[#92400E]">« {a.extrait} » — {t(a.raison)}</p>)}
    </div>
  );
}

function Lecon({ l, ouvert, basculer, etape, occupe, generer, valider, renommer, action }: {
  l: Element; ouvert: boolean; basculer: () => void; etape: number; occupe: boolean;
  generer: () => void; valider: () => void; renommer: () => void; action: (b: object, s?: string) => Promise<any>;
}) {
  const t = useT();
  const [script, setScript] = useState<string | null>(null);
  const [versions, setVersions] = useState<{ version: number; origine: string; createdAt: string }[] | null>(null);
  const c = l.contenu ?? {};
  const redigee = !!c.script;

  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={basculer} disabled={!redigee} className="flex items-center gap-1.5 text-sm text-[#111111] text-left min-w-0 disabled:cursor-default">
          {redigee ? (ouvert ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3.5" />}
          <span className="truncate">{l.titre}</span>
          {c.duree_min ? <span className="text-[11px] text-[#AAAAAA]">{c.duree_min} min</span> : null}
          {l.alertes.length > 0 && <AlertTriangle size={12} className="text-[#D97706]" />}
        </button>
        <div className="flex gap-1.5 items-center">
          <Statut s={l.statut} />
          <button onClick={renommer} disabled={occupe || l.statut === "en_generation"} className={bouton} aria-label={t("Renommer")}><Pencil size={11} /></button>
          {etape >= 3 && l.statut !== "en_generation" && <button onClick={generer} disabled={occupe} className={bouton}>{redigee ? <RotateCcw size={11} /> : <Sparkles size={11} />}{redigee ? t("Régénérer") : t("Rédiger")}</button>}
          {l.statut === "a_verifier" && redigee && <button onClick={valider} disabled={occupe} className={bouton}><CheckCircle2 size={11} />{t("Valider")}</button>}
        </div>
      </div>
      {l.erreur && <p className="text-xs text-[#DC2626] mt-1">{l.erreur}</p>}
      {ouvert && redigee && (
        <div className="mt-3 ml-5 space-y-3 text-xs text-[#333333]">
          <Alertes alertes={l.alertes} />
          {c.plan?.length > 0 && <div><p className="font-semibold">{t("Plan")}</p><ul className="list-disc pl-5">{c.plan.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>}
          {script === null ? (
            <div>
              <div className="flex items-center gap-2"><p className="font-semibold">{t("Contenu")}</p><button onClick={() => setScript(c.script)} className="text-[#F5A623] hover:underline">{t("Modifier")}</button></div>
              <p className="whitespace-pre-wrap mt-1">{c.script}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={14} className="w-full border border-[#E8E8E8] rounded-xl p-3 text-xs" />
              <div className="flex gap-2">
                <button onClick={async () => { if (await action({ action: "editer", elementId: l.id, contenu: { ...c, script } }, t("Leçon enregistrée"))) setScript(null); }} disabled={occupe} className={bouton}>{t("Enregistrer")}</button>
                <button onClick={() => setScript(null)} className={bouton}>{t("Annuler")}</button>
              </div>
            </div>
          )}
          {c.exercices?.length > 0 && <div><p className="font-semibold">{t("Exercices")} ({c.exercices.length})</p><ul className="list-disc pl-5">{c.exercices.map((e: any, i: number) => <li key={i}>{e.consigne}</li>)}</ul></div>}
          {c.etude_de_cas && <div><p className="font-semibold">{t("Étude de cas")}</p><p className="whitespace-pre-wrap">{c.etude_de_cas.situation}</p></div>}
          {c.quiz?.length > 0 && (
            <div><p className="font-semibold">{t("Quiz")} ({c.quiz.length})</p>
              <ol className="list-decimal pl-5 space-y-1">{c.quiz.map((q: any, i: number) => (
                <li key={i}>{q.enonce}{q.options?.length ? <span className="text-[#666666]"> — {q.options.map((o: string, k: number) => q.bonnes?.includes(k) ? `✔ ${o}` : o).join(" · ")}</span> : null}{q.explication && <span className="block text-[#AAAAAA]">{q.explication}</span>}</li>
              ))}</ol>
            </div>
          )}
          {c.fiche_recap?.length > 0 && <div><p className="font-semibold">{t("Fiche récap")}</p><ul className="list-disc pl-5">{c.fiche_recap.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>}
          <div>
            <button onClick={async () => { const j = await action({ action: "versions", elementId: l.id }); if (j) setVersions(j.versions); }} disabled={occupe} className={bouton}><History size={11} />{t("Historique")} (v{l.version})</button>
            {versions && (
              <ul className="mt-2 space-y-1">
                {versions.length === 0 && <li className="text-[#AAAAAA]">{t("Aucune version précédente.")}</li>}
                {versions.map((v) => (
                  <li key={v.version} className="flex items-center gap-2">
                    <span>v{v.version} · {v.origine} · {new Date(v.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                    <button onClick={async () => { if (await action({ action: "restaurer", elementId: l.id, version: v.version }, t("Version restaurée"))) setVersions(null); }} disabled={occupe} className="text-[#F5A623] hover:underline">{t("Restaurer")}</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
