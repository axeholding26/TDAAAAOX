import { contexteCC } from "@/lib/command-center/serveur";
import { mesurer, serie } from "@/lib/command-center/moteur";
import { analyseIA } from "@/lib/command-center/ia";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { lien, JOUR } from "@/lib/command-center/contexte";
import { peutVoir } from "@/lib/command-center/rbac";
import { nomPays } from "@/lib/command-center/types";
import { EnTetePage, Carte, Kpi, GrilleKpi, EtatVide, Note, Fraicheur, Tableau, Badge } from "@/components/command-center/ui";
import { TableauInteractif, BoutonPDF } from "@/components/command-center/client";
import { Courbes } from "@/components/command-center/graphiques";

function Chiffre({ nom, valeur, sous }: { nom: string; valeur: string; sous?: string }) {
  return (
    <div className="cc-card p-3.5 min-w-0">
      <p className="text-[12px] font-medium cc-muted truncate">{nom}</p>
      <p className="font-semibold cc-num mt-1 text-[21px] truncate">{valeur}</p>
      {sous && <p className="cc-faint text-[11px] mt-1.5 truncate">{sous}</p>}
    </div>
  );
}

export default async function PageIA({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [c, tx] = await Promise.all([contexteCC("ia", searchParams), getT()]);
  const { formatValeur, dateCourte } = formats(tx);
  const { vue: v, fen: f, filtres, session } = c;
  const L = (p: string) => lien(p, filtres);
  const a = analyseIA(v, f.cur);
  const sansTokens = c.ds.manques.includes("tokens");
  const voitGmv = peutVoir(session.role, "commerce"), voitRevenu = peutVoir(session.role, "revenus");

  const jours = (f.cur.fin - f.cur.debut) / JOUR;
  const n = Math.max(6, Math.min(30, Math.round(jours)));
  const pas = (f.cur.fin - f.cur.debut) / n;
  const req = serie(v, "requetes_ia", f.cur, n), cout = serie(v, "cout_ia", f.cur, n);
  const x = (i: number) => dateCourte(f.cur.debut + pas * (i + 1) - 1);

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Axia AI Intelligence" titre="Axia IA"
        sousTitre={<>{tx("Usage, coût et rentabilité de l'IA")} · <span className="cc-faint">{tx(f.libelle)} {tx(f.libelleComp)}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><BoutonPDF /></>} />
      {c.erreur && <Note ton="warn">{tx(c.erreur)}</Note>}

      <GrilleKpi colonnes={6}>
        {["requetes_ia", "cout_ia", "adoption_ia"].map((id) => <Kpi key={id} m={mesurer(v, id, f.cur, f.prev, 12)} filtres={filtres} libelleComp={f.libelleComp} />)}
        <Chiffre nom="Tokens" valeur={sansTokens ? "—" : formatValeur(a.tokens, "nombre")} sous={sansTokens ? tx("Non enregistrés dans cette source") : tx("{0} par requête", formatValeur(a.requetes ? a.tokens / a.requetes : null, "nombre"))} />
        <Chiffre nom={tx("Coût par requête")} valeur={formatValeur(a.coutParRequete, "xaf")} sous={tx("Coût IA ÷ requêtes")} />
        <Chiffre nom={tx("Marchands utilisateurs")} valeur={formatValeur(a.utilisateurs, "nombre")} sous={tx("Au moins une requête Axia")} />
      </GrilleKpi>

      {!a.requetes ? (
        <Carte><EtatVide titre={tx("Aucune requête Axia sur la période")} explication={tx("Les requêtes apparaissent ici dès que des marchands utilisent Axia (descriptions, images, publicités, conversations, agents). Élargissez la période ou les filtres.")} /></Carte>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Carte titre={tx("Requêtes Axia")} sousTitre={tx(f.libelle)}>
              <Courbes format="nombre" series={[{ cle: "v", nom: tx("Requêtes") }]} donnees={req.map((y, i) => ({ x: x(i), v: y }))} hauteur={200} />
            </Carte>
            <Carte titre={tx("Coût IA")} sousTitre={tx("Coût estimé des appels aux modèles")}>
              <Courbes format="xaf" series={[{ cle: "v", nom: tx("Coût IA"), couleur: "var(--cc-s2)" }]} donnees={cout.map((y, i) => ({ x: x(i), v: y }))} hauteur={200} />
            </Carte>
          </div>

          <Carte titre={tx("Générations par type")} sousTitre={tx("Ce que les marchands demandent à Axia")}>
            <Tableau
              colonnes={[{ cle: "nom", nom: tx("Type") }, { cle: "req", nom: tx("Requêtes"), droite: true }, { cle: "part", nom: tx("Part"), droite: true }, { cle: "m", nom: tx("Marchands"), droite: true }, { cle: "tok", nom: "Tokens", droite: true }, { cle: "cout", nom: tx("Coût"), droite: true }, { cle: "cpr", nom: tx("Coût / requête"), droite: true }]}
              lignes={a.types.filter((t) => t.requetes).sort((p, q) => q.requetes - p.requetes).map((t) => ({
                nom: tx(t.nom), req: formatValeur(t.requetes, "nombre", true), part: formatValeur(t.requetes / a.requetes, "pct"), m: formatValeur(t.marchands, "nombre", true),
                tok: sansTokens ? "—" : formatValeur(t.tokens, "nombre"), cout: formatValeur(t.cout, "xaf"), cpr: formatValeur(t.cout / t.requetes, "xaf"),
              }))} />
            {sansTokens && <p className="cc-faint text-[11.5px] mt-2">{tx("Tokens : la base Axso n'enregistre pas encore le nombre de tokens par appel (seulement le nombre de requêtes et leur coût).")}</p>}
          </Carte>

          <div className="grid gap-3 lg:grid-cols-2">
            <Carte titre="AI ROI" sousTitre={tx("Coût IA rapporté à l'activité des marchands qui utilisent Axia")}>
              {!voitGmv && !voitRevenu ? <EtatVide titre={tx("Réservé aux rôles Commerce / Revenus")} /> : (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                  <div><dt className="cc-faint text-[11.5px]">{tx("Coût IA")}</dt><dd className="cc-num font-semibold text-[17px]">{formatValeur(a.cout, "xaf")}</dd></div>
                  {voitGmv && <div><dt className="cc-faint text-[11.5px]">{tx("GMV assisté par l'IA")}</dt><dd className="cc-num font-semibold text-[17px]">{formatValeur(a.gmvUtilisateurs, "xaf")}</dd><dd className="cc-faint text-[11px]">{tx("GMV total des marchands utilisateurs d'Axia")}</dd></div>}
                  {voitGmv && <div><dt className="cc-faint text-[11.5px]">{tx("Coût IA ÷ GMV des utilisateurs")}</dt><dd className="cc-num font-semibold">{a.coutSurGmv == null ? "—" : formatValeur(a.coutSurGmv, "pct")}</dd></div>}
                  {voitRevenu && <div><dt className="cc-faint text-[11.5px]">{tx("Revenu Axso de ces marchands")}</dt><dd className="cc-num font-semibold">{formatValeur(a.revenuUtilisateurs, "xaf")}</dd><dd className="cc-faint text-[11px]">{tx("Abonnements + commissions")}</dd></div>}
                  {voitRevenu && <div className="col-span-2"><dt className="cc-faint text-[11.5px]">{tx("Coût IA ÷ revenu Axso des utilisateurs")}</dt><dd className="cc-num font-semibold">{a.coutSurRevenu == null ? "—" : formatValeur(a.coutSurRevenu, "pct")} {a.coutSurRevenu != null && <Badge ton={a.coutSurRevenu < 0.3 ? "good" : a.coutSurRevenu < 1 ? "warn" : "bad"}>{tx(a.coutSurRevenu < 1 ? "couvert par le revenu" : "non couvert")}</Badge>}</dd></div>}
                </dl>
              )}
              <p className="cc-faint text-[11.5px] mt-3">{tx("Le « GMV assisté » n'est pas un revenu généré par l'IA : c'est tout le GMV des marchands qui ont utilisé Axia sur la période.")}</p>
            </Carte>

            <Carte titre={tx("Utilisateurs d'Axia vs autres")} sousTitre={tx("Marchands actifs de la période")}>
              {!a.avecIA || !a.sansIA ? <EtatVide titre={tx("Groupes trop petits pour comparer")} explication={tx("Il faut au moins 20 marchands actifs dans chaque groupe (avec et sans Axia).")} /> : (
                <>
                  <Tableau colonnes={[{ cle: "k", nom: "" }, { cle: "a", nom: tx("Avec Axia"), droite: true }, { cle: "b", nom: tx("Sans Axia"), droite: true }]} lignes={[
                    { k: tx("Marchands"), a: formatValeur(a.avecIA.n, "nombre", true), b: formatValeur(a.sansIA.n, "nombre", true) },
                    { k: tx("Ont vendu sur la période"), a: formatValeur(a.avecIA.tauxVente, "pct"), b: formatValeur(a.sansIA.tauxVente, "pct") },
                    { k: tx("Conversion payante"), a: formatValeur(a.avecIA.conversionPayante, "pct"), b: formatValeur(a.sansIA.conversionPayante, "pct") },
                    ...(voitGmv ? [{ k: tx("GMV par marchand"), a: formatValeur(a.avecIA.gmvParMarchand, "xaf"), b: formatValeur(a.sansIA.gmvParMarchand, "xaf") }] : []),
                  ]} />
                  <div className="mt-3"><Note>{tx("Corrélation, pas causalité : les marchands les plus engagés adoptent aussi davantage Axia. Seule une expérience A/B mesurerait l'effet propre de l'IA.")}</Note></div>
                </>
              )}
            </Carte>
          </div>

          <Carte titre={tx("Top marchands utilisateurs d'IA")} pad>
            <TableauInteractif nomExport="axia-top-marchands" colonnes={[
              { cle: "nom", nom: tx("Marchand") }, { cle: "pays", nom: tx("Pays"), filtrable: true }, { cle: "requetes", nom: tx("Requêtes"), format: "nombre", droite: true },
              { cle: "cout", nom: tx("Coût IA"), format: "xaf", droite: true }, ...(voitGmv ? [{ cle: "gmv", nom: "GMV", format: "xaf" as const, droite: true }, { cle: "commandes", nom: tx("Commandes"), format: "nombre" as const, droite: true }] : []),
            ]} lignes={a.top.slice(0, 500).map((m) => ({ _id: m.id, _href: L(`/admin/marchands/${m.id}`), nom: m.nom, pays: tx(nomPays(m.pays)), requetes: m.requetes, cout: m.cout, ...(voitGmv ? { gmv: m.gmv, commandes: m.commandes } : {}) }))} parPage={10} />
          </Carte>
        </>
      )}
    </div>
  );
}
