import Link from "next/link";
import { AlertOctagon, AlertTriangle, Lightbulb, Rocket, CheckCircle2, Settings2 } from "lucide-react";
import { contexteCC, analyser } from "@/lib/command-center/serveur";
import { METRIQUE, mesurer } from "@/lib/command-center/moteur";
import { evaluerSeuil, type CategorieAlerte } from "@/lib/command-center/insights";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { lien } from "@/lib/command-center/contexte";
import { peutAgir } from "@/lib/command-center/rbac";
import { EnTetePage, Carte, Badge, EtatVide, Note, Tableau, Fraicheur } from "@/components/command-center/ui";
import { ActionsInsight } from "@/components/command-center/client";
import { Retablir } from "./Retablir";

const CATEGORIES: { id: CategorieAlerte; nom: string; icone: typeof AlertOctagon; ton: "bad" | "warn" | "good" | "info"; vide: string }[] = [
  { id: "critique", nom: "Critique", icone: AlertOctagon, ton: "bad", vide: "Aucun seuil critique franchi." },
  { id: "alerte", nom: "Alerte", icone: AlertTriangle, ton: "warn", vide: "Aucune alerte." },
  { id: "opportunite", nom: "Opportunité", icone: Rocket, ton: "good", vide: "Aucune opportunité détectée." },
  { id: "insight", nom: "Insight", icone: Lightbulb, ton: "info", vide: "Aucun insight significatif." },
];
const COND = { variation_inf: "variation <", variation_sup: "variation >", valeur_inf: "valeur <", valeur_sup: "valeur >" };
const NOM_INSIGHT: Record<string, string> = { "churn:eleve": "Marchands à risque de churn élevé", "exp:pro": "Marchands éligibles au plan Pro", "exp:illimite": "Marchands Pro prêts pour l'Illimité", "prio:churn": "Priorité : contacter les marchands à risque", "prio:expansion": "Priorité : proposer des upgrades" };

