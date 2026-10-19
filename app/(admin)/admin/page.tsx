import Link from "next/link";
import { Suspense } from "react";
import { RefusAcces } from "./RefusAcces";
import { cookies } from "next/headers";
import { AlertOctagon, AlertTriangle, Lightbulb, Rocket, ArrowRight, Target, CheckCircle2 } from "lucide-react";
import { contexteCC, analyser } from "@/lib/command-center/serveur";
import { mesurer, valeur } from "@/lib/command-center/moteur";
import { scoreAxso, brief, objectifs, prevision } from "@/lib/command-center/insights";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { lien } from "@/lib/command-center/contexte";
import { peutAgir, peutVoir, sectionDe } from "@/lib/command-center/rbac";
import { JOUR } from "@/lib/command-center/contexte";
import { EnTetePage, Carte, Kpi, GrilleKpi, Jauge, Badge, Delta, Sparkline, Progression, EtatVide, Note, Fraicheur, tonScore } from "@/components/command-center/ui";
import { ActionsInsight, BoutonPDF } from "@/components/command-center/client";
import { TacheCase } from "./TacheCase";
import { Projection } from "@/components/command-center/graphiques";

const KPIS = ["mrr", "arr", "revenu", "gmv", "marchands_actifs", "nouveaux_marchands", "commandes", "arpu", "ltv", "cac", "churn", "nrr"];
const KPIS_CEO = ["revenu", "mrr", "gmv", "marchands_actifs", "nouveaux_marchands", "churn"];
const ICONE = { critique: AlertOctagon, alerte: AlertTriangle, opportunite: Rocket, insight: Lightbulb };
const TON_ALERTE = { critique: "bad", alerte: "warn", opportunite: "good", insight: "info" } as const;

