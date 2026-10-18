import { contexteCC } from "@/lib/command-center/serveur";
import { analyserExperience, POPULATION_MIN, type Verdict } from "@/lib/command-center/experiences";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import type { T } from "@/lib/i18n";
import { EnTetePage, Carte, EtatVide, Note, Fraicheur, Badge, type Ton } from "@/components/command-center/ui";
import { BoutonPDF } from "@/components/command-center/client";

const STATUT = { en_cours: ["En cours", "info"], terminee: ["Terminée", "neutre"], brouillon: ["Brouillon", "neutre"] } as const;
const VERDICT: Record<Verdict, [string, Ton]> = { gagnant: ["Gagnant", "good"], perdant: ["Perdant", "bad"], non_significatif: ["Non significatif", "neutre"], insuffisant: ["Population insuffisante", "warn"] };

const confiance = (p: number | null, t: T) => (p == null ? "—" : p < 0.01 ? t("≥ {0} %", 99) : p < 0.05 ? t("≥ {0} %", 95) : p < 0.1 ? t("≥ {0} %", 90) : t("< {0} %", 90));

export default async function PageExperiences({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [c, t] = await Promise.all([contexteCC("experiences", searchParams), getT()]);
  const { formatValeur, formatVariation, dateCourte } = formats(t);
  const exps = c.ds.manques.includes("experiences") ? [] : c.ds.experiences;

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Axso Experiments" titre={t("Expériences")} sousTitre={t("Tests A/B produit, pricing, onboarding et campagnes · toutes périodes")}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><BoutonPDF /></>} />
      {c.erreur && <Note ton="warn">{t(c.erreur)}</Note>}

      {!exps.length ? (
        <Carte><EtatVide titre={t("Aucune expérience enregistrée")} explication={t("Axso n'enregistre pas encore de tests A/B. Pour en suivre un ici, il faut stocker pour chaque expérience ses variantes, la population exposée à chacune et ses conversions.")} /></Carte>
      ) : (
        <Carte titre={t("Expériences")} sousTitre={t("Chaque variante est comparée au contrôle (1re variante) par un test z bilatéral à deux proportions")} pad={false}>
          <div className="overflow-x-auto border-t cc-sep">
            <table className="cc-table">
              <thead><tr><th>{t("Expérience")}</th><th>{t("Type")}</th><th>{t("Hypothèse")}</th><th className="r">{t("Population")}</th><th>{t("Conversion par variante")}</th><th className="r">Lift</th><th className="r">{t("Confiance")}</th><th>{t("Statut")}</th></tr></thead>
              <tbody>
                {exps.map((e) => {
                  const a = analyserExperience(e);
                  const [nomStatut, tonStatut] = STATUT[e.statut];
                  const pop = e.variantes.reduce((s, x) => s + x.population, 0);
                  return (
                    <tr key={e.id} className="align-top">
                      <td><p className="font-medium">{t(e.nom)}</p><p className="cc-faint text-[11.5px]">{dateCourte(e.debut)}{e.fin ? ` → ${dateCourte(e.fin)}` : ""}</p></td>
                      <td><Badge>{t(e.type)}</Badge></td>
                      <td className="max-w-[280px] text-[12.5px] cc-muted" style={{ whiteSpace: "normal" }}>{t(e.hypothese)}</td>
                      <td className="r cc-num">{pop ? formatValeur(pop, "nombre", true) : "—"}</td>
                      <td className="text-[12.5px]">
                        {!a.controle ? <span className="cc-faint">{t("Pas encore lancée")}</span> : (
                          <ul className="space-y-0.5">
                            <li><span className="cc-muted">{t(a.controle.nom)}</span> <span className="cc-num">{formatValeur(a.tauxControle, "pct")}</span> <span className="cc-faint">({a.controle.conversions}/{a.controle.population})</span></li>
                            {a.variantes.map((x) => <li key={x.nom}><span className="cc-muted">{t(x.nom)}</span> <span className="cc-num">{formatValeur(x.tauxB, "pct")}</span> <span className="cc-faint">({x.conversions}/{x.population})</span></li>)}
                          </ul>
                        )}
                      </td>
                      <td className="r cc-num">{a.variantes.map((x) => <p key={x.nom}>{formatVariation(x.lift, "nombre")}</p>)}</td>
                      <td className="r cc-num">{a.variantes.map((x) => <p key={x.nom} title={x.p == null ? undefined : `p = ${x.p.toFixed(4)}`}>{confiance(x.p, t)}</p>)}</td>
                      <td>
                        <div className="flex flex-col items-start gap-1">
                          <Badge ton={tonStatut}>{t(nomStatut)}</Badge>
                          {a.variantes.map((x) => <Badge key={x.nom} ton={VERDICT[x.verdict][1]} titre={t(x.nom)}>{a.variantes.length > 1 ? `${t(x.nom)} : ` : ""}{t(VERDICT[x.verdict][0])}</Badge>)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="cc-faint text-[11.5px] px-4 py-3">{t("Un gagnant n'est déclaré que si p < 0,05 et qu'au moins {0} personnes par variante ont été exposées (et ≥ 5 conversions et non-conversions par groupe). Lift = écart relatif de conversion vs contrôle. Arrêter un test dès qu'il « devient significatif » gonfle les faux positifs : fixez la durée à l'avance.", POPULATION_MIN)}</p>
        </Carte>
      )}
    </div>
  );
}
