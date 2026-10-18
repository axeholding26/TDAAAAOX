import Link from "next/link";
import { contexteCC } from "@/lib/command-center/serveur";
import { fichesMarchands } from "@/lib/command-center/marchands";
import { radarChurn, NOM_STATUT, type StatutSante } from "@/lib/command-center/insights";
import { NOM_PLAN, nomPays } from "@/lib/command-center/types";
import { NOM_CRITERE, CRITERES_SANTE } from "@/lib/command-center/reglages";
import { lien } from "@/lib/command-center/contexte";
import { peutAgir, peutVoir } from "@/lib/command-center/rbac";
import { formatValeur, dateCourte } from "@/lib/command-center/format";
import { EnTetePage, Carte, Badge, EtatVide, Note, Fraicheur, Tableau, Progression } from "@/components/command-center/ui";
import { ActionsInsight } from "@/components/command-center/client";

const STATUTS: StatutSante[] = ["croissance", "sain", "risque", "critique"];
const TON = { croissance: "cc-good", sain: "", risque: "cc-warn", critique: "cc-bad" } as const;

export default async function SuccesClient({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("succes", searchParams);
  const { vue: v, filtres, session, reglages } = c;
  const L = (p: string) => lien(p, filtres);
  const voirMarchands = peutVoir(session.role, "marchands");
  const voirRevenu = peutVoir(session.role, "revenus");
  const agir = peutAgir(session.role);
  const nomM = (id: string, nom: string) => (voirMarchands ? <Link href={L(`/admin/marchands/${id}`)} className="font-medium hover:underline">{nom}</Link> : nom);

  const fiches = fichesMarchands(v, reglages.poids_sante);
  const dist = STATUTS.map((s) => { const g = fiches.filter((x) => x.sante.statut === s); return { s, n: g.length, revenu: g.reduce((a, x) => a + x.revenu30, 0) }; });
  // radarChurn recalcule les mêmes statistiques : on reconstitue la Map depuis les fiches.
  const churn = radarChurn(v, new Map(fiches.map((x) => [x.m.id, x.s])), reglages.poids_sante);
  const expansion = fiches.filter((x) => x.expansion).map((x) => x.expansion!).sort((a, b) => b.score - a.score);
  const potentiel = expansion.reduce((a, e) => a + e.revenuPotentiel, 0);
  const dormants = fiches.filter((x) => x.s.joursInactif >= 14 && x.s.joursInactif <= 60 && x.m.etapes.commande != null).sort((a, b) => (v.gmv90.get(b.m.id) ?? 0) - (v.gmv90.get(a.m.id) ?? 0));
  const poidsTotal = Object.values(reglages.poids_sante).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Succès client" titre="Customer Success" sousTitre="Santé des marchands, risque de churn et opportunités d'expansion · 30 derniers jours" actions={<Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} />} />
      {c.erreur && <Note ton="warn">{c.erreur}</Note>}

      {!fiches.length ? <Carte><EtatVide titre="Aucun marchand dans ce périmètre" explication="Élargissez les filtres ou consultez les données de démonstration." /></Carte> : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
            <Carte titre="Distribution des scores santé" sousTitre={voirRevenu ? "Nombre de marchands et revenu Axso (30 j)" : "Nombre de marchands"}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {dist.map((d) => (
                  <Link key={d.s} href={L(voirMarchands ? `/admin/marchands?statut=${d.s}` : "/admin/succes-client")} className="cc-card cc-hover p-3 block">
                    <p className="text-[12px] cc-muted">{NOM_STATUT[d.s]}</p>
                    <p className={`text-[22px] font-semibold cc-num ${TON[d.s]}`}>{formatValeur(d.n, "nombre", true)}</p>
                    <p className="cc-faint text-[11px] cc-num">{Math.round((d.n / fiches.length) * 100)} %{voirRevenu ? ` · ${formatValeur(d.revenu, "xaf")}` : ""}</p>
                  </Link>
                ))}
              </div>
            </Carte>
            <Carte titre="Méthode du Health Score" sousTitre="Moyenne pondérée de 8 critères (0 à 100)" actions={<Link href={L("/admin/reglages#sante")} className="cc-btn cc-btn-ghost cc-btn-sm">Modifier</Link>}>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {CRITERES_SANTE.map((k) => { const p = reglages.poids_sante[k] / poidsTotal; return (
                  <li key={k}><div className="flex justify-between text-[11.5px] gap-2"><span className="cc-muted truncate">{NOM_CRITERE[k]}</span><span className="cc-num">{Math.round(p * 100)} %</span></div><Progression valeur={p / 0.3} /></li>
                ); })}
              </ul>
              <p className="cc-faint text-[11px] mt-3">Critique &lt; 40 · À risque &lt; 60 · En croissance : commandes +20 % (≥ 5 commandes).</p>
            </Carte>
          </div>

          <Carte titre="Churn Radar" sousTitre="Marchands à valeur (abonnés ou ≥ 3 commandes) avec un risque ≥ 50 %, classés par risque × revenu en jeu" pad={false}>
            <div className="px-4 pb-4">
              {churn.length ? <div className="mb-3"><ActionsInsight insightId="succes:churn" titre={`Traiter le Churn Radar (${churn.length} marchands)`} ids={churn.map((x) => x.marchand.id)} source={c.ds.source} peutAgir={agir} compact /></div> : null}
              <Note>Le risque est un score heuristique déduit du score santé (inactivité, baisse de commandes, IA, paiements, support), pas un modèle prédictif entraîné.</Note>
              <div className="mt-3">
                <Tableau vide="Aucun marchand à risque de churn élevé"
                  colonnes={[{ cle: "m", nom: "Marchand" }, { cle: "r", nom: "Risque", droite: true }, { cle: "x", nom: "Raisons" }, ...(voirRevenu ? [{ cle: "e", nom: "Revenu en jeu", droite: true }] : []), { cle: "a", nom: "Action recommandée" }]}
                  lignes={churn.slice(0, 25).map((x) => ({
                    m: <>{nomM(x.marchand.id, x.marchand.nom)}<span className="block cc-faint text-[11px]">{nomPays(x.marchand.pays)} · {NOM_PLAN[x.marchand.plan]}</span></>,
                    r: <span className={x.risque >= 0.7 ? "cc-bad font-semibold" : "cc-warn"}>{formatValeur(x.risque, "pct")}</span>,
                    x: <span className="text-[12px] cc-muted">{x.raisons.join(" · ") || "—"}</span>,
                    e: formatValeur(x.revenuRisque, "xaf"),
                    a: <span className="text-[12px]">{x.action}</span>,
                  }))} />
                {churn.length > 25 && <p className="cc-faint text-[11.5px] mt-2">25 premiers sur {churn.length}.</p>}
              </div>
            </div>
          </Carte>

          <Carte id="expansion" titre="Expansion Radar" sousTitre="Usage proche ou au-delà des limites du plan actuel" pad={false}>
            <div className="px-4 pb-4">
              {expansion.length ? <div className="mb-3"><ActionsInsight insightId="succes:expansion" titre={`Proposer un upgrade à ${expansion.length} marchands`} ids={expansion.map((e) => e.marchand.id)} source={c.ds.source} peutAgir={agir} compact /></div> : null}
              {voirRevenu && expansion.length > 0 && <p className="text-[13px] mb-3">Potentiel total : <strong className="cc-good cc-num">+{formatValeur(potentiel, "xaf")} de MRR</strong> <span className="cc-faint">(hors grands comptes sur devis)</span></p>}
              <Tableau vide="Aucune opportunité d'upgrade détectée"
                colonnes={[{ cle: "m", nom: "Marchand" }, { cle: "s", nom: "Score", droite: true }, { cle: "r", nom: "Raison" }, { cle: "p", nom: "Plan recommandé" }, ...(voirRevenu ? [{ cle: "v", nom: "Revenu potentiel", droite: true }] : [])]}
                lignes={expansion.slice(0, 25).map((e) => ({
                  m: <>{nomM(e.marchand.id, e.marchand.nom)}<span className="block cc-faint text-[11px]">{NOM_PLAN[e.marchand.plan]}</span></>,
                  s: e.score, r: <span className="text-[12px] cc-muted">{e.raison}</span>,
                  p: <Badge ton="good">{e.planRecommande === "entreprise" ? "Entreprise" : NOM_PLAN[e.planRecommande]}</Badge>,
                  v: e.revenuPotentiel ? `+${formatValeur(e.revenuPotentiel, "xaf")}` : "Sur devis",
                }))} />
              {expansion.length > 25 && <p className="cc-faint text-[11.5px] mt-2">25 premiers sur {expansion.length}.</p>}
            </div>
          </Carte>

          <Carte titre="Marchands dormants récents" sousTitre="Inactifs depuis 14 à 60 jours, ayant déjà encaissé au moins une commande — à relancer avant qu'ils ne partent">
            <Tableau vide="Aucun marchand dormant récent"
              colonnes={[{ cle: "m", nom: "Marchand" }, { cle: "d", nom: "Dernière activité" }, { cle: "j", nom: "Inactif depuis", droite: true }, { cle: "g", nom: "GMV (90 j)", droite: true }, { cle: "s", nom: "Santé", droite: true }]}
              lignes={dormants.slice(0, 20).map((x) => ({
                m: <>{nomM(x.m.id, x.m.nom)}<span className="block cc-faint text-[11px]">{nomPays(x.m.pays)} · {NOM_PLAN[x.m.plan]}</span></>,
                d: x.m.derniereActivite ? dateCourte(x.m.derniereActivite) : "—",
                j: `${x.s.joursInactif} j`, g: formatValeur(v.gmv90.get(x.m.id) ?? 0, "xaf"), s: x.sante.score,
              }))} />
            {dormants.length > 20 && <p className="cc-faint text-[11.5px] mt-2">20 premiers sur {dormants.length} (classés par GMV 90 j).</p>}
          </Carte>
        </>
      )}
    </div>
  );
}