export default async function CommandCenter({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("cc", searchParams);
  const tx = await getT();
  const { formatValeur, formatVariation, dateLongue, dateCourte } = formats(tx);
  const NOM_CAT = { critique: tx("Critique"), alerte: tx("Alerte"), opportunite: tx("Opportunité"), insight: tx("Insight") };
  const { vue: v, fen: f, filtres, session, reglages } = c;
  const ceo = (await cookies()).get("cc_mode")?.value === "ceo";
  const a = analyser(c, tx);
  const score = scoreAxso(v, f, a.stats, reglages.poids_sante, tx);
  const resume = brief(v, f, a.variations, a.churn, a.expansion, a.priorites, tx);
  const buts = objectifs(v, reglages, tx);
  const prev = peutVoir(session.role, "revenus") ? prevision(v, "mrr", undefined, tx) : null;
  const agir = peutAgir(session.role);
  const L = (p: string, s = {}) => lien(p, filtres, s);

  // RBAC : un rôle ne voit que les KPI de ses sections (ex. le support ne voit pas le revenu).
  const kpis = (ceo ? KPIS_CEO : KPIS).filter((id) => peutVoir(session.role, sectionDe(mesurer(v, id, f.cur, f.cur, 1).page)));
  const t = v.maintenant;
  const ns = mesurer(v, "north_star", f.cur, f.prev, 16);
  const nsSur = (jours: number, decalage: number) => valeur(v, "north_star", { debut: t - decalage - jours * JOUR, fin: t - decalage });
  const evol = (jours: number, ref: number) => { const x = nsSur(jours, 0), y = nsSur(jours, ref); return x == null || !y ? null : (x - y) / y; };
  const nsEvol = [{ nom: tx("7 jours"), v: evol(7, 7 * JOUR) }, { nom: tx("30 jours"), v: evol(30, 30 * JOUR) }, { nom: tx("12 mois"), v: evol(30, 365 * JOUR) }];
  const titrePays = filtres.pays ? ` · ${filtres.pays}` : "";

  const urgentes = a.alertes.filter((x) => x.categorie === "critique" || x.categorie === "alerte");
  const opportunites = a.alertes.filter((x) => x.categorie === "opportunite" || x.categorie === "insight");
  const taches = reglages.taches.filter((x) => x.statut === "a_faire").slice(0, 6);

  return (
    <div className="space-y-5">
      <EnTetePage
        eyebrow={`Axso Command Center${titrePays}`}
        titre={ceo ? tx("Où en est Axso ?") : "Command Center"}
        sousTitre={<>Real-time intelligence for the Axso ecosystem · {dateLongue(t)} · <span className="cc-faint">{tx(f.libelle)} {tx(f.libelleComp)}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><Link href={L("/admin/rapports/quotidien")} className="cc-btn cc-btn-sm">Daily brief</Link><BoutonPDF /></>}
      />
      <Suspense fallback={null}><RefusAcces /></Suspense>
      {c.erreur && <Note ton="warn">{tx(c.erreur)}</Note>}
      {!v.marchands.length && <Note>{c.ds.source === "reel" ? tx("Aucun marchand dans ce périmètre. Élargissez les filtres ou consultez les données de démonstration.") : tx("Aucun marchand dans ce périmètre. Élargissez les filtres.")}</Note>}

      {/* North Star · Santé · Brief */}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1.35fr]">
        <Carte titre="North Star" sousTitre={tx("Marchands actifs générant du GMV")} className="order-1">
          <Link href={L("/admin/marchands")} className="block group">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[40px] leading-none font-semibold cc-num">{formatValeur(ns.valeur, "nombre", true)}</p>
                <div className="mt-2"><Delta variation={ns.variation} format="nombre" /> <span className="cc-faint text-[12px]">{tx(f.libelleComp)}</span></div>
              </div>
              <Sparkline points={ns.serie} ton={ns.statut === "mauvais" ? "bad" : ns.statut === "bon" ? "good" : "neutre"} largeur={130} hauteur={50} />
            </div>
          </Link>
          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t cc-sep">
            {nsEvol.map((e) => <div key={e.nom}><p className="cc-faint text-[11px]">{e.nom}</p><Delta variation={e.v} format="nombre" petit /></div>)}
          </div>
          <p className="cc-faint text-[11.5px] mt-3">{tx("Cœur économique d'Axso : un marchand qui vend paie la commission et reste.")}</p>
        </Carte>

        <Carte titre="Axso Health Score" sousTitre={score.precedent != null && score.global != null ? tx("{0} pt {1}", `${score.global - score.precedent >= 0 ? "+" : ""}${score.global - score.precedent}`, tx(f.libelleComp)) : tx("Score composite de 8 dimensions")} className="order-3 lg:order-2" actions={<Link href={L("/admin/reglages#sante")} className="cc-btn cc-btn-ghost cc-btn-sm">{tx("Méthode")}</Link>}>
          <div className="flex items-center gap-4">
            <Jauge score={score.global} taille={96} libelle={tx("Santé d'Axso")} />
            <ul className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5 min-w-0">
              {score.sous.map((s) => (
                <li key={s.id}>
                  <Link href={L(s.lien)} className="block" data-tip={`${s.causes.join(" · ")} — ${s.recommandation}`}>
                    <div className="flex justify-between text-[11.5px]"><span className="cc-muted truncate">{s.nom}</span><span className="cc-num font-medium">{s.score ?? "—"}</span></div>
                    <Progression valeur={s.score == null ? 0 : s.score / 100} ton={tonScore(s.score) === "good" ? "good" : tonScore(s.score) === "warn" ? "warn" : "bad"} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {(() => { const pire = score.sous.filter((s) => s.score != null).sort((x, y) => x.score! - y.score!)[0]; return pire ? <p className="text-[12px] mt-3 pt-3 border-t cc-sep"><span className="cc-faint">{tx("Point faible :")} </span><strong>{pire.nom}</strong> — {pire.recommandation}</p> : null; })()}
        </Carte>

        <Carte titre="Axia Executive Brief" sousTitre={tx("Généré à partir des données · {0}", tx(f.libelle).toLowerCase())} className="order-2 lg:order-3 lg:col-span-2 xl:col-span-1">
          <ul className="space-y-1.5 text-[13px] leading-relaxed">
            {resume.phrases.map((p, i) => <li key={i} className="flex gap-2"><span className="cc-faint mt-[3px] text-[10px]">●</span><span>{p}</span></li>)}
          </ul>
          {resume.priorites.length > 0 && (
            <div className="mt-3 pt-3 border-t cc-sep">
              <p className="cc-eyebrow mb-1.5">{tx("Priorités recommandées")}</p>
              <ol className="space-y-1 text-[13px]">{resume.priorites.slice(0, 3).map((p, i) => <li key={i}><span className="cc-faint cc-num mr-1.5">{i + 1}.</span>{p}</li>)}</ol>
            </div>
          )}
        </Carte>
      </div>

      {/* Core business metrics */}
      <section aria-label={tx("Métriques clés")} className="space-y-2">
        <h2 className="cc-eyebrow">Core business metrics</h2>
        <GrilleKpi colonnes={6}>{kpis.map((id) => <Kpi key={id} m={mesurer(v, id, f.cur, f.prev, 12)} filtres={filtres} libelleComp={tx(f.libelleComp)} />)}</GrilleKpi>
        {c.ds.manques.includes("marketing") && kpis.includes("cac") && <p className="cc-faint text-[11.5px]">{tx("CAC indisponible : les dépenses marketing ne sont pas encore enregistrées dans Axso.")}</p>}
      </section>

      {/* Priorités & alertes */}
      <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr]">
        <Carte titre="Today's priorities" sousTitre={tx("Classées par impact, urgence, confiance et revenu en jeu")}>
          {!a.priorites.length ? <EtatVide titre={tx("Aucune priorité détectée")} explication={tx("Aucun seuil franchi, aucun marchand à risque ni opportunité d'upgrade sur ce périmètre.")} /> : (
            <ol className="divide-y cc-sep -mx-4">
              {a.priorites.slice(0, ceo ? 5 : 6).map((p, i) => (
                <li key={p.id} className="px-4 py-3 flex gap-3">
                  <span className="cc-num text-[13px] font-semibold w-5 shrink-0" style={{ color: "var(--cc-accent-text)" }}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Link href={L(p.lien)} className="text-[13.5px] font-medium hover:underline">{p.titre}</Link>
                    <p className="cc-faint text-[12px] mt-0.5">{p.pourquoi}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <Badge ton={p.impact === "Élevé" ? "bad" : p.impact === "Moyen" ? "warn" : "neutre"}>{tx("Impact {0}", tx(p.impact).toLowerCase())}</Badge>
                      <Badge>{tx(p.urgence)}</Badge>
                      <Badge>{tx("Confiance {0}", tx(p.confiance).toLowerCase())}</Badge>
                      {p.revenuRisque > 0 && <Badge ton="bad">{tx("{0} en jeu", formatValeur(p.revenuRisque, "xaf"))}</Badge>}
                      {p.revenuOpportunite > 0 && <Badge ton="good">{tx("+{0} MRR potentiel", formatValeur(p.revenuOpportunite, "xaf"))}</Badge>}
                    </div>
                    {!ceo && <div className="mt-2"><ActionsInsight insightId={p.id} titre={p.titre} lienMarchands={p.ids?.length ? L(p.lien) : undefined} ids={p.ids} source={c.ds.source} peutAgir={agir} compact /></div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Carte>
        <div className="grid gap-3 content-start">
          <Carte titre={tx("Risques")} actions={<Link href={L("/admin/alertes")} className="cc-btn cc-btn-ghost cc-btn-sm">{tx("Tout voir")}</Link>}>
            {!urgentes.length ? <p className="flex items-center gap-2 text-[13px] cc-good"><CheckCircle2 size={14} />{tx("Aucun seuil critique franchi.")}</p> : (
              <ul className="space-y-2.5">{urgentes.slice(0, 4).map((x) => { const I = ICONE[x.categorie]; return <li key={x.id} className="flex gap-2.5"><I size={15} className={`shrink-0 mt-0.5 cc-${TON_ALERTE[x.categorie]}`} aria-hidden /><Link href={L(x.lien)} className="min-w-0"><span className="block text-[13px] font-medium">{x.titre}</span><span className="block text-[11.5px] cc-faint">{NOM_CAT[x.categorie]} · {x.detail}</span></Link></li>; })}</ul>
            )}
          </Carte>
          <Carte titre={tx("Opportunités")}>
            {!opportunites.length ? <p className="cc-faint text-[13px]">{tx("Aucune opportunité détectée sur ce périmètre.")}</p> : (
              <ul className="space-y-2.5">{opportunites.slice(0, 4).map((x) => { const I = ICONE[x.categorie]; return <li key={x.id} className="flex gap-2.5"><I size={15} className={`shrink-0 mt-0.5 cc-${TON_ALERTE[x.categorie]}`} aria-hidden /><Link href={L(x.lien)} className="min-w-0"><span className="block text-[13px] font-medium">{x.titre}</span><span className="block text-[11.5px] cc-faint">{x.detail}</span></Link></li>; })}</ul>
            )}
          </Carte>
        </div>
      </div>

      {/* What changed? */}
      {!ceo && (
        <Carte titre="What changed?" sousTitre={tx("Variations significatives détectées automatiquement · {0}", tx(f.libelleComp))} pad={false}>
          {!a.variations.length ? <div className="px-4 pb-4"><EtatVide titre={tx("Pas de variation significative")} explication={tx("Aucune métrique ne varie de plus de 5 % (ou 2 points) avec un volume suffisant.")} /></div> : (
            <ul className="divide-y cc-sep border-t cc-sep">
              {a.variations.slice(0, 8).map((x) => (
                <li key={x.id}>
                  <details className="group">
                    <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer list-none cc-hover">
                      <span className="w-[88px] shrink-0"><Delta variation={x.mesure.variation} format={x.mesure.format} sens={x.mesure.sens} /></span>
                      <span className="text-[13px] font-medium flex-1 min-w-0 truncate">{x.nom}</span>
                      <span className="hidden md:block text-[12px] cc-faint truncate max-w-[45%]">{x.cause}</span>
                      <ArrowRight size={13} className="cc-faint shrink-0 transition-transform group-open:rotate-90" aria-hidden />
                    </summary>
                    <div className="px-4 pb-4 pt-1 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-[12.5px]">
                      <div><p className="cc-eyebrow mb-1">{tx("Variation")}</p><p className="cc-num">{formatValeur(x.mesure.precedente, x.mesure.format)} → <strong>{formatValeur(x.mesure.valeur, x.mesure.format)}</strong></p></div>
                      <div><p className="cc-eyebrow mb-1">{tx("Cause probable")}</p><p className={x.causeEtablie ? "" : "cc-faint"}>{x.cause}</p></div>
                      <div><p className="cc-eyebrow mb-1">{tx("Impact business")}</p><p>{x.impact}</p></div>
                      <div><p className="cc-eyebrow mb-1">{tx("Action recommandée")}</p><p>{x.action}</p><Link href={L(x.lien)} className="inline-flex items-center gap-1 mt-1 text-[12px]" style={{ color: "var(--cc-accent-text)" }}>{tx("Analyser")} <ArrowRight size={11} /></Link></div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      )}

      {/* Objectifs · Prévision · Tâches */}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        <Carte titre="Axso Goals" actions={<Link href={L("/admin/reglages#objectifs")} className="cc-btn cc-btn-ghost cc-btn-sm"><Target size={12} />{tx("Modifier")}</Link>}>
          <ul className="space-y-3">
            {buts.map((o) => (
              <li key={o.metrique}>
                <div className="flex items-baseline justify-between text-[12.5px] gap-2">
                  <span className="font-medium">{o.nom}</span>
                  <span className="cc-num"><strong>{formatValeur(o.actuel, o.format)}</strong><span className="cc-faint"> / {formatValeur(o.cible, o.format)}</span></span>
                </div>
                <div className="flex items-center gap-2 mt-1"><div className="flex-1"><Progression valeur={o.progression} /></div><span className="cc-num text-[11.5px] cc-faint w-9 text-right">{o.progression == null ? "—" : tx("{0} %", Math.round(o.progression * 100))}</span></div>
                <p className="cc-faint text-[10.5px] mt-0.5">{o.periode}</p>
              </li>
            ))}
          </ul>
        </Carte>
        {prev ? (
          <Carte titre="MRR Forecast" sousTitre={tx("Projection sur 6 mois — tendance des 6 derniers mois, ce n'est pas une donnée")} actions={<Link href={L("/admin/revenus#previsions")} className="cc-btn cc-btn-ghost cc-btn-sm">{tx("Détail")}</Link>}>
            <Projection format="xaf" donnees={[
              ...prev.historique.map((p) => ({ x: dateCourte(p.t), historique: p.v, attendu: null, prudent: null, ambitieux: null })),
              ...prev.projection.map((p) => ({ x: dateCourte(p.t), historique: null, attendu: Math.round(p.attendu), prudent: Math.round(p.prudent), ambitieux: Math.round(p.ambitieux) })),
            ]} />
            <div className="grid grid-cols-3 gap-2 text-[12px] mt-2">
              {(["prudent", "attendu", "ambitieux"] as const).map((k) => <div key={k}><p className="cc-faint capitalize">{tx(k === "prudent" ? "Prudent" : k === "attendu" ? "Attendu" : "Ambitieux")}</p><p className="cc-num font-semibold">{formatValeur(prev.projection[prev.projection.length - 1][k], "xaf")}</p></div>)}
            </div>
          </Carte>
        ) : (
          <Carte titre="MRR Forecast"><EtatVide titre={tx("Projection indisponible")} explication={tx("Il faut au moins 4 mois de MRR non nul pour projeter une tendance.")} /></Carte>
        )}
        {!ceo && (
          <Carte titre={tx("Actions en cours")} sousTitre={tx("Insights assignés aux équipes")}>
            {!taches.length ? <EtatVide titre={tx("Aucune action assignée")} explication={tx("Assignez une priorité à une équipe : elle apparaîtra ici jusqu'à ce qu'elle soit traitée.")} /> : (
              <ul className="space-y-2">{taches.map((x) => <li key={x.id} className="flex items-start gap-2.5 text-[12.5px]"><TacheCase id={x.id} actif={agir} /><div className="min-w-0"><p className="font-medium">{x.lien ? <Link href={x.lien} className="hover:underline">{x.titre}</Link> : x.titre}</p><p className="cc-faint text-[11.5px]">{tx("{0} · par {1} · {2}", tx(x.assigneA), x.creePar, dateCourte(x.creeLe))}</p></div></li>)}</ul>
            )}
          </Carte>
        )}
      </div>

      <p className="cc-faint text-[11px] text-center pt-2">{tx("Variations : {0} = hausse relative ; « pt » = écart en points de pourcentage. Les scores sont des indicateurs composites calculés, pas des données brutes.", formatVariation(0.1, "nombre"))}</p>
    </div>
  );
}
