import Link from "next/link";
import { contexteCC } from "@/lib/command-center/serveur";
import { Vue, mesurer, ventiler } from "@/lib/command-center/moteur";
import { lien } from "@/lib/command-center/contexte";
import { formatValeur } from "@/lib/command-center/format";
import { grouper, mesureLibre } from "@/lib/command-center/commerce";
import { statsPays, dansPays, CENTROIDE, NOM_OPPORTUNITE, type Opportunite } from "@/lib/command-center/geographie";
import { EnTetePage, Carte, Kpi, GrilleKpi, Badge, ListeBarres, EtatVide, Note, Fraicheur } from "@/components/command-center/ui";
import { BoutonPDF, TableauInteractif } from "@/components/command-center/client";
import { CarteAfrique } from "@/components/command-center/CarteAfrique";

const CRITERE: Record<Opportunite, string> = {
  demande: "GMV par marchand actif ≥ 1,5 × la médiane des pays (au moins 3 marchands actifs) : les marchands y vendent beaucoup, recruter en priorité.",
  penetration: "Marchands par million d'habitants ≤ la moitié de la médiane des pays (population ≥ 5 M) : marché peu couvert au regard de sa taille.",
  croissance: "GMV en hausse d'au moins 20 % vs la période précédente (base ≥ 100 000 FCFA) : dynamique à accompagner.",
};
const TON: Record<Opportunite, "good" | "info" | "violet"> = { demande: "good", penetration: "info", croissance: "violet" };

