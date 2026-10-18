import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Settings2 } from "lucide-react";
import { contexteCC } from "@/lib/command-center/serveur";
import { fichesMarchands } from "@/lib/command-center/marchands";
import { NOM_STATUT } from "@/lib/command-center/insights";
import { sousVue, serie, tranche } from "@/lib/command-center/moteur";
import { NOM_PLAN, nomPays, SOURCES_ACQ, NOM_FONCTION, NOM_TYPE_IA, TYPES_IA, FONCTIONS, type PlanId } from "@/lib/command-center/types";
import { NOM_CRITERE, CRITERES_SANTE } from "@/lib/command-center/reglages";
import { lien, JOUR } from "@/lib/command-center/contexte";
import { peutAgir, peutVoir } from "@/lib/command-center/rbac";
import { formatValeur, dateCourte } from "@/lib/command-center/format";
import { EnTetePage, Carte, Badge, Jauge, Progression, EtatVide, Note, Tableau, tonScore, type Ton } from "@/components/command-center/ui";
import { ActionsInsight } from "@/components/command-center/client";
import { Courbes } from "@/components/command-center/graphiques";

const TON_STATUT: Record<string, Ton> = { croissance: "good", sain: "info", risque: "warn", critique: "bad" };
const nomPlan = (p: PlanId | "entreprise") => (p === "entreprise" ? "Entreprise (sur devis)" : NOM_PLAN[p]);

function Stat({ nom, valeur, sous }: { nom: string; valeur: string; sous?: string }) {
  return (
    <div className="min-w-0">
      <p className="cc-faint text-[11.5px]">{nom}</p>
      <p className="text-[17px] font-semibold cc-num truncate">{valeur}</p>
      {sous && <p className="cc-faint text-[11px] truncate">{sous}</p>}
    </div>
  );
}

function Ligne({ nom, children }: { nom: string; children: React.ReactNode }) {
  return <div className="flex justify-between gap-3 py-1.5 text-[12.5px] border-b cc-sep last:border-0"><dt className="cc-faint">{nom}</dt><dd className="text-right min-w-0 truncate">{children}</dd></div>;
}

