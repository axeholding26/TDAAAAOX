import Link from "next/link";
import { ArrowRight, Settings2 } from "lucide-react";
import { contexteCC } from "@/lib/command-center/serveur";
import { mesurer, serie, valeur, type Mesure } from "@/lib/command-center/moteur";
import { entonnoir, cohortes, SEMAINES_COHORTE } from "@/lib/command-center/insights";
import { mesureCalculee, reactives, dormants, nouveauxPayants, parCanal, parCampagne } from "@/lib/command-center/croissance";
import { NOM_ETAPE } from "@/lib/command-center/reglages";
import { SOURCES_ACQ } from "@/lib/command-center/types";
import { formatValeur, formatVariation, dateCourte } from "@/lib/command-center/format";
import { lien, JOUR, type Fenetre } from "@/lib/command-center/contexte";
import { peutVoir } from "@/lib/command-center/rbac";
import { EnTetePage, Carte, Kpi, GrilleKpi, Delta, EtatVide, Note, Onglets, Fraicheur, ListeBarres } from "@/components/command-center/ui";
import { TableauInteractif, BoutonsExport, BoutonPDF } from "@/components/command-center/client";
import { Barres } from "@/components/command-center/graphiques";

const libelleX = (fin: number, duree: number) => (duree <= 2 * JOUR ? `${new Date(fin).getUTCHours()} h` : dateCourte(fin));

