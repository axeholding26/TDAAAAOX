import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { contexteCC } from "@/lib/command-center/serveur";
import { mesurer, serie, valeur, ventiler, type Mesure } from "@/lib/command-center/moteur";
import { statsMarchands, prevision, type Prevision } from "@/lib/command-center/insights";
import { mesureCalculee } from "@/lib/command-center/croissance";
import { analysePlans, recommandationsPlans } from "@/lib/command-center/revenus";
import { nomPays } from "@/lib/command-center/types";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { lien, JOUR, type Fenetre } from "@/lib/command-center/contexte";
import { peutVoir } from "@/lib/command-center/rbac";
import { EnTetePage, Carte, Kpi, GrilleKpi, EtatVide, Note, Onglets, Fraicheur, ListeBarres } from "@/components/command-center/ui";
import { TableauInteractif, BoutonPDF, type Colonne } from "@/components/command-center/client";
import { Courbes, Cascade, Projection } from "@/components/command-center/graphiques";

const PREVISIONS = ["mrr", "revenu", "gmv", "marchands_actifs"];

export default async function Revenus({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getT();
  const { formatValeur, formatVariation, dateCourte } = formats(t);
  const libelleX = (fin: number, duree: number) => (duree <= 2 * JOUR ? t("{0} h", (new Date(fin).getUTCHours() + 1) % 24) : dateCourte(fin));
  const c = await contexteCC("revenus", searchParams);
  const { vue: v, fen: f, filtres, session, ds } = c;
  const L = (p: string, s = {}) => lien(p, filtres, s);
  const K = (m: Mesure) => <Kpi key={m.id} m={{ ...m, nom: t(m.nom), description: t(m.description), formule: t(m.formule) }} filtres={filtres} libelleComp={t(f.libelleComp)} />;
  const M = (id: string) => K(mesurer(v, id, f.cur, f.prev, 12));
  const voitMarchands = peutVoir(session.role, "marchands");

  // ─── KPIs
  const net = mesureCalculee(
    { id: "revenu_net", nom: "Revenu net de coût IA", format: "xaf", sens: 1, description: "Revenu Axso moins le coût estimé des requêtes IA (les autres frais ne sont pas suivis)", formule: "Revenu − coût IA", page: "/admin/revenus" },
    (w) => (valeur(v, "revenu", w) ?? 0) - (valeur(v, "cout_ia", w) ?? 0), f.cur, f.prev);
  const mvt = (cle: "nouveau" | "expansion" | "contraction" | "churn", nom: string, sens: 1 | -1, description: string) =>
    mesureCalculee({ id: `mrr_${cle}`, nom, format: "xaf", sens, description, formule: "Variation du MRR par marchand entre début et fin de période", page: "/admin/revenus#cascade" }, (w: Fenetre) => v.mouvementsMrr(w)[cle], f.cur, f.prev);
  const mouvements = [
    mvt("nouveau", "New MRR", 1, "MRR des marchands devenus payants"),
    mvt("expansion", "Expansion MRR", 1, "MRR gagné par upgrade"),
    mvt("contraction", "Contraction MRR", -1, "MRR perdu par downgrade"),
    mvt("churn", "Churned MRR", -1, "MRR des marchands qui ne paient plus"),
  ];
  const m = v.mouvementsMrr(f.cur);

  // ─── Courbe du revenu
  const duree = f.cur.fin - f.cur.debut, n = 12, pas = duree / n;
  const com = serie(v, "revenu_commissions", f.cur, n), abo = serie(v, "revenu_abonnements", f.cur, n);
  const courbe = com.map((x, i) => ({ x: libelleX(f.cur.debut + pas * (i + 1), duree), commissions: x ?? 0, abonnements: abo[i] ?? 0 }));

  // ─── Plans
  const plans = analysePlans(v, f.cur);
  const recos = recommandationsPlans(v, statsMarchands(v), t);
  const colPlans: Colonne[] = ([
    { cle: "nom", nom: "Plan" }, { cle: "marchands", nom: "Marchands", format: "nombre", droite: true }, { cle: "actifs", nom: "Actifs", format: "nombre", droite: true },
    { cle: "mrr", nom: "MRR", format: "xaf", droite: true }, { cle: "arpu", nom: "ARPU", format: "xaf", droite: true },
    { cle: "entrees", nom: "Entrées", format: "nombre", droite: true }, { cle: "conversion", nom: "Conversion vers le plan", format: "pct", droite: true },
    { cle: "churn", nom: "Churn", format: "pct", droite: true }, { cle: "upgrades", nom: "Upgrades", format: "nombre", droite: true }, { cle: "downgrades", nom: "Downgrades", format: "nombre", droite: true },
    { cle: "commandesParMarchand", nom: "Commandes / marchand actif", format: "nombre", droite: true }, { cle: "iaParMarchand", nom: "Requêtes IA / marchand actif", format: "nombre", droite: true },
    { cle: "adoptionPremium", nom: "Adoption Marketing ou Axia", format: "pct", droite: true },
  ] as Colonne[]).map((x): Colonne => ({ ...x, nom: t(x.nom) }));
  const lignesPlans = plans.map((p) => ({ _id: p.plan, _href: voitMarchands ? L("/admin/marchands", { plan: p.plan }) : undefined, ...p, nom: t(p.nom) }));

  // ─── Prévisions
  const prev = PREVISIONS.map((id) => ({ id, p: prevision(v, id, 6, t) })).filter((x): x is { id: string; p: Prevision } => x.p != null);
  const colPrev: Colonne[] = [
    { cle: "nom", nom: t("Métrique") }, { cle: "actuel", nom: t("Actuel (30 j)"), droite: true },
    ...[3, 6].flatMap((h) => (["prudent", "attendu", "ambitieux"] as const).map((k) => ({ cle: `${k}${h}`, nom: t(k === "prudent" ? "Prudent {0} mois" : k === "attendu" ? "Attendu {0} mois" : "Ambitieux {0} mois", h), droite: true }))),
  ];
  const lignesPrev = prev.map(({ id, p }) => ({
    _id: id, nom: p.nom, actuel: formatValeur(p.historique[p.historique.length - 1].v, p.format),
    ...Object.fromEntries([3, 6].flatMap((h) => (["prudent", "attendu", "ambitieux"] as const).map((k) => [`${k}${h}`, formatValeur(p.projection[h - 1][k], p.format)]))),
  }));

  const parPays = [...ventiler(v, "revenu", f.cur, "pays")].filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="space-y-5">
      <EnTetePage
        eyebrow="Revenue Intelligence"
        titre={t("Revenus")}
        sousTitre={<>{t("MRR, mouvements, plans et prévisions")} · <span className="cc-faint">{t(f.libelle)} {t(f.libelleComp)}</span></>}
        actions={<><Fraicheur genereA={ds.genereA} source={ds.source} erreur={c.erreur} /><BoutonPDF /></>}
      />
      {c.erreur && <Note ton="warn">{t(c.erreur)}</Note>}
      <Onglets actif="" onglets={[
        { id: "kpis", nom: t("Indicateurs"), href: L("/admin/revenus#kpis") }, { id: "cascade", nom: t("Cascade MRR"), href: L("/admin/revenus#cascade") },
        { id: "plans", nom: t("Plans"), href: L("/admin/revenus#plans") }, { id: "previsions", nom: t("Prévisions"), href: L("/admin/revenus#previsions") },
      ]} />

      <section id="kpis" aria-label={t("Indicateurs de revenu")} className="space-y-2 scroll-mt-20">
        <h2 className="cc-eyebrow">{t("Revenu")}</h2>
        <GrilleKpi colonnes={6}>{[M("mrr"), M("arr"), M("arpu"), M("ltv"), M("cac"), M("revenu"), K(net), M("revenu_commissions"), M("revenu_abonnements"), M("cout_ia"), M("nrr"), M("churn")]}</GrilleKpi>
        {ds.manques.includes("marketing") && <p className="cc-faint text-[11.5px]">{t("CAC indisponible : les dépenses marketing ne sont pas encore enregistrées dans Axso.")}</p>}
        <h2 className="cc-eyebrow pt-2">{t("Mouvements du MRR")}</h2>
        <GrilleKpi>{mouvements.map(K)}</GrilleKpi>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Carte id="cascade" titre={t("Cascade du MRR")} sousTitre={`${dateCourte(f.cur.debut)} → ${dateCourte(f.cur.fin)}`}>
          {!m.debut && !m.fin ? <EtatVide titre={t("Aucun abonnement payant")} explication={t("Le MRR se calcule à partir des paiements d'abonnement (Pro, Illimité). Aucun n'est actif sur la période.")} /> : (
            <Cascade format="xaf" etapes={[
              { nom: t("MRR début"), valeur: m.debut, type: "total" }, { nom: t("Nouveau"), valeur: m.nouveau, type: "plus" }, { nom: t("Expansion"), valeur: m.expansion, type: "plus" },
              { nom: t("Contraction"), valeur: m.contraction, type: "moins" }, { nom: t("Churn"), valeur: m.churn, type: "moins" }, { nom: t("MRR fin"), valeur: m.fin, type: "total" },
            ]} />
          )}
        </Carte>
        <Carte titre={t("Revenu encaissé")} sousTitre={t("Commissions et abonnements, empilés, par tranche de la période")}>
          {courbe.every((x) => !x.commissions && !x.abonnements) ? <EtatVide titre={t("Aucun revenu sur la période")} explication={t("Ni commission sur paiement en ligne ni paiement d'abonnement.")} />
            : <Courbes donnees={courbe} series={[{ cle: "commissions", nom: t("Commissions") }, { cle: "abonnements", nom: t("Abonnements") }]} format="xaf" empile />}
        </Carte>
      </div>

      <Carte id="plans" titre={t("Analyse des plans")} sousTitre={t("Marchands selon leur plan actuel ; MRR, churn, upgrades et downgrades selon les paiements d'abonnement de la période · usage rapporté aux marchands actifs")}>
        <TableauInteractif colonnes={colPlans} lignes={lignesPlans} nomExport="axso-plans" recherche={false} />
        <div className="mt-4 pt-3 border-t cc-sep">
          <p className="cc-eyebrow mb-2">{t("Recommandations (30 derniers jours)")}</p>
          {!recos.length ? <p className="cc-faint text-[12.5px]">{t("Aucun constat chiffré suffisamment étayé sur ce périmètre (volumes minimaux non atteints ou aucun seuil franchi).")}</p> : (
            <ul className="space-y-2">
              {recos.map((r, i) => (
                <li key={i} className="flex gap-2.5 text-[13px]">
                  <Lightbulb size={14} className="cc-warn shrink-0 mt-0.5" aria-hidden />
                  <span>{t(r.texte)}{voitMarchands && <> <Link href={L("/admin/marchands", { plan: r.plan })} className="text-[12px] whitespace-nowrap" style={{ color: "var(--cc-accent-text)" }}>{t("Voir les marchands →")}</Link></>}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Carte>

      <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
        <Carte titre={t("Revenu par pays")} sousTitre={t("Top 8 · cliquer pour voir les marchands")}>
          <ListeBarres format="xaf" lignes={parPays.map(([p, x]) => ({ cle: p, nom: t(nomPays(p)), valeur: x, href: voitMarchands ? L("/admin/marchands", { pays: p }) : undefined }))} />
        </Carte>
        <Carte id="previsions" titre={t("Prévisions financières")} sousTitre={t("Projection : tendance linéaire des 6 derniers mois, ce n'est pas une donnée")}>
          {!prev.length ? <EtatVide titre={t("Projection indisponible")} explication={t("Il faut au moins 4 mois non nuls sur les 6 derniers pour projeter une tendance.")} /> : (
            <TableauInteractif colonnes={colPrev} lignes={lignesPrev} nomExport="axso-projections" recherche={false} />
          )}
        </Carte>
      </div>

      {prev.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {prev.map(({ id, p }) => (
            <Carte key={id} titre={t("Projection · {0}", p.nom)} sousTitre={t("Réalisé (12 mois) puis 3 scénarios de projection sur 6 mois")}>
              <Projection format={p.format} donnees={[
                ...p.historique.map((x) => ({ x: dateCourte(x.t), historique: x.v, attendu: null, prudent: null, ambitieux: null })),
                ...p.projection.map((x) => ({ x: dateCourte(x.t), historique: null, attendu: Math.round(x.attendu), prudent: Math.round(x.prudent), ambitieux: Math.round(x.ambitieux) })),
              ]} />
            </Carte>
          ))}
        </div>
      )}
      {PREVISIONS.length > prev.length && prev.length > 0 && <p className="cc-faint text-[11.5px]">{t("Projection non affichée pour {0} métrique(s) : historique insuffisant.", PREVISIONS.filter((id) => !prev.some((x) => x.id === id)).length)}</p>}

      <p className="cc-faint text-[11px] text-center pt-2">{t("Variations : {0} = hausse relative ; « pt » = écart en points. Revenu net = revenu − coût IA estimé (frais de paiement non suivis). Les projections prolongent une tendance : elles ne prédisent rien.", formatVariation(0.1, "nombre"))}</p>
    </div>
  );
}
