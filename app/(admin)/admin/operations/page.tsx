import Link from "next/link";
import { contexteCC } from "@/lib/command-center/serveur";
import { mesurer, valeur } from "@/lib/command-center/moteur";
import { JOUR, lien } from "@/lib/command-center/contexte";
import { peutVoir } from "@/lib/command-center/rbac";
import type { Commande } from "@/lib/command-center/types";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { mesureLibre, noteLineaire, scoreOps, grouper, type ComposanteOps } from "@/lib/command-center/commerce";
import { EnTetePage, Carte, Kpi, GrilleKpi, Badge, Jauge, Progression, ListeBarres, EtatVide, Note, Fraicheur, Tableau, tonScore } from "@/components/command-center/ui";
import { BoutonPDF, TableauInteractif } from "@/components/command-center/client";

const H48 = 2 * JOUR;
const MAX_ECHECS = 1000;
const MIN = 20;
const GRAVITE = { critique: { ton: "bad", penalite: 40 }, majeur: { ton: "warn", penalite: 25 }, mineur: { ton: "neutre", penalite: 10 } } as const;
/** Commande qui doit partir en livraison : payée, ou paiement à la livraison pas encore encaissé. */
const aExpedier = (c: Commande) => c.livraison !== "sans_objet" && (c.statut === "payee" || (c.statut === "en_attente" && c.methode.includes("cod")));

