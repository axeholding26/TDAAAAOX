import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { contexteCC, analyser } from "@/lib/command-center/serveur";
import { lien } from "@/lib/command-center/contexte";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { peutVoir } from "@/lib/command-center/rbac";
import { TYPES_RAPPORT, INFO_RAPPORT, construireRapport, fenetreFrequence, texteCellule, type TypeRapport } from "@/lib/command-center/rapports";
import { EnTetePage, Carte, Kpi, GrilleKpi, EtatVide, Note, Tableau, Fraicheur } from "@/components/command-center/ui";
import { BoutonsExport, BoutonPDF } from "@/components/command-center/client";
import { ExportRapport, type BlocExport } from "../client";

export default async function RapportPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { type } = await params;
  if (!TYPES_RAPPORT.includes(type as TypeRapport)) notFound();
  const t = type as TypeRapport;
  const c = await contexteCC("rapports", searchParams);
  const tx = await getT();
  const { formatValeur, formatVariation, dateLongue } = formats(tx);
  const { filtres, session } = c;
  const info = INFO_RAPPORT[t];
  const L = (p: string) => lien(p, filtres);
  const retour = <Link href={L("/admin/rapports")} className="cc-btn cc-btn-ghost cc-btn-sm"><ArrowLeft size={13} />{tx("Rapports")}</Link>;

  if (!peutVoir(session.role, info.section)) {
    return <div className="space-y-5"><EnTetePage titre={tx(info.titre)} actions={retour} /><Carte><EtatVide titre={tx("Rapport non accessible")} explication={tx("Votre rôle ne donne pas accès aux données de ce rapport.")} /></Carte></div>;
  }

  const fen = info.frequence ? fenetreFrequence(info.frequence, c.vue.maintenant, tx) : c.fen;
  const rp = construireRapport(t, c.vue, fen, analyser(c, tx), c.reglages, tx);
  const nom = `axso-${t}-${new Date(c.vue.maintenant).toISOString().slice(0, 10)}`;
  const blocs: BlocExport[] = rp.sections.flatMap((s) => [
    ...(s.kpis?.length ? [{ titre: s.titre, colonnes: [{ cle: "indicateur", nom: tx("Indicateur") }, { cle: "valeur", nom: tx("Valeur") }, { cle: "precedente", nom: tx("Période de comparaison") }, { cle: "variation", nom: tx("Variation") }], lignes: s.kpis.map((m) => ({ _id: m.id, indicateur: m.nom, valeur: m.valeur, precedente: m.precedente, variation: formatVariation(m.variation, m.format) })) }] : []),
    ...(s.puces?.length ? [{ titre: s.titre, colonnes: [{ cle: "texte", nom: s.titre }], lignes: s.puces.map((p, i) => ({ _id: String(i), texte: p.texte })) }] : []),
    ...(s.tableaux ?? []).map((x) => ({ titre: x.titre, colonnes: x.colonnes, lignes: x.lignes })),
  ]);

  return (
    <div className="space-y-5">
      <EnTetePage
        eyebrow={t === "quotidien" ? "AXSO DAILY BRIEF" : tx("Rapport")}
        titre={tx(rp.titre)}
        sousTitre={<>{rp.periode} · <span className="cc-faint">{tx("{0} · édité le {1}", rp.libelleComp, dateLongue(c.vue.maintenant))}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} />{retour}<ExportRapport nom={nom} blocs={blocs} /><BoutonPDF /></>}
      />
      {c.erreur && <Note ton="warn">{tx(c.erreur)}</Note>}
      {!c.vue.marchands.length && <Note>{tx(c.ds.source === "reel" ? "Aucun marchand dans ce périmètre : le rapport est vide. Élargissez les filtres ou consultez les données de démonstration." : "Aucun marchand dans ce périmètre : le rapport est vide. Élargissez les filtres.")}</Note>}
      {t === "quotidien" && <p className="cc-faint text-[12px]">{tx("Risques, opportunités et actions : calculés sur la période des filtres ({0}).", tx(c.fen.libelle).toLowerCase())}</p>}

      {rp.sections.map((s) => (
        <Carte key={s.id} id={s.id} titre={s.titre} sousTitre={s.note}>
          {s.kpis?.length ? <GrilleKpi>{s.kpis.map((m) => <Kpi key={m.id} m={m} filtres={filtres} libelleComp={rp.libelleComp} />)}</GrilleKpi> : null}
          {s.puces && (s.puces.length ? (
            <ol className="space-y-2 text-[13px]">
              {s.puces.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`cc-num font-semibold w-5 shrink-0 ${p.ton === "mauvais" ? "cc-bad" : p.ton === "bon" ? "cc-good" : "cc-faint"}`}>{i + 1}.</span>
                  {p.lien ? <Link href={L(p.lien)} className="hover:underline">{p.texte}</Link> : <span>{p.texte}</span>}
                </li>
              ))}
            </ol>
          ) : <p className="cc-faint text-[13px]">{s.vide}</p>)}
          {!s.kpis?.length && !s.puces && !s.tableaux?.length && s.vide && <EtatVide titre={tx("Données indisponibles")} explication={s.vide} />}
          {(s.tableaux ?? []).map((x) => (
            <div key={x.id} className="mt-3 first:mt-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h3 className="text-[13px] font-medium">{x.titre}</h3>
                {x.lignes.length > 0 && <BoutonsExport nom={`${nom}-${x.id}`} colonnes={x.colonnes} lignes={x.lignes} pdf={false} />}
              </div>
              <Tableau vide={x.vide} colonnes={x.colonnes.map((col) => ({ cle: col.cle, nom: col.nom, droite: col.droite }))}
                lignes={x.lignes.map((l) => Object.fromEntries(x.colonnes.map((col) => [col.cle, texteCellule(l[col.cle], col.format, tx)])))} />
            </div>
          ))}
        </Carte>
      ))}
      <p className="cc-faint text-[11px] text-center">{tx("Rapport calculé par le moteur de métriques Axso ({0} marchands dans le périmètre). Les causes citées sont des corrélations observées, pas des preuves.", formatValeur(c.vue.marchands.length, "nombre", true))}</p>
    </div>
  );
}
