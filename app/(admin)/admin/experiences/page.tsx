import { contexteCC } from "@/lib/command-center/serveur";
import { analyserExperience, POPULATION_MIN, type Verdict } from "@/lib/command-center/experiences";
import { formatValeur, formatVariation, dateCourte } from "@/lib/command-center/format";
import { EnTetePage, Carte, EtatVide, Note, Fraicheur, Badge, type Ton } from "@/components/command-center/ui";
import { BoutonPDF } from "@/components/command-center/client";

const STATUT = { en_cours: ["En cours", "info"], terminee: ["Terminée", "neutre"], brouillon: ["Brouillon", "neutre"] } as const;
const VERDICT: Record<Verdict, [string, Ton]> = { gagnant: ["Gagnant", "good"], perdant: ["Perdant", "bad"], non_significatif: ["Non significatif", "neutre"], insuffisant: ["Population insuffisante", "warn"] };

const confiance = (p: number | null) => (p == null ? "—" : p < 0.01 ? "≥ 99 %" : p < 0.05 ? "≥ 95 %" : p < 0.1 ? "≥ 90 %" : "< 90 %");

export default async function PageExperiences({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("experiences", searchParams);
  const exps = c.ds.manques.includes("experiences") ? [] : c.ds.experiences;

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Axso Experiments" titre="Expériences" sousTitre="Tests A/B produit, pricing, onboarding et campagnes · toutes périodes"
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><BoutonPDF /></>} />
      {c.erreur && <Note ton="warn">{c.erreur}</Note>}

      {!exps.length ? (
        <Carte><EtatVide titre="Aucune expérience enregistrée" explication="Axso n'enregistre pas encore de tests A/B. Pour en suivre un ici, il faut stocker pour chaque expérience ses variantes, la population exposée à chacune et ses conversions." /></Carte>
      ) : (
        <Carte titre="Expériences" sousTitre="Chaque variante est comparée au contrôle (1re variante) par un test z bilatéral à deux proportions" pad={false}>
          <div className="overflow-x-auto border-t cc-sep">
            <table className="cc-table">
              <thead><tr><th>Expérience</th><th>Type</th><th>Hypothèse</th><th className="r">Population</th><th>Conversion par variante</th><th className="r">Lift</th><th className="r">Confiance</th><th>Statut</th></tr></thead>
              <tbody>
                {exps.map((e) => {
                  const a = analyserExperience(e);
                  const [nomStatut, tonStatut] = STATUT[e.statut];
                  const pop = e.variantes.reduce((s, x) => s + x.population, 0);
                  return (
                    <tr key={e.id} className="align-top">
                      <td><p className="font-medium">{e.nom}</p><p className="cc-faint text-[11.5px]">{dateCourte(e.debut)}{e.fin ? ` → ${dateCourte(e.fin)}` : ""}</p></td>
                      <td><Badge>{e.type}</Badge></td>
                      <td className="max-w-[280px] text-[12.5px] cc-muted" style={{ whiteSpace: "normal" }}>{e.hypothese}</td>
                      <td className="r cc-num">{pop ? formatValeur(pop, "nombre", true) : "—"}</td>
                      <td className="text-[12.5px]">
                        {!a.controle ? <span className="cc-faint">Pas encore lancée</span> : (
                          <ul className="space-y-0.5">
                            <li><span className="cc-muted">{a.controle.nom}</span> <span className="cc-num">{formatValeur(a.tauxControle, "pct")}</span> <span className="cc-faint">({a.controle.conversions}/{a.controle.population})</span></li>
                            {a.variantes.map((x) => <li key={x.nom}><span className="cc-muted">{x.nom}</span> <span className="cc-num">{formatValeur(x.tauxB, "pct")}</span> <span className="cc-faint">({x.conversions}/{x.population})</span></li>)}
                          </ul>
                        )}
                      </td>
                      <td className="r cc-num">{a.variantes.map((x) => <p key={x.nom}>{formatVariation(x.lift, "nombre")}</p>)}</td>
                      <td className="r cc-num">{a.variantes.map((x) => <p key={x.nom} title={x.p == null ? undefined : `p = ${x.p.toFixed(4)}`}>{confiance(x.p)}</p>)}</td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <Badge ton={tonStatut}>{nomStatut}</Badge>
                          {a.variantes.map((x) => <Badge key={x.nom} ton={VERDICT[x.verdict][1]} titre={x.nom}>{a.variantes.length > 1 ? `${x.nom} : ` : ""}{VERDICT[x.verdict][0]}</Badge>)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="cc-faint text-[11.5px] px-4 py-3">Un gagnant n'est déclaré que si p &lt; 0,05 et qu'au moins {POPULATION_MIN} personnes par variante ont été exposées (et ≥ 5 conversions et non-conversions par groupe). Lift = écart relatif de conversion vs contrôle. Arrêter un test dès qu'il « devient significatif » gonfle les faux positifs : fixez la durée à l'avance.</p>
        </Carte>
      )}
    </div>
  );
}