export default async function Geographie({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("geographie", searchParams);
  const { vue: v, fen: f, filtres } = c;
  const L = (p: string, s = {}) => lien(p, filtres, s);
  const pays = filtres.pays;

  // Le tableau, la carte et les opportunités comparent les pays entre eux : on les calcule sans le filtre pays.
  let tous = v;
  if (pays) { tous = new Vue(c.ds, { ...filtres, pays: undefined }); tous.etapeActivation = v.etapeActivation; }
  const lignes = statsPays(tous, f);
  const ici = pays ? lignes.find((l) => l.pays === pays) : undefined;

  const points = lignes.filter((l) => CENTROIDE[l.pays]).map((l) => ({
    iso: l.pays, nom: l.nom, lat: CENTROIDE[l.pays][0], lng: CENTROIDE[l.pays][1], marchands: l.marchands, gmv: l.gmv, commandes: l.commandes, croissance: l.croissance, href: L("/admin/geographie", { pays: l.pays }),
  }));

  const M = (id: string) => mesurer(v, id, f.cur, f.prev, 12);
  const kpis = pays
    ? [M("marchands_actifs"), M("gmv"), M("revenu"), M("commandes"), M("panier_moyen"), M("conversion_payante"), M("churn"), M("nouveaux_marchands")]
    : [
      mesureLibre({ id: "pays", nom: "Pays couverts", format: "nombre", valeur: lignes.length, page: "/admin/geographie", description: "Pays où au moins un marchand est inscrit", formule: "Pays distincts des marchands" }),
      mesureLibre({ id: "pays_actifs", nom: "Pays actifs", format: "nombre", valeur: lignes.filter((l) => l.actifs > 0).length, page: "/admin/geographie", description: "Pays avec au moins un marchand actif sur la période", formule: "Pays distincts des marchands actifs" }),
      M("marchands_actifs"), M("gmv"),
    ];

  const industries = pays ? [...ventiler(v, "gmv", f.cur, "industrie")].filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).slice(0, 8) : [];
  const topMarchands = pays ? [...grouper(v.payees(f.cur), (x) => x.marchandId)].map(([id, l]) => ({ cle: id, nom: v.parId.get(id)?.nom ?? id, valeur: l.reduce((s, x) => s + x.montant, 0) })).sort((a, b) => b.valeur - a.valeur).slice(0, 8) : [];

  const tableau = lignes.map((l) => ({
    _id: l.pays, _href: L("/admin/geographie", { pays: l.pays }), pays: l.nom, marchands: l.marchands, actifs: l.actifs, gmv: l.gmv, revenu: l.revenu,
    croissance: l.croissance, conversion: l.conversion, churn: l.churn, panier: l.panier, parMillion: l.parMillion, opportunites: l.opportunites.map((o) => NOM_OPPORTUNITE[o]).join(", ") || null,
  }));

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Africa Intelligence" titre={pays ? `Axso ${dansPays(pays)}` : "Axso en Afrique"}
        sousTitre={<>{pays ? <><Link href={L("/admin/geographie", { pays: null })} className="hover:underline" style={{ color: "var(--cc-accent-text)" }}>← Tous les pays</Link> · </> : "Marchés, pénétration et opportunités · "}<span className="cc-faint">{f.libelle} {f.libelleComp}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><BoutonPDF /></>} />
      {c.erreur && <Note ton="warn">{c.erreur}</Note>}
      {pays && !ici && <Note>Aucun marchand inscrit dans ce pays sur le segment choisi.</Note>}

      <GrilleKpi>{kpis.map((m) => <Kpi key={m.id} m={m} filtres={filtres} libelleComp={f.libelleComp} />)}</GrilleKpi>

      {ici && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Carte titre="Le marché" sousTitre="Position par rapport aux autres pays">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12.5px]">
              <div><dt className="cc-faint">Population</dt><dd className="cc-num font-medium">{ici.population ? `${formatValeur(ici.population, "nombre")} M hab.` : "—"}</dd></div>
              <div><dt className="cc-faint">Marchands / M hab.</dt><dd className="cc-num font-medium">{ici.parMillion == null ? "—" : formatValeur(ici.parMillion, "nombre")}</dd></div>
              <div><dt className="cc-faint">GMV / marchand actif</dt><dd className="cc-num font-medium">{formatValeur(ici.gmvParActif, "xaf")}</dd></div>
              <div><dt className="cc-faint">Rang GMV</dt><dd className="cc-num font-medium">{lignes.indexOf(ici) + 1} / {lignes.length}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t cc-sep">
              {ici.opportunites.length ? ici.opportunites.map((o) => <Badge key={o} ton={TON[o]} titre={CRITERE[o]}>{NOM_OPPORTUNITE[o]}</Badge>) : <span className="cc-faint text-[12px]">Aucun signal d'opportunité particulier.</span>}
            </div>
          </Carte>
          <Carte titre="Industries" sousTitre="GMV par secteur">
            <ListeBarres format="xaf" lignes={industries.map(([k, x]) => ({ cle: k, nom: k, valeur: x, href: L("/admin/commerce", { industrie: k }) }))} />
          </Carte>
          <Carte titre="Marchands leaders" sousTitre="GMV sur la période">
            <ListeBarres format="xaf" lignes={topMarchands} />
          </Carte>
        </div>
      )}

      <Carte titre="Carte de l'Afrique" sousTitre="Un cercle par pays · cliquer pour ouvrir le pays">
        <CarteAfrique points={points} actif={pays} />
      </Carte>

      <Carte titre="Market Opportunity" sousTitre="Classement relatif entre les pays où Axso est présent — un signal à vérifier, pas une étude de marché">
        {lignes.length < 2 ? <EtatVide titre="Pas assez de pays" explication="Il faut des marchands dans au moins deux pays pour les comparer entre eux." /> : (
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(CRITERE) as Opportunite[]).map((o) => {
              const liste = lignes.filter((l) => l.opportunites.includes(o));
              return (
                <div key={o} className="min-w-0">
                  <p className="flex items-center gap-2"><Badge ton={TON[o]}>{NOM_OPPORTUNITE[o]}</Badge><span className="cc-faint text-[12px]">{liste.length} pays</span></p>
                  <p className="cc-faint text-[11.5px] mt-1.5">{CRITERE[o]}</p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {liste.length ? liste.map((l) => <li key={l.pays}><Link href={L("/admin/geographie", { pays: l.pays })} className="cc-btn cc-btn-ghost cc-btn-sm">{l.nom}</Link></li>) : <li className="cc-faint text-[12px]">Aucun pays.</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Carte>

      <Carte titre="Par pays" sousTitre="Croissance = GMV vs période précédente · Rétention = churn des abonnés · cliquer pour ouvrir le pays">
        {tableau.length ? (
          <TableauInteractif nomExport="axso-par-pays" lignes={tableau}
            colonnes={[
              { cle: "pays", nom: "Pays" }, { cle: "marchands", nom: "Marchands", format: "nombre", droite: true }, { cle: "actifs", nom: "Actifs", format: "nombre", droite: true },
              { cle: "gmv", nom: "GMV", format: "xaf", droite: true }, { cle: "revenu", nom: "Revenu", format: "xaf", droite: true }, { cle: "croissance", nom: "Croissance", format: "pct", droite: true },
              { cle: "conversion", nom: "Conv. payante", format: "pct", droite: true }, { cle: "churn", nom: "Churn", format: "pct", droite: true }, { cle: "panier", nom: "Panier moyen", format: "xaf", droite: true },
              { cle: "parMillion", nom: "Marchands / M hab.", format: "nombre", droite: true }, { cle: "opportunites", nom: "Opportunités" },
            ]} />
        ) : <EtatVide titre="Aucun marchand" explication="Aucun marchand sur ce périmètre. Élargissez les filtres." />}
        <p className="cc-faint text-[11px] mt-3">Population : ONU, World Population Prospects 2024 (arrondis). Un pays sans population connue n'entre pas dans le critère de pénétration.</p>
      </Carte>
    </div>
  );
}
