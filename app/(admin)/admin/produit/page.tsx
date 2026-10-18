import { contexteCC } from "@/lib/command-center/serveur";
import { impactFonctions, type ImpactFonction } from "@/lib/command-center/insights";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { EnTetePage, Carte, EtatVide, Note, Fraicheur, Tableau, Badge, Progression, type Ton } from "@/components/command-center/ui";
import { BoutonPDF } from "@/components/command-center/client";

/** Prérequis de la vente : tout marchand qui vend les utilise, leur « impact » est mécanique. */
const PREREQUIS = ["constructeur", "stock", "commandes", "paiements"];
const TON: Record<string, Ton> = { "Plus utilisée": "info", "Plus forte croissance": "good", "Sous-utilisée": "warn", "Fort impact revenu": "violet" };

const ecart = (a: number | null, b: number | null) => (a == null || b == null ? null : Math.round((a - b) * 1000) / 1000 + 0);
const multiple = (a: number | null, b: number | null) => (a == null || !b ? null : a / b);

export default async function PageProduit({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [c, t] = await Promise.all([contexteCC("produit", searchParams), getT()]);
  const { formatValeur, formatVariation } = formats(t);
  const { vue: v, fen: f } = c;
  const fn = impactFonctions(v, f);

  // « Quelle fonctionnalité est la plus liée à la rétention ? » — fonctionnalités optionnelles uniquement, écart ≥ 3 pts.
  const candidates = fn.filter((x) => !PREREQUIS.includes(x.fonction)).map((x) => ({ x, d: ecart(x.retentionAdopteurs, x.retentionAutres) })).filter((y) => y.d != null).sort((p, q) => q.d! - p.d!);
  const meilleure = candidates[0] && candidates[0].d! >= 0.03 ? candidates[0] : null;

  const cellRet = (x: ImpactFonction) => { const d = ecart(x.retentionAdopteurs, x.retentionAutres); return d == null ? <span className="cc-faint">—</span> : <span title={t("{0} vs {1}", formatValeur(x.retentionAdopteurs, "pct"), formatValeur(x.retentionAutres, "pct"))} className={d > 0.005 ? "cc-good" : d < -0.005 ? "cc-bad" : ""}>{formatVariation(d, "pct")}</span>; };
  const cellRev = (x: ImpactFonction) => { const m = multiple(x.gmvParAdopteur, x.gmvParAutre); return m == null ? <span className="cc-faint">—</span> : <span title={t("{0} vs {1} par marchand", formatValeur(x.gmvParAdopteur, "xaf"), formatValeur(x.gmvParAutre, "xaf"))}>{formatValeur(m, "ratio")}{PREREQUIS.includes(x.fonction) && <span className="cc-faint"> *</span>}</span>; };

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Product Analytics" titre={t("Produit")} sousTitre={<>{t("Adoption et impact de chaque fonctionnalité")} · <span className="cc-faint">{t(f.libelle)} {t(f.libelleComp)}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><BoutonPDF /></>} />
      {c.erreur && <Note ton="warn">{t(c.erreur)}</Note>}

      {!v.actifs(f.cur).size ? <Carte><EtatVide titre={t("Aucun marchand actif sur la période")} explication={t("L'adoption se calcule sur les marchands ayant eu une activité (commande, usage d'une fonctionnalité, IA). Élargissez la période ou les filtres.")} /></Carte> : (
        <>
          <Carte titre={t("Quelle fonctionnalité est la plus liée à la rétention des marchands ?")}>
            {meilleure ? (
              <p className="text-[14px]"><strong>{t(meilleure.x.nom)}</strong> : {t("{0} des marchands qui l'utilisaient sont restés actifs, contre {1} pour les autres ({2}).", formatValeur(meilleure.x.retentionAdopteurs, "pct"), formatValeur(meilleure.x.retentionAutres, "pct"), formatVariation(meilleure.d, "pct"))}</p>
            ) : (
              <p className="text-[13px] cc-muted">{t(candidates.length ? "Aucune fonctionnalité optionnelle ne se démarque (écart de rétention inférieur à 3 points)." : "Données insuffisantes : il faut au moins 20 marchands actifs sur la période précédente parmi les utilisateurs et parmi les non-utilisateurs.")}</p>
            )}
            <p className="cc-faint text-[11.5px] mt-2">{t("Rétention = part des marchands actifs sur la période précédente encore actifs sur la période. Corrélation, pas causalité. Fonctionnalités prérequises de la vente exclues.")}</p>
          </Carte>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {fn.map((x) => (
              <div key={x.fonction} className="cc-card p-3.5 min-w-0">
                <div className="flex items-start justify-between gap-2"><p className="text-[13px] font-medium truncate">{t(x.nom)}</p><span className="cc-num text-[13px] font-semibold">{formatValeur(x.adoption, "pct")}</span></div>
                <div className="mt-2"><Progression valeur={x.adoption} /></div>
                <p className="cc-faint text-[11.5px] mt-2">{t("{0} adopteurs actifs · {1} usages/sem. · croissance {2}", formatValeur(x.adopteurs, "nombre", true), formatValeur(x.frequence, "nombre"), formatVariation(x.croissance, "nombre"))}</p>
                {x.etiquettes.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{x.etiquettes.map((e) => <Badge key={e} ton={TON[e]}>{t(e)}</Badge>)}</div>}
              </div>
            ))}
          </div>

          <Carte titre={t("Matrice d'adoption")} sousTitre={t("Adoption = adopteurs ÷ marchands actifs · Usage = usages par adopteur et par semaine")}>
            <Tableau colonnes={[{ cle: "f", nom: t("Fonctionnalité") }, { cle: "a", nom: t("Adoption"), droite: true }, { cle: "n", nom: t("Adopteurs"), droite: true }, { cle: "u", nom: t("Usage /sem."), droite: true }, { cle: "c", nom: t("Croissance"), droite: true }, { cle: "r", nom: t("Impact rétention"), droite: true }, { cle: "g", nom: t("Impact revenu (GMV)"), droite: true }, { cle: "e", nom: "" }]}
              lignes={fn.map((x) => ({
                f: t(x.nom), a: formatValeur(x.adoption, "pct"), n: formatValeur(x.adopteurs, "nombre", true), u: formatValeur(x.frequence, "nombre"), c: formatVariation(x.croissance, "nombre"),
                r: cellRet(x), g: cellRev(x), e: <span className="flex gap-1 justify-end">{x.etiquettes.map((e) => <Badge key={e} ton={TON[e]}>{t(e)}</Badge>)}</span>,
              }))} />
            <div className="mt-3 space-y-1 cc-faint text-[11.5px]">
              <p>{t("Impact rétention : écart (en points) entre la rétention des utilisateurs et celle des autres. Impact revenu : GMV moyen par utilisateur ÷ GMV moyen par non-utilisateur. « — » : moins de 20 marchands dans un des groupes.")}</p>
              <p>{t("* Constructeur, stock, commandes et paiements sont des prérequis de la vente : leur impact revenu est biaisé (un marchand qui vend les utilise forcément).")}</p>
            </div>
            <div className="mt-3"><Note>{t("Corrélations observées, pas des effets causaux : les marchands les plus actifs utilisent davantage de fonctionnalités.")}</Note></div>
          </Carte>
        </>
      )}
    </div>
  );
}