export default async function Marchand360({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, c] = await Promise.all([params, contexteCC("marchands", searchParams)]);
  const { filtres, session, reglages } = c;
  const m = c.vue.parId.get(id) ?? c.ds.marchands.find((x) => x.id === id);
  if (!m) notFound();
  const L = (p: string) => lien(p, filtres);

  // Vue restreinte à ce seul marchand (indépendante des segments globaux).
  const v = sousVue(c.vue, new Set([id]));
  const t = v.maintenant;
  const { s, sante, churn, revenu30, expansion } = fichesMarchands(v, reglages.poids_sante)[0];
  const voirRevenu = peutVoir(session.role, "revenus");
  const agir = peutAgir(session.role);

  const w90 = { debut: t - 90 * JOUR, fin: t };
  const gmv90 = serie(v, "gmv", w90, 13);
  const pointsGmv = gmv90.map((g, i) => ({ x: dateCourte(w90.debut + ((i + 1) * (w90.fin - w90.debut)) / 13), gmv: g ?? 0 }));

  const ia90 = tranche(v.ia, w90);
  const iaParType = TYPES_IA.map((ty) => ({ ty, n: ia90.filter((e) => e.type === ty).reduce((a, e) => a + e.nombre, 0) })).filter((x) => x.n > 0);
  const coutIa = ia90.reduce((a, e) => a + e.cout, 0);

  // Fréquence : jours distincts avec une activité (commande, fonctionnalité, IA) sur 30 jours, ramenés à la semaine.
  const w30 = { debut: t - 30 * JOUR, fin: t + 1 };
  const jours = new Set<number>();
  for (const x of [...tranche(v.commandes, w30), ...tranche(v.fonctions, w30), ...tranche(v.ia, w30)]) jours.add(Math.floor(x.date / JOUR));
  const frequence = jours.size / (30 / 7);

  const paiements = [...v.abonnements].reverse();
  const statutAbo = s.mrr > 0 ? { t: "Actif", ton: "good" as Ton } : s.mrrAvant > 0 ? { t: "Non renouvelé", ton: "bad" as Ton } : { t: m.plan === "palier0" ? "Plan gratuit" : "Aucun paiement récent", ton: "neutre" as Ton };
  const poidsTotal = Object.values(reglages.poids_sante).reduce((a, b) => a + b, 0) || 1;
  const reel = c.ds.source === "reel";

  return (
    <div className="space-y-5">
      <Link href={L("/admin/marchands")} className="inline-flex items-center gap-1 text-[12.5px] cc-muted hover:underline"><ArrowLeft size={13} />Marchands</Link>
      <EnTetePage
        eyebrow="Merchant 360"
        titre={m.nom}
        sousTitre={<>{nomPays(m.pays)} · {NOM_PLAN[m.plan]} · {m.industrie} · inscrit le {new Date(m.creeLe).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</>}
        actions={<>
          <Badge ton={TON_STATUT[sante.statut]}>{NOM_STATUT[sante.statut]}</Badge>
          {reel && peutVoir(session.role, "boutiques") && <Link href={`/admin/boutiques/${m.id}`} className="cc-btn cc-btn-sm"><Settings2 size={12} />Gérer la boutique</Link>}
          <ActionsInsight insightId={`marchand:${m.id}`} titre={`Suivi du marchand ${m.nom}`} lienMarchands={undefined} ids={[m.id]} source={c.ds.source} peutAgir={agir} compact />
        </>}
      />
      {!c.vue.parId.has(id) && <Note>Ce marchand est hors des filtres actuels ; sa fiche reste affichée en entier.</Note>}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Carte titre="Vue d'ensemble">
          <dl>
            <Ligne nom="Pays">{nomPays(m.pays)}</Ligne>
            <Ligne nom="Plan">{NOM_PLAN[m.plan]}</Ligne>
            <Ligne nom="Inscription">{dateCourte(m.creeLe)} {new Date(m.creeLe).getUTCFullYear()}</Ligne>
            <Ligne nom="Dernière activité">{m.derniereActivite ? `${dateCourte(m.derniereActivite)} · il y a ${s.joursInactif} j` : "—"}</Ligne>
            <Ligne nom="Secteur">{m.industrie}</Ligne>
            <Ligne nom="Source d'acquisition">{c.ds.manques.includes("acquisition") || m.source === "inconnu" ? <span className="cc-faint">Non suivie</span> : SOURCES_ACQ[m.source] ?? m.source}</Ligne>
            <Ligne nom="Boutique">{m.actif ? <Badge ton="good">Active</Badge> : <Badge ton="bad">Suspendue</Badge>}</Ligne>
          </dl>
        </Carte>

        <Carte titre="Business" sousTitre="30 derniers jours" className="xl:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat nom="GMV" valeur={formatValeur(s.gmv30, "xaf")} sous={`30 j préc. : ${formatValeur(s.gmvPrec30, "xaf")}`} />
            <Stat nom="Commandes payées" valeur={formatValeur(s.commandes30, "nombre", true)} sous={`30 j préc. : ${s.commandesPrec30}`} />
            {voirRevenu && <Stat nom="Revenu Axso" valeur={formatValeur(revenu30, "xaf")} sous="commissions + abonnement" />}
            <Stat nom="Panier moyen" valeur={formatValeur(s.commandes30 ? s.gmv30 / s.commandes30 : null, "xaf")} />
          </div>
          <p className="cc-eyebrow mt-4 mb-1">GMV sur 90 jours (par semaine)</p>
          {gmv90.some((g) => g) ? <Courbes donnees={pointsGmv} series={[{ cle: "gmv", nom: "GMV" }]} format="xaf" hauteur={180} /> : <EtatVide titre="Aucune vente sur 90 jours" />}
        </Carte>

        <Carte titre="Produit">
          <dl>
            <Ligne nom="Produits">{formatValeur(m.nbProduits, "nombre", true)}</Ligne>
            <Ligne nom="En stock faible">{m.produitsStockFaible ? <span className="cc-warn">{m.produitsStockFaible}</span> : 0}</Ligne>
          </dl>
          <p className="cc-faint text-[11.5px] mt-2">Best-sellers indisponibles : le jeu de données normalisé ne détaille pas les lignes de commande par produit.</p>
        </Carte>

        <Carte titre="Axia IA" sousTitre="90 derniers jours">
          {!iaParType.length ? <EtatVide titre="Aucun usage d'Axia" explication="Ce marchand n'a envoyé aucune requête IA sur 90 jours." /> : (
            <dl>
              {iaParType.map((x) => <Ligne key={x.ty} nom={NOM_TYPE_IA[x.ty]}><span className="cc-num">{formatValeur(x.n, "nombre", true)}</span></Ligne>)}
              <Ligne nom="Coût IA estimé"><span className="cc-num font-medium">{formatValeur(coutIa, "xaf")}</span></Ligne>
            </dl>
          )}
        </Carte>

        <Carte titre="Engagement" sousTitre="30 derniers jours">
          <Stat nom="Fréquence" valeur={`${formatValeur(frequence, "nombre")} j / semaine`} sous={`${jours.size} jours actifs sur 30`} />
          <div className="flex flex-wrap gap-1.5 mt-3">
            {FONCTIONS.map((fn) => <Badge key={fn} ton={s.fonctions30.has(fn) || (fn === "axia" && s.ia30 > 0) ? "accent" : "neutre"}>{NOM_FONCTION[fn]}</Badge>)}
          </div>
          <p className="cc-faint text-[11px] mt-2">En couleur : fonctionnalités utilisées sur 30 jours.</p>
        </Carte>

        <div className="grid gap-3 content-start">
        <Carte titre="Financier" sousTitre="Paiements d'abonnement" actions={<Badge ton={statutAbo.ton}>{statutAbo.t}</Badge>}>
          {!voirRevenu ? <p className="cc-faint text-[12.5px]">Réservé aux rôles ayant accès aux revenus.</p>
            : <Tableau colonnes={[{ cle: "d", nom: "Date" }, { cle: "p", nom: "Plan" }, { cle: "m", nom: "Montant", droite: true }]} lignes={paiements.slice(0, 12).map((p) => ({ d: `${dateCourte(p.date)} ${new Date(p.date).getUTCFullYear()}`, p: NOM_PLAN[p.plan], m: formatValeur(p.montant, "xaf", true) }))} vide="Aucun paiement d'abonnement" />}
        </Carte>

        <Carte titre="Opportunité" sousTitre="Expansion Radar">
          {!expansion ? <EtatVide titre="Pas d'opportunité d'upgrade détectée" explication="L'usage de ce marchand reste dans les limites de son plan actuel." /> : (
            <dl>
              <Ligne nom="Score expansion"><span className="cc-num font-semibold">{expansion.score}/100</span></Ligne>
              <Ligne nom="Plan recommandé"><Badge ton="good">{nomPlan(expansion.planRecommande)}</Badge></Ligne>
              <Ligne nom="Potentiel">{expansion.revenuPotentiel ? `+${formatValeur(expansion.revenuPotentiel, "xaf")} MRR` : "Sur devis"}</Ligne>
              <Ligne nom="Raison"><span className="whitespace-normal">{expansion.raison}</span></Ligne>
              <Ligne nom="Action recommandée"><span className="whitespace-normal">Proposer le plan {nomPlan(expansion.planRecommande)}</span></Ligne>
            </dl>
          )}
        </Carte>
        </div>

        <Carte titre="Risque" sousTitre="Score heuristique, pas un modèle entraîné" className="md:col-span-2 xl:col-span-2" actions={<Link href={L("/admin/reglages#sante")} className="cc-btn cc-btn-ghost cc-btn-sm">Méthode</Link>}>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex sm:flex-col items-center gap-3 shrink-0">
              <Jauge score={sante.score} libelle="Santé du marchand" />
              <div className="text-center">
                <p className="cc-faint text-[11.5px]">Risque churn</p>
                <p className={`text-[20px] font-semibold cc-num ${churn >= 0.7 ? "cc-bad" : churn >= 0.5 ? "cc-warn" : ""}`}>{formatValeur(churn, "pct")}</p>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
                {CRITERES_SANTE.map((k) => (
                  <li key={k}>
                    <div className="flex justify-between text-[11.5px] gap-2"><span className="cc-muted truncate">{NOM_CRITERE[k]} <span className="cc-faint">· {Math.round((reglages.poids_sante[k] / poidsTotal) * 100)} %</span></span><span className="cc-num font-medium">{Math.round(sante.criteres[k] * 100)}</span></div>
                    <Progression valeur={sante.criteres[k]} ton={tonScore(sante.criteres[k] * 100) === "good" ? "good" : tonScore(sante.criteres[k] * 100) === "warn" ? "warn" : "bad"} />
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t cc-sep text-[12.5px]">
                <p className="cc-eyebrow mb-1">Raisons</p>
                {sante.signaux.length ? <ul className="flex flex-wrap gap-1.5">{sante.signaux.map((x) => <li key={x}><Badge ton="warn">{x}</Badge></li>)}</ul> : <p className="cc-faint">Aucun signal de risque.</p>}
                <p className="mt-2"><span className="cc-faint">Paiements clients échoués (30 j) : </span><span className={`cc-num ${s.echecs30 ? "cc-bad" : ""}`}>{s.echecs30}</span></p>
              </div>
            </div>
          </div>
        </Carte>

      </div>
    </div>
  );
}
