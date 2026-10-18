import type { ReactNode } from "react";
import { contexteCC } from "@/lib/command-center/serveur";
import { mesurer, valeur, ventiler } from "@/lib/command-center/moteur";
import { JOUR, lien, type Fenetre } from "@/lib/command-center/contexte";
import { nomPays } from "@/lib/command-center/types";
import { formatValeur } from "@/lib/command-center/format";
import { mesureLibre, tauxRachat, tranches, etiquette, grouper } from "@/lib/command-center/commerce";
import { EnTetePage, Carte, Kpi, GrilleKpi, Delta, ListeBarres, EtatVide, Note, Fraicheur, Tableau } from "@/components/command-center/ui";
import { BoutonPDF } from "@/components/command-center/client";
import { Courbes, Barres } from "@/components/command-center/graphiques";

const SANTE = ["gmv", "commandes", "panier_moyen", "annulation", "remboursement"] as const;

export default async function Commerce({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("commerce", searchParams);
  const { vue: v, fen: f, filtres } = c;
  const L = (p: string, s = {}) => lien(p, filtres, s);
  const t = v.maintenant;
  const M = (id: string) => mesurer(v, id, f.cur, f.prev, 12);

  const nbProduits = v.marchands.reduce((s, m) => s + m.nbProduits, 0);
  const industries = new Set(v.marchands.map((m) => m.industrie)).size;
  const kpis = [
    M("gmv"), M("commandes"), M("panier_moyen"),
    mesureLibre({ id: "rachat", nom: "Commandes répétées", format: "pct", valeur: tauxRachat(v.commandesW(f.cur)), precedente: tauxRachat(v.commandesW(f.prev)), serie: tranches(f.cur, 8).map((w) => tauxRachat(v.commandesW(w))), page: "/admin/commerce", description: "Clients revenus acheter chez le même marchand", formule: "Clients avec ≥ 2 commandes payées ÷ clients ayant payé (min. 5 clients)" }),
    M("annulation"), M("remboursement"),
    mesureLibre({ id: "produits", nom: "Produits en ligne", format: "nombre", valeur: nbProduits, page: "/admin/marchands", description: "Catalogue total des marchands du périmètre (valeur actuelle)", formule: "Σ produits des marchands" }),
    mesureLibre({ id: "industries", nom: "Catégories", format: "nombre", valeur: industries, page: "/admin/commerce#industries", description: "Secteurs d'activité représentés", formule: "Nombre d'industries distinctes" }),
  ];

  // Commerce Health : fenêtres fixes, indépendantes de la période choisie, chacune comparée à la précédente de même durée.
  const minuit = Math.floor(t / JOUR) * JOUR;
  const fen: { nom: string; w: Fenetre; d: number }[] = [
    { nom: "Aujourd'hui", w: { debut: minuit, fin: t + 1 }, d: JOUR },
    { nom: "Hier", w: { debut: minuit - JOUR, fin: minuit }, d: JOUR },
    { nom: "7 j", w: { debut: t - 7 * JOUR, fin: t + 1 }, d: 7 * JOUR },
    { nom: "30 j", w: { debut: t - 30 * JOUR, fin: t + 1 }, d: 30 * JOUR },
    { nom: "90 j", w: { debut: t - 90 * JOUR, fin: t + 1 }, d: 90 * JOUR },
    { nom: "YTD", w: { debut: Date.UTC(new Date(t).getUTCFullYear(), 0, 1), fin: t + 1 }, d: 365 * JOUR },
  ];
  const NOMS: Record<string, string> = { gmv: "GMV", commandes: "Commandes", panier_moyen: "Panier moyen", annulation: "Taux d'annulation", remboursement: "Taux de remboursement" };
  const debutDonnees = c.ds.commandes[0]?.date ?? t;
  const sante = SANTE.map((id) => {
    const ligne: Record<string, ReactNode> = { m: <span className="font-medium">{NOMS[id]}</span> };
    for (const x of fen) {
      const m = mesurer(v, id, x.w, { debut: x.w.debut - x.d, fin: x.w.fin - x.d }, 1);
      // Pas de comparaison si la fenêtre précédente commence avant les premières données (variation trompeuse).
      const comparable = x.w.debut - x.d >= debutDonnees;
      ligne[x.nom] = <span className="inline-flex flex-col items-end"><span>{formatValeur(m.valeur, m.format)}</span><Delta variation={comparable ? m.variation : null} format={m.format} sens={m.sens} petit /></span>;
    }
    return ligne;
  });

  const decoupe = tranches(f.cur, 16);
  const serie = decoupe.map((w) => ({ x: etiquette(w.debut, f.cur), gmv: valeur(v, "gmv", w) ?? 0, commandes: valeur(v, "commandes", w) ?? 0 }));

  const payees = v.payees(f.cur);
  const canaux = [...grouper(payees, (x) => x.canal)].map(([k, l]) => ({ cle: k, nom: k === "pos" ? "Caisse (POS)" : "En ligne", valeur: l.reduce((s, x) => s + x.montant, 0), sous: `${l.length.toLocaleString("fr-FR")} cmd` }));
  const parInd = [...ventiler(v, "gmv", f.cur, "industrie")].filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const parPays = [...ventiler(v, "gmv", f.cur, "pays")].filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Commerce" titre="Commerce" sousTitre={<>Ventes des marchands Axso · <span className="cc-faint">{f.libelle} {f.libelleComp}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><BoutonPDF /></>} />
      {c.erreur && <Note ton="warn">{c.erreur}</Note>}

      <GrilleKpi>{kpis.map((m) => <Kpi key={m.id} m={m} filtres={filtres} libelleComp={f.libelleComp} />)}</GrilleKpi>

      <Carte titre="Commerce Health" sousTitre="Fenêtres fixes, indépendantes de la période choisie · variation vs la fenêtre précédente de même durée (YTD : vs même période l'an dernier)">
        <Tableau colonnes={[{ cle: "m", nom: "Indicateur" }, ...fen.map((x) => ({ cle: x.nom, nom: x.nom, droite: true }))]} lignes={sante} />
      </Carte>

      <div className="grid gap-3 lg:grid-cols-2">
        <Carte titre="GMV" sousTitre={f.libelle}>
          {payees.length ? <Courbes donnees={serie} series={[{ cle: "gmv", nom: "GMV" }]} format="xaf" /> : <EtatVide titre="Aucune commande payée" explication="Le GMV apparaîtra dès la première commande payée sur ce périmètre." />}
        </Carte>
        <Carte titre="Commandes payées" sousTitre={f.libelle}>
          {payees.length ? <Barres donnees={serie} series={[{ cle: "commandes", nom: "Commandes" }]} format="nombre" /> : <EtatVide titre="Aucune commande payée" />}
        </Carte>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Carte titre="Par canal" sousTitre="GMV en ligne vs caisse en boutique">
          <ListeBarres format="xaf" lignes={canaux.sort((a, b) => b.valeur - a.valeur)} />
        </Carte>
        <Carte id="industries" titre="Par industrie" sousTitre="GMV · cliquer pour filtrer">
          <ListeBarres format="xaf" lignes={parInd.map(([k, x]) => ({ cle: k, nom: k, valeur: x, href: L("/admin/commerce", { industrie: k }) }))} />
        </Carte>
        <Carte titre="Par pays" sousTitre="GMV · cliquer pour filtrer">
          <ListeBarres format="xaf" lignes={parPays.map(([k, x]) => ({ cle: k, nom: nomPays(k), valeur: x, href: L("/admin/commerce", { pays: k }) }))} />
        </Carte>
      </div>

      <Carte titre="Conversion des boutiques">
        <EtatVide titre="Conversion non mesurée" explication="Axso n'enregistre pas encore les visites des boutiques marchandes : impossible de calculer visites → commandes. Il faut tracer les pages vues des vitrines (événement côté boutique) pour obtenir ce taux." />
      </Carte>
    </div>
  );
}
