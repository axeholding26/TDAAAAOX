import { contexteCC } from "@/lib/command-center/serveur";
import { METRIQUES, METRIQUE, valeur } from "@/lib/command-center/moteur";
import { DIMENSIONS, GRANULARITES, parDimension, parTemps, constat, type Dimension, type Granularite } from "@/lib/command-center/explorer";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { qs } from "@/lib/command-center/contexte";
import { peutVoir, sectionDe } from "@/lib/command-center/rbac";
import { EnTetePage, Carte, EtatVide, Note, Fraicheur, Delta } from "@/components/command-center/ui";
import { TableauInteractif } from "@/components/command-center/client";
import { Barres, Courbes } from "@/components/command-center/graphiques";
import { Lightbulb } from "lucide-react";

const un = (x: string | string[] | undefined) => (Array.isArray(x) ? x[0] : x);

export default async function PageExplorer({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const c = await contexteCC("explorer", sp);
  const t = await getT();
  const { formatValeur, formatVariation, dateCourte } = formats(t);
  const { vue: v, fen: f, filtres, session } = c;
  const visibles = METRIQUES.filter((m) => peutVoir(session.role, sectionDe(m.page)));
  const id = visibles.find((m) => m.id === un(sp.m))?.id ?? visibles[0]?.id;
  const dim = (DIMENSIONS.find((d) => d.id === un(sp.d))?.id ?? "aucune") as Dimension;
  const g = (GRANULARITES.find((x) => x.id === un(sp.g))?.id ?? "semaine") as Granularite;
  const caches = [...new URLSearchParams(qs(filtres))];

  const m = id ? METRIQUE[id] : null;
  const indispo = m?.requiert && c.ds.manques.includes(m.requiert);
  const nonVentilable = m?.requiert && dim !== "aucune" && dim !== "temps";
  const cur = m ? valeur(v, m.id, f.cur) : null, prev = m ? valeur(v, m.id, f.prev) : null;
  const lignes = (!m || indispo || nonVentilable ? [] : dim === "temps" ? parTemps(v, m.id, f.cur, g).map((x) => ({ ...x, nom: dateCourte(x.debut), precedente: null, part: null }))
    : dim === "aucune" ? [{ cle: "total", nom: "Total", valeur: cur, precedente: prev, part: null }] : parDimension(v, m.id, f, dim)).map((l) => ({ ...l, nom: t(l.nom) }));
  const texte = m && !indispo && !nonVentilable ? constat(m.id, dim, lignes, cur, prev, f.libelleComp, t) : null;
  const nomDim = t(DIMENSIONS.find((d) => d.id === dim)!.nom);

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Explore data" titre={t("Explorer les données")} sousTitre={<>{t("Une métrique, une dimension")} · <span className="cc-faint">{t(f.libelle)} {t(f.libelleComp)}</span></>}
        actions={<Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} />} />
      {c.erreur && <Note ton="warn">{t(c.erreur)}</Note>}

      <form method="get" className="cc-card p-3.5 flex flex-wrap items-end gap-3 cc-no-print">
        {caches.map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
        <label className="flex flex-col gap-1 text-[12px] cc-muted">{t("Métrique")}
          <select name="m" defaultValue={id} className="cc-select min-w-[200px]">{visibles.map((x) => <option key={x.id} value={x.id}>{t(x.nom)}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] cc-muted">{t("Dimension")}
          <select name="d" defaultValue={dim} className="cc-select">{DIMENSIONS.map((x) => <option key={x.id} value={x.id}>{t(x.nom)}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] cc-muted">{t("Granularité (temps)")}
          <select name="g" defaultValue={g} className="cc-select">{GRANULARITES.map((x) => <option key={x.id} value={x.id}>{t(x.nom)}</option>)}</select>
        </label>
        <button className="cc-btn cc-btn-primary">{t("Explorer")}</button>
        <p className="cc-faint text-[11.5px] basis-full">{t("La période et les segments viennent des filtres globaux en haut de page.")}</p>
      </form>

      {!m ? <Carte><EtatVide titre={t("Aucune métrique accessible à votre rôle")} /></Carte>
        : indispo ? <Carte><EtatVide titre={t("{0} : données non disponibles", t(m.nom))} explication={t(m.requiert === "marketing" ? "Les dépenses marketing ne sont pas encore enregistrées dans Axso." : "La source d'acquisition et les visites ne sont pas encore enregistrées dans Axso.")} /></Carte>
        : nonVentilable ? <Carte><EtatVide titre={t("{0} n'est pas ventilable par {1}", t(m.nom), nomDim.toLowerCase())} explication={t("Cette métrique dépend de données globales (dépenses, visites) qui ne sont pas rattachées à un marchand. Choisissez « Aucune » ou « Temps ».")} /></Carte>
        : (
          <>
            <Carte>
              <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
                <div><p className="cc-faint text-[12px]" data-tip={`${t(m.description)} — ${t(m.formule)}`}>{t(m.nom)} · {t(f.libelle)}</p><p className="text-[26px] font-semibold cc-num">{formatValeur(cur, m.format)}</p><Delta variation={cur == null || prev == null ? null : m.format === "pct" ? cur - prev : prev ? (cur - prev) / Math.abs(prev) : null} format={m.format} sens={m.sens} /> <span className="cc-faint text-[12px]">{t(f.libelleComp)} · {formatValeur(prev, m.format)}</span></div>
                {texte && <p className="flex gap-2 text-[13.5px] flex-1 min-w-[240px] pt-1"><Lightbulb size={15} className="shrink-0 mt-0.5" style={{ color: "var(--cc-accent-text)" }} aria-hidden /><span>{texte}</span></p>}
              </div>
              {dim === "source" && c.ds.manques.includes("acquisition") && <div className="mt-3"><Note>{t("La source d'acquisition n'est pas encore enregistrée : tous les marchands réels sont « Inconnu ».")}</Note></div>}
            </Carte>

            {dim !== "aucune" && (
              <Carte titre={t("{0} par {1}", t(m.nom), nomDim.toLowerCase())} sousTitre={dim === "temps" ? t("Granularité : {0}", t(GRANULARITES.find((x) => x.id === g)!.nom).toLowerCase()) + (m.instant ? " · " + t("valeur en fin de tranche") : "") : lignes.length > 15 ? t("15 premiers segments dans le graphique") : undefined}>
                {!lignes.length ? <EtatVide titre={t("Aucun segment sur ce périmètre")} /> : dim === "temps"
                  ? <Courbes format={m.format} series={[{ cle: "v", nom: t(m.nom) }]} donnees={lignes.map((l) => ({ x: l.nom, v: l.valeur }))} />
                  : <Barres format={m.format} horizontal hauteur={Math.max(160, Math.min(15, lignes.length) * 30)} series={[{ cle: "v", nom: t(m.nom) }]} donnees={lignes.slice(0, 15).map((l) => ({ x: l.nom, v: l.valeur }))} />}
              </Carte>
            )}

            <Carte titre={t("Tableau")}>
              <TableauInteractif nomExport={`axso-${m.id}-${dim}`} recherche={dim !== "aucune" && dim !== "temps"} parPage={25} colonnes={[
                { cle: "nom", nom: dim === "temps" ? t("Début de tranche") : dim === "aucune" ? "" : nomDim },
                { cle: "valeur", nom: t(m.nom), format: m.format, droite: true },
                ...(dim === "temps" ? [] : [{ cle: "precedente", nom: t("Période de comparaison"), format: m.format, droite: true }, { cle: "evol", nom: t("Évolution"), droite: true }]),
                ...(m.additive && dim !== "temps" && dim !== "aucune" ? [{ cle: "part", nom: t("Part"), format: "pct" as const, droite: true }] : []),
              ]} lignes={lignes.map((l) => ({
                _id: l.cle, nom: l.nom, valeur: l.valeur, precedente: l.precedente, part: l.part,
                evol: l.valeur == null || l.precedente == null ? null : m.format === "pct" ? formatVariation(l.valeur - l.precedente, "pct") : l.precedente ? formatVariation((l.valeur - l.precedente) / Math.abs(l.precedente), "nombre") : null,
              }))} />
            </Carte>
          </>
        )}
    </div>
  );
}