export default async function Croissance({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("croissance", searchParams);
  const { vue: v, fen: f, filtres, session, ds } = c;
  const L = (p: string, s = {}) => lien(p, filtres, s);
  const K = (m: Mesure) => <Kpi key={m.id} m={m} filtres={filtres} libelleComp={f.libelleComp} />;
  const M = (id: string) => K(mesurer(v, id, f.cur, f.prev, 12));
  const voitRevenus = peutVoir(session.role, "revenus");
  const sansAcq = ds.manques.includes("acquisition"), sansMkt = ds.manques.includes("marketing");

  // ─── Acquisition
  const convVisiteurs = mesureCalculee(
    { id: "conv_visiteurs", nom: "Visiteurs → inscriptions", format: "pct", sens: 1, description: "Part des visiteurs du site qui créent un compte marchand", formule: "Nouveaux marchands ÷ visiteurs", page: "/admin/croissance" },
    (w) => { const vis = valeur(v, "visiteurs", w); return vis ? (valeur(v, "nouveaux_marchands", w) ?? 0) / vis : null; }, f.cur, f.prev);
  const canaux = parCanal(v, f.cur);
  const campagnes = sansMkt ? [] : parCampagne(v, f.cur);
  const duree = f.cur.fin - f.cur.debut, n = 12, pas = duree / n;
  const inscr = serie(v, "nouveaux_marchands", f.cur, n);
  const serieInscr = inscr.map((x, i) => ({ x: libelleX(f.cur.debut + pas * (i + 1), duree), inscriptions: x ?? 0 }));

  // ─── Activation
  const fa = entonnoir(v, f.cur), fb = entonnoir(v, f.prev);
  const etapeConf = c.reglages.activation;

  // ─── Conversion
  const passesPayants = mesureCalculee(
    { id: "nouveaux_payants", nom: "Passés payants", format: "nombre", sens: 1, description: "Marchands ayant payé leur tout premier abonnement sur la période", formule: "Marchands dont le 1er paiement d'abonnement tombe dans la période", page: "/admin/revenus#plans" },
    (w) => nouveauxPayants(v, w), f.cur, f.prev);

  // ─── Rétention
  const reactiv = mesureCalculee(
    { id: "reactivation", nom: "Réactivations", format: "nombre", sens: 1, description: "Marchands redevenus actifs après au moins 30 jours sans activité", formule: "Marchands avec une activité sur la période précédée de ≥ 30 jours d'inactivité", page: "/admin/croissance#retention" },
    (w) => reactives(v, w).size, f.cur, f.prev);
  const dorm = mesureCalculee(
    { id: "dormants", nom: "Marchands dormants", format: "nombre", sens: -1, instant: true, description: "Marchands inscrits depuis plus de 30 jours, sans aucune activité depuis 30 jours", formule: "Inscrits > 30 j sans activité sur 30 j (en fin de période)", page: "/admin/croissance#retention" },
    (w: Fenetre) => dormants(v, w.fin), f.cur, f.prev);
  const coh = cohortes(v);
  const totalCoh = coh.reduce((s, x) => s + x.taille, 0);

  // ─── Expansion
  const mvt = (w: Fenetre) => v.mouvementsMrr(w).expansion;
  const mrrExpansion = mesureCalculee({ id: "mrr_expansion", nom: "MRR d'expansion", format: "xaf", sens: 1, description: "MRR gagné sur les marchands déjà payants (upgrades)", formule: "Σ hausses de MRR des marchands payants en début et fin de période", page: "/admin/revenus" }, mvt, f.cur, f.prev);

  const onglets = [
    { id: "acquisition", nom: "Acquisition", href: L("/admin/croissance#acquisition") },
    { id: "activation", nom: "Activation", href: L("/admin/croissance#activation") },
    { id: "conversion", nom: "Conversion", href: L("/admin/croissance#conversion") },
    { id: "retention", nom: "Rétention", href: L("/admin/croissance#retention") },
    ...(voitRevenus ? [{ id: "expansion", nom: "Expansion", href: L("/admin/croissance#expansion") }] : []),
  ];

  const colCanaux = [
    { cle: "canal", nom: "Canal" }, { cle: "visiteurs", nom: "Visiteurs", format: "nombre" as const, droite: true },
    { cle: "inscrits", nom: "Inscriptions", format: "nombre" as const, droite: true }, { cle: "conversion", nom: "Conversion", format: "pct" as const, droite: true },
    { cle: "depenses", nom: "Dépenses", format: "xaf" as const, droite: true }, { cle: "cac", nom: "CAC", format: "xaf" as const, droite: true },
  ];
  const lignesCanaux = canaux.map((x) => ({ _id: x.canal, _href: L("/admin/marchands", { acq: x.canal }), canal: SOURCES_ACQ[x.canal] ?? x.canal, visiteurs: x.visiteurs, inscrits: x.inscrits, conversion: x.conversion, depenses: x.depenses, cac: x.cac }));
  const colEntonnoir = [{ cle: "etape", nom: "Étape" }, { cle: "nombre", nom: "Marchands" }, { cle: "taux", nom: "Taux cumulé" }, { cle: "tauxEtape", nom: "Taux d'étape" }, { cle: "precedent", nom: "Taux d'étape (période préc.)" }];
  const lignesEntonnoir = fa.etapes.map((e, i) => ({ _id: e.id, etape: e.nom, nombre: e.nombre, taux: Math.round(e.taux * 1000) / 10, tauxEtape: Math.round(e.tauxEtape * 1000) / 10, precedent: Math.round(fb.etapes[i].tauxEtape * 1000) / 10 }));
  const colCoh = [{ cle: "cohorte", nom: "Cohorte (semaine)" }, { cle: "taille", nom: "Inscrits" }, ...SEMAINES_COHORTE.map((k) => ({ cle: `s${k}`, nom: `S${k} (%)` }))];
  const lignesCoh = coh.map((x) => ({ _id: String(x.debut), cohorte: dateCourte(x.debut), taille: x.taille, ...Object.fromEntries(x.retention.map((r, i) => [`s${SEMAINES_COHORTE[i]}`, r == null ? null : Math.round(r * 1000) / 10])) }));

  return (
    <div className="space-y-5">
      <EnTetePage
        eyebrow="Growth Center"
        titre="Croissance"
        sousTitre={<>Acquisition, activation, conversion, rétention et expansion des marchands · <span className="cc-faint">{f.libelle} {f.libelleComp}</span></>}
        actions={<><Fraicheur genereA={ds.genereA} source={ds.source} erreur={c.erreur} /><BoutonPDF /></>}
      />
      {c.erreur && <Note ton="warn">{c.erreur}</Note>}
      <Onglets onglets={onglets} actif="" />

      {/* Acquisition */}
      <section id="acquisition" aria-label="Acquisition" className="space-y-3 scroll-mt-20">
        <h2 className="cc-eyebrow">Acquisition</h2>
        <GrilleKpi>{[M("visiteurs"), M("nouveaux_marchands"), K(convVisiteurs), M("cac")]}</GrilleKpi>
        {v.filtreActif() && <p className="cc-faint text-[11.5px]">Visiteurs, conversion et CAC ne sont calculés que sans segment : le trafic et les dépenses ne sont pas rattachés à un marchand.</p>}
        <div className="grid gap-3 lg:grid-cols-2">
          <Carte titre="Inscriptions" sousTitre={`Nouveaux comptes marchands · ${f.libelle.toLowerCase()}`}>
            {inscr.every((x) => !x) ? <EtatVide titre="Aucune inscription sur la période" explication="Élargissez la période ou les filtres." /> : <Barres donnees={serieInscr} series={[{ cle: "inscriptions", nom: "Inscriptions" }]} format="nombre" hauteur={220} />}
          </Carte>
          <Carte titre="Inscriptions par source d'acquisition" sousTitre="Canal déclaré à l'inscription">
            {sansAcq ? <EtatVide titre="Source d'acquisition non suivie" explication="Axso n'enregistre pas encore le canal d'acquisition des marchands (UTM / « Comment nous avez-vous connu ? » à l'inscription). Ajoutez ce suivi pour ventiler les inscriptions." />
              : <ListeBarres format="nombre" lignes={canaux.filter((x) => x.inscrits > 0).map((x) => ({ cle: x.canal, nom: SOURCES_ACQ[x.canal] ?? x.canal, valeur: x.inscrits, sous: x.conversion != null ? `${formatValeur(x.conversion, "pct")} des visiteurs` : undefined, href: L("/admin/marchands", { acq: x.canal }) }))} />}
          </Carte>
        </div>
        {!sansAcq && (
          <Carte titre="Performance par canal" sousTitre="Visiteurs, inscriptions, dépenses et CAC par canal · cliquer un canal ouvre ses marchands">
            <TableauInteractif colonnes={colCanaux} lignes={lignesCanaux} nomExport="axso-acquisition-canaux" recherche={false} />
          </Carte>
        )}
        <Carte titre="Campagnes" sousTitre="Dépenses par campagne · le CAC affiché est celui du canal (une inscription n'est pas rattachée à une campagne précise)">
          {sansMkt ? <EtatVide titre="Dépenses marketing non enregistrées" explication="Les dépenses publicitaires (Meta, Google, TikTok…) ne sont pas encore saisies dans Axso. Importez-les depuis les régies pour obtenir CAC et ROI par campagne." />
            : v.filtreActif() ? <EtatVide titre="Indisponible avec un segment" explication="Les dépenses ne sont pas rattachées à un marchand : retirez les filtres pays / plan / secteur." />
            : <TableauInteractif recherche={false} nomExport="axso-campagnes" colonnes={[{ cle: "nom", nom: "Campagne" }, { cle: "canal", nom: "Canal", filtrable: true }, { cle: "depenses", nom: "Dépenses", format: "xaf", droite: true }, { cle: "inscritsCanal", nom: "Inscriptions du canal", format: "nombre", droite: true }, { cle: "cacCanal", nom: "CAC du canal", format: "xaf", droite: true }]}
                lignes={campagnes.map((x) => ({ _id: x.nom, nom: x.nom, canal: SOURCES_ACQ[x.canal] ?? x.canal, depenses: x.depenses, inscritsCanal: x.inscritsCanal, cacCanal: x.cacCanal }))} vide="Aucune dépense sur la période" />}
        </Carte>
      </section>

      {/* Activation */}
      <section id="activation" aria-label="Activation" className="space-y-3 scroll-mt-20">
        <h2 className="cc-eyebrow">Activation</h2>
        <div className="grid gap-3 lg:grid-cols-[1fr_2fr]">
          <div className="grid gap-3 content-start">
            {M("activation")}
            <Carte titre="Étape d'activation" actions={peutVoir(session.role, "reglages") ? <Link href={L("/admin/reglages#activation")} className="cc-btn cc-btn-ghost cc-btn-sm"><Settings2 size={12} />Modifier</Link> : undefined}>
              <p className="text-[13.5px] font-medium">{NOM_ETAPE[etapeConf]}</p>
              <p className="cc-faint text-[12px] mt-1">Un marchand est « activé » s'il atteint cette étape dans les 14 jours suivant son inscription. Seuls les inscrits d'au moins 14 jours sont comptés.</p>
            </Carte>
          </div>
          <Carte titre="Entonnoir d'activation" sousTitre={`Inscrits de la période ayant eu 14 jours pour avancer · taux d'étape ${f.libelleComp}`} actions={fa.etapes[0].nombre ? <BoutonsExport nom="axso-entonnoir-activation" colonnes={colEntonnoir} lignes={lignesEntonnoir} pdf={false} /> : undefined}>
            {fa.etapes[0].nombre < 5 ? <EtatVide titre="Volume insuffisant" explication="Moins de 5 inscrits de plus de 14 jours sur la période : l'entonnoir ne serait pas représentatif. Élargissez la période." /> : (
              <ol className="space-y-2.5">
                {fa.etapes.map((e, i) => {
                  const d = i ? e.tauxEtape - fb.etapes[i].tauxEtape : null;
                  const estConf = e.id === etapeConf;
                  return (
                    <li key={e.id}>
                      <Link href={L("/admin/marchands")} className="block rounded-md hover:opacity-85" aria-label={`${e.nom} : ${e.nombre} marchands, voir les marchands`}>
                        <div className="flex items-baseline justify-between gap-3 text-[13px]">
                          <span className="truncate">{e.nom}{estConf && <span className="cc-badge cc-badge-accent ml-2">Activation</span>}</span>
                          <span className="cc-num shrink-0 flex items-baseline gap-3">
                            <strong>{formatValeur(e.nombre, "nombre", true)}</strong>
                            <span className="cc-faint w-14 text-right">{formatValeur(e.taux, "pct")}</span>
                            <span className="w-20 text-right">{i ? <Delta variation={fb.etapes[0].nombre ? d : null} format="pct" petit /> : <span className="cc-faint text-[11.5px]">—</span>}</span>
                          </span>
                        </div>
                        <div className="h-2 mt-1 rounded-full" style={{ background: "var(--cc-surface-3)" }}>
                          <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, e.taux * 100)}%`, background: "var(--cc-s1)" }} />
                        </div>
                        {i > 0 && <p className="cc-faint text-[11px] mt-0.5">{formatValeur(e.tauxEtape, "pct")} de l'étape précédente{fb.etapes[0].nombre ? ` · ${formatValeur(fb.etapes[i].tauxEtape, "pct")} sur la période précédente` : ""}</p>}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Carte>
        </div>
      </section>

      {/* Conversion */}
      <section id="conversion" aria-label="Conversion" className="space-y-3 scroll-mt-20">
        <h2 className="cc-eyebrow">Conversion</h2>
        <GrilleKpi colonnes={3}>{[M("conversion_payante"), K(passesPayants), ...(voitRevenus ? [M("arpu")] : [])]}</GrilleKpi>
      </section>

      {/* Rétention */}
      <section id="retention" aria-label="Rétention" className="space-y-3 scroll-mt-20">
        <h2 className="cc-eyebrow">Rétention</h2>
        <GrilleKpi colonnes={4}>{[M("churn"), M("dau"), M("wau"), M("mau"), M("stickiness"), K(reactiv), K(dorm)]}</GrilleKpi>
        <Carte titre="Cohortes de rétention" sousTitre="Part de chaque cohorte hebdomadaire d'inscription active pendant la semaine S1, S2, S4, S8 et S12" actions={totalCoh >= 10 ? <BoutonsExport nom="axso-cohortes" colonnes={colCoh} lignes={lignesCoh} pdf={false} /> : undefined}>
          {totalCoh < 10 ? <EtatVide titre="Volume insuffisant" explication="Moins de 10 inscrits sur les 16 dernières semaines : la rétention par cohorte ne serait pas significative." /> : (
            <div className="overflow-x-auto -mx-4">
              <table className="cc-table" aria-label="Rétention par cohorte">
                <thead><tr><th>Cohorte</th><th className="r">Inscrits</th>{SEMAINES_COHORTE.map((k) => <th key={k} className="r">S{k}</th>)}</tr></thead>
                <tbody>
                  {coh.filter((x) => x.taille > 0).map((x) => (
                    <tr key={x.debut}>
                      <td className="cc-num">{dateCourte(x.debut)}</td>
                      <td className="r cc-num">{x.taille}</td>
                      {x.retention.map((r, i) => {
                        const alpha = r == null || x.taille < 5 ? 0 : Math.round(8 + Math.min(1, r) * 82);
                        return (
                          <td key={i} className="r cc-num" style={{ background: alpha ? `color-mix(in srgb, var(--cc-s1) ${alpha}%, transparent)` : undefined, color: alpha > 50 ? "#fff" : undefined }}>
                            {r == null || x.taille < 5 ? <span className="cc-faint">—</span> : formatValeur(r, "pct")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="cc-faint text-[11px] mt-3">Actif = au moins une commande, un usage produit ou une requête Axia dans la semaine. « — » : semaine pas encore écoulée ou cohorte de moins de 5 inscrits (non significative).</p>
        </Carte>
      </section>

      {/* Expansion */}
      {voitRevenus && (
        <section id="expansion" aria-label="Expansion" className="space-y-3 scroll-mt-20">
          <h2 className="cc-eyebrow">Expansion</h2>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {M("nrr")}
            {K(mrrExpansion)}
            {peutVoir(session.role, "succes") && (
              <Link href={L("/admin/succes-client#expansion")} className="cc-card cc-hover p-3.5 flex flex-col justify-between gap-2">
                <p className="text-[12px] font-medium cc-muted">Expansion Radar</p>
                <p className="text-[13px]">Marchands proches des limites de leur plan, candidats à un upgrade.</p>
                <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: "var(--cc-accent-text)" }}>Ouvrir le radar <ArrowRight size={12} /></span>
              </Link>
            )}
          </div>
        </section>
      )}

      <p className="cc-faint text-[11px] text-center pt-2">Variations : {formatVariation(0.1, "nombre")} = hausse relative ; « pt » = écart en points de pourcentage. Les écarts entre canaux sont des corrélations observées, pas des preuves de causalité.</p>
    </div>
  );
}