export default async function Alertes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("alertes", searchParams);
  const tx = await getT();
  const { formatValeur, formatVariation } = formats(tx);
  const { vue: v, fen: f, filtres, session, reglages: r } = c;
  const a = analyser(c, tx);
  const agir = peutAgir(session.role);
  const L = (p: string) => lien(p, filtres);

  // Libellé lisible d'un insight ignoré (seuil → métrique ; variations / insights fonctionnalités → métrique).
  const nomIgnore = (id: string) => {
    const [t, k] = id.split(":");
    if (t === "seuil") { const s = r.seuils.find((x) => x.id === k); return s ? tx("Seuil : {0} ({1})", tx(METRIQUE[s.metrique]?.nom ?? s.metrique), tx(COND[s.condition])) : tx("Seuil supprimé"); }
    if (t === "prio" && k?.startsWith("var")) return tx("Priorité : {0}", tx(METRIQUE[id.split(":")[2]]?.nom ?? id));
    if (t === "insight") return tx("Insight fonctionnalité : {0}", k);
    return tx(NOM_INSIGHT[id] ?? id);
  };
  const seuilsActifs = r.seuils.filter((s) => s.actif && METRIQUE[s.metrique]);

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Alert Center" titre={tx("Risques & alertes")} sousTitre={<>{tx("Seuils franchis, risques et opportunités détectés")} · <span className="cc-faint">{tx(f.libelle)} {tx(f.libelleComp)}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><Link href={L("/admin/reglages#seuils")} className="cc-btn cc-btn-sm"><Settings2 size={13} />{tx("Seuils")}</Link></>} />
      {c.erreur && <Note ton="warn">{tx(c.erreur)}</Note>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="list" aria-label={tx("Synthèse par gravité")}>
        {CATEGORIES.map((k) => { const n = a.alertes.filter((x) => x.categorie === k.id).length; const I = k.icone; return (
          <a key={k.id} href={`#${k.id}`} role="listitem" className="cc-card cc-hover p-3.5 flex items-center gap-3">
            <I size={18} className={`cc-${k.ton} shrink-0`} aria-hidden />
            <div><p className="text-[12px] cc-muted">{tx(k.nom)}</p><p className="text-[21px] font-semibold cc-num">{n}</p></div>
          </a>
        ); })}
      </div>

      {CATEGORIES.map((k) => {
        const liste = a.alertes.filter((x) => x.categorie === k.id);
        const I = k.icone;
        return (
          <Carte key={k.id} id={k.id} titre={<span className="inline-flex items-center gap-2"><I size={15} className={`cc-${k.ton}`} aria-hidden />{tx(k.nom)}<Badge ton={k.ton}>{liste.length}</Badge></span>} pad={false}>
            {!liste.length ? <p className="px-4 pb-4 flex items-center gap-2 text-[13px] cc-faint"><CheckCircle2 size={14} aria-hidden />{tx(k.vide)}</p> : (
              <ul className="divide-y cc-sep border-t cc-sep">
                {liste.map((x) => (
                  <li key={x.id} className="px-4 py-3 flex gap-3">
                    <I size={15} className={`cc-${k.ton} shrink-0 mt-0.5`} aria-label={tx(k.nom)} />
                    <div className="min-w-0 flex-1">
                      <Link href={L(x.lien)} className="text-[13.5px] font-medium hover:underline">{x.titre}</Link>
                      <p className="cc-faint text-[12px] mt-0.5">{x.detail}</p>
                      <div className="mt-2"><ActionsInsight insightId={x.id} titre={x.titre} lienMarchands={x.ids?.length ? L(x.lien) : undefined} ids={x.ids} source={c.ds.source} peutAgir={agir} compact /></div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        );
      })}

      <div className="grid gap-3 xl:grid-cols-[1.4fr_1fr]">
        <Carte titre={tx("Seuils actifs")} sousTitre={tx("État sur la période courante ({0})", tx(f.libelle).toLowerCase())} actions={<Link href={L("/admin/reglages#seuils")} className="cc-btn cc-btn-ghost cc-btn-sm">{tx("Modifier")}</Link>}>
          <Tableau vide={tx("Aucun seuil actif.")}
            colonnes={[{ cle: "metrique", nom: tx("Métrique") }, { cle: "condition", nom: tx("Condition") }, { cle: "actuel", nom: tx("Actuel"), droite: true }, { cle: "gravite", nom: tx("Gravité") }, { cle: "canal", nom: tx("Canal") }, { cle: "etat", nom: tx("État") }]}
            lignes={seuilsActifs.map((s) => {
              const mes = mesurer(v, s.metrique, f.cur, f.prev, 2);
              const variation = s.condition.startsWith("variation");
              const franchi = evaluerSeuil(s, mes);
              return {
                metrique: <span className="font-medium">{tx(mes.nom)}</span>,
                condition: `${tx(COND[s.condition])} ${variation ? formatVariation(s.valeur, mes.format === "pct" ? "pct" : "nombre") : formatValeur(s.valeur, mes.format)}`,
                actuel: variation ? formatVariation(mes.variation, mes.format) : formatValeur(mes.valeur, mes.format),
                gravite: tx(s.gravite === "critique" ? "Critique" : "Alerte"),
                canal: tx(s.canal === "email" ? "E-mail" : "Tableau"),
                etat: mes.valeur == null && mes.variation == null ? <Badge>{tx("Données insuffisantes")}</Badge> : franchi ? <Badge ton={s.gravite === "critique" ? "bad" : "warn"}>{tx("Franchi")}</Badge> : <Badge ton="good">OK</Badge>,
              };
            })} />
        </Carte>
        <Carte titre={tx("Alertes ignorées")} sousTitre={tx("Masquées du Command Center jusqu'à rétablissement")}>
          {!r.ignores.length ? <EtatVide titre={tx("Aucune alerte ignorée")} /> : (
            <ul className="space-y-2">
              {r.ignores.map((id) => (
                <li key={id} className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate" title={id}>{nomIgnore(id)}</span>
                  {agir ? <Retablir insightId={id} /> : null}
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>
    </div>
  );
}