export default async function Operations({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [c, tx] = await Promise.all([contexteCC("operations", searchParams), getT()]);
  const { formatValeur, dateCourte } = formats(tx);
  const { vue: v, fen: f, filtres, session } = c;
  const voirMarchands = peutVoir(session.role, "marchands");
  const L = (p: string, s = {}) => lien(p, filtres, s);
  const t = v.maintenant;

  const cmds = v.commandesW(f.cur);
  const aLivrer = cmds.filter(aExpedier);
  const retard = aLivrer.filter((x) => x.livraison === "non_expediee" && x.date < t - H48);
  const retardPrev = v.commandesW(f.prev).filter((x) => aExpedier(x) && x.livraison === "non_expediee" && x.date < f.prev.fin - H48);
  const enEchec = cmds.filter((x) => x.livraison === "echec" || x.statut === "echouee");

  const sansTickets = c.ds.manques.includes("tickets"), sansIncidents = c.ds.manques.includes("incidents");
  const tickets = sansTickets ? [] : c.ds.tickets.filter((x) => v.parId.has(x.marchandId) && x.date <= t);
  const ouverts = tickets.filter((x) => x.resoluLe == null);
  const resolus = tickets.filter((x) => x.resoluLe != null && x.resoluLe > x.date && x.resoluLe >= f.cur.debut && x.resoluLe < f.cur.fin);
  const resolutionH = resolus.length ? resolus.reduce((s, x) => s + (x.resoluLe! - x.date), 0) / resolus.length / 3_600_000 : null;
  const incidents = sansIncidents ? [] : c.ds.incidents.filter((x) => x.resoluLe == null || (x.date < f.cur.fin && x.date >= f.cur.debut)).sort((a, b) => b.date - a.date);
  const incidentsOuverts = incidents.filter((x) => x.resoluLe == null);
  const actifs = v.actifs({ debut: t - 30 * JOUR, fin: t + 1 }).size;

  // ─── Operational Health ───
  // Sous MIN commandes, un taux ne veut rien dire (2 retards sur 5 = 40 %) : la composante est exclue.
  const assez = aLivrer.length >= MIN;
  const tauxLivraison = assez ? valeur(v, "livraison", f.cur) : null, delai = assez ? valeur(v, "delai_livraison", f.cur) : null;
  const partRetard = assez ? retard.length / aLivrer.length : null;
  const partEchec = cmds.length >= MIN ? enEchec.length / cmds.length : null;
  const penalite = incidentsOuverts.reduce((s, x) => s + GRAVITE[x.gravite].penalite, 0);
  const ticketsParActif = !sansTickets && actifs ? ouverts.length / actifs : null;
  const composantes: ComposanteOps[] = [
    { id: "livraison", nom: "Taux de livraison", poids: 25, valeur: tauxLivraison, format: "pct", score: tauxLivraison == null ? null : noteLineaire(tauxLivraison, 0.98, 0.8), regle: "98 % → 100 · 80 % → 0" },
    { id: "delai", nom: "Délai de livraison", poids: 20, valeur: delai, format: "heures", score: delai == null ? null : noteLineaire(delai, 24, 96), regle: "≤ 24 h → 100 · ≥ 96 h → 0" },
    { id: "retard", nom: "Non expédiées > 48 h", poids: 20, valeur: partRetard, format: "pct", score: partRetard == null ? null : noteLineaire(partRetard, 0, 0.2), regle: "0 % → 100 · ≥ 20 % des commandes à livrer → 0" },
    { id: "echecs", nom: "Opérations en échec", poids: 15, valeur: partEchec, format: "pct", score: partEchec == null ? null : noteLineaire(partEchec, 0.02, 0.15), regle: "(livraisons + paiements échoués) ÷ commandes : ≤ 2 % → 100 · ≥ 15 % → 0" },
    { id: "incidents", nom: "Incidents ouverts", poids: 10, valeur: sansIncidents ? null : incidentsOuverts.length, format: "nombre", score: sansIncidents ? null : Math.max(0, 100 - penalite), regle: "100 − 40 par critique, 25 par majeur, 10 par mineur" },
    { id: "tickets", nom: "Tickets support ouverts", poids: 10, valeur: sansTickets ? null : ouverts.length, format: "nombre", score: ticketsParActif == null ? null : noteLineaire(ticketsParActif, 0, 0.05), regle: "tickets ouverts ÷ marchands actifs 30 j : 0 → 100 · ≥ 5 % → 0" },
  ];
  const score = scoreOps(composantes);
  const pire = composantes.filter((x) => x.score != null).sort((a, b) => a.score! - b.score!)[0];

  const kpis = [
    mesurer(v, "livraison", f.cur, f.prev, 12),
    mesurer(v, "delai_livraison", f.cur, f.prev, 12),
    mesureLibre({ id: "retard", nom: tx("Non expédiées > 48 h"), format: "nombre", sens: -1, valeur: retard.length, precedente: retardPrev.length, page: "/admin/operations", description: tx("Commandes à livrer, toujours pas expédiées 48 h après leur création"), formule: tx("Commandes payées (ou à la livraison) non expédiées depuis plus de 48 h") }),
    mesureLibre({ id: "echecs_ops", nom: tx("Opérations en échec"), format: "nombre", sens: -1, valeur: enEchec.length, precedente: v.commandesW(f.prev).filter((x) => x.livraison === "echec" || x.statut === "echouee").length, page: "/admin/operations#echecs", description: tx("Livraisons échouées et paiements échoués"), formule: tx("Livraisons en échec + paiements échoués") }),
  ];

  const statuts = [
    { cle: "non_expediee", nom: "Non expédiées" }, { cle: "expediee", nom: "Expédiées (en cours)" }, { cle: "livree", nom: "Livrées" }, { cle: "echec", nom: "Échecs de livraison" },
  ].map((s) => ({ ...s, nom: tx(s.nom), valeur: aLivrer.filter((x) => x.livraison === s.cle).length }));

  const echecs = enEchec.slice(-MAX_ECHECS).reverse().map((x) => ({
    _id: x.id, _href: voirMarchands ? L(`/admin/marchands/${x.marchandId}`) : undefined, marchand: v.parId.get(x.marchandId)?.nom ?? "—", type: tx(x.statut === "echouee" ? "Paiement" : "Livraison"), montant: x.montant, date: x.date,
  }));

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow={tx("Opérations")} titre={tx("Opérations")} sousTitre={<>{tx("Livraison, support et incidents")} · <span className="cc-faint">{tx(f.libelle)} {tx(f.libelleComp)}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><BoutonPDF /></>} />
      {c.erreur && <Note ton="warn">{tx(c.erreur)}</Note>}

      <div className="grid gap-3 xl:grid-cols-[1fr_1.4fr]">
        <Carte titre="Operational Health" sousTitre={tx("Score composite /100 · moyenne pondérée des composantes mesurables")}>
          <div className="flex items-center gap-4">
            <Jauge score={score} taille={104} libelle={tx("Santé opérationnelle")} />
            <div className="min-w-0 text-[12.5px] space-y-1.5">
              {score == null ? <p className="cc-faint">{tx("Pas assez de données opérationnelles sur la période.")}</p> : <p>{tx("Score")} <strong>{score}/100</strong> — <Badge ton={tonScore(score)}>{tx(score >= 75 ? "Sain" : score >= 50 ? "À surveiller" : "Dégradé")}</Badge></p>}
              {pire && pire.score! < 75 && <p><span className="cc-faint">{tx("Point faible :")} </span><strong>{tx(pire.nom)}</strong> ({formatValeur(pire.valeur, pire.format)}, {pire.score}/100)</p>}
              <p className="cc-faint text-[11.5px]">{tx("Les composantes sans donnée (ou avec moins de {0} commandes) sont exclues et les poids restants renormalisés.", MIN)}</p>
            </div>
          </div>
        </Carte>
        <Carte titre={tx("Formule")} sousTitre={tx("Score = Σ (note × poids) ÷ Σ poids des composantes disponibles")}>
          <Tableau colonnes={[{ cle: "nom", nom: tx("Composante") }, { cle: "poids", nom: tx("Poids"), droite: true }, { cle: "val", nom: tx("Valeur"), droite: true }, { cle: "note", nom: tx("Note"), droite: true }, { cle: "regle", nom: tx("Barème") }]}
            lignes={composantes.map((x) => ({
              nom: tx(x.nom), poids: tx("{0} %", x.poids), val: x.valeur == null ? <span className="cc-faint">—</span> : formatValeur(x.valeur, x.format),
              note: x.score == null ? <span className="cc-faint">{tx("exclue")}</span> : <span className="inline-flex items-center gap-2"><span className="w-12 hidden sm:block"><Progression valeur={x.score / 100} ton={tonScore(x.score) === "neutre" ? undefined : (tonScore(x.score) as "good" | "warn" | "bad")} /></span>{x.score}</span>,
              regle: <span className="cc-faint text-[12px] whitespace-normal block min-w-[200px]">{tx(x.regle)}</span>,
            }))} />
        </Carte>
      </div>

      <GrilleKpi>{kpis.map((m) => <Kpi key={m.id} m={m} filtres={filtres} libelleComp={f.libelleComp} />)}</GrilleKpi>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Carte titre="Fulfillment" sousTitre={tx("{0} commandes à livrer · {1}", aLivrer.length.toLocaleString(tx.loc), tx(f.libelle).toLowerCase())}>
          {aLivrer.length ? <ListeBarres format="nombre" lignes={statuts} /> : <EtatVide titre={tx("Aucune commande à livrer")} explication={tx("Les commandes en ligne payées (ou payables à la livraison) apparaissent ici.")} />}
        </Carte>

        <Carte titre="Support" sousTitre={tx("Tickets des marchands du périmètre")}>
          {sansTickets ? <EtatVide titre={tx("Support non connecté")} explication={tx("Les tickets support ne sont pas encore enregistrés dans Axso. Connectez l'outil de support (ou créez un modèle Ticket) pour suivre volume et délai de résolution.")} /> : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div><p className="cc-faint text-[11px]">{tx("Ouverts")}</p><p className="cc-num text-[18px] font-semibold">{ouverts.length}</p></div>
                <div><p className="cc-faint text-[11px]">{tx("Résolus (période)")}</p><p className="cc-num text-[18px] font-semibold">{resolus.length}</p></div>
                <div><p className="cc-faint text-[11px]">{tx("Résolution moy.")}</p><p className="cc-num text-[18px] font-semibold">{formatValeur(resolutionH, "heures")}</p></div>
              </div>
              <p className="cc-eyebrow mb-2">{tx("Tickets ouverts par sujet")}</p>
              {ouverts.length ? <ListeBarres format="nombre" lignes={[...grouper(ouverts, (x) => x.sujet)].map(([k, l]) => ({ cle: k, nom: tx(k), valeur: l.length })).sort((a, b) => b.valeur - a.valeur)} /> : <p className="cc-good text-[13px]">{tx("Aucun ticket ouvert.")}</p>}
            </>
          )}
        </Carte>

        <Carte titre={tx("Incidents système")} sousTitre={tx("Ouverts, ou survenus sur la période")}>
          {sansIncidents ? <EtatVide titre={tx("Incidents non suivis")} explication={tx("Aucun journal d'incidents n'est encore enregistré dans Axso. Branchez la supervision (statut des prestataires, erreurs serveur) pour les voir ici.")} /> : !incidents.length ? <EtatVide titre={tx("Aucun incident")} explication={tx("Aucun incident ouvert ni survenu sur la période.")} /> : (
            <ul className="divide-y cc-sep -mx-4">
              {incidents.map((x) => (
                <li key={x.id} className="px-4 py-2.5 flex items-start gap-2.5">
                  <Badge ton={GRAVITE[x.gravite].ton}>{tx(x.gravite)}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium">{tx(x.titre)}</p>
                    <p className="cc-faint text-[11.5px]">{dateCourte(x.date)} · {x.resoluLe == null ? <span className="cc-bad">{tx("Ouvert")}</span> : tx("Résolu en {0}", formatValeur((x.resoluLe - x.date) / 3_600_000, "heures"))}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      <Carte id="echecs" titre={tx("Opérations en échec")} sousTitre={tx("Livraisons et paiements échoués · {0}", tx(f.libelle).toLowerCase())} actions={<Link href={L("/admin/paiements")} className="cc-btn cc-btn-ghost cc-btn-sm">{tx("Paiements")}</Link>}>
        {echecs.length ? (
          <TableauInteractif nomExport="operations-en-echec" parPage={20} lignes={echecs}
            colonnes={[{ cle: "marchand", nom: tx("Marchand") }, { cle: "type", nom: tx("Type"), format: "badge", filtrable: true, tons: { [tx("Paiement")]: "bad", [tx("Livraison")]: "warn" } }, { cle: "montant", nom: tx("Montant"), format: "xaf", droite: true }, { cle: "date", nom: tx("Date"), format: "date" }]} />
        ) : <EtatVide titre={tx("Aucune opération en échec")} explication={tx("Aucune livraison ni aucun paiement échoué sur la période.")} />}
      </Carte>
    </div>
  );
}
