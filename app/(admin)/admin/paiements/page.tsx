import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { contexteCC } from "@/lib/command-center/serveur";
import { mesurer } from "@/lib/command-center/moteur";
import { lien } from "@/lib/command-center/contexte";
import { nomPays } from "@/lib/command-center/types";
import { evaluerSeuil } from "@/lib/command-center/insights";
import { formatValeur } from "@/lib/command-center/format";
import { mesureLibre, statsPaiement, tranches, etiquette, grouper, nomMethode } from "@/lib/command-center/commerce";
import { EnTetePage, Carte, Kpi, GrilleKpi, Badge, Progression, EtatVide, Note, Fraicheur, Tableau } from "@/components/command-center/ui";
import { BoutonPDF, TableauInteractif } from "@/components/command-center/client";
import { Barres } from "@/components/command-center/graphiques";

const MAX_ECHECS = 1000;

export default async function Paiements({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("paiements", searchParams);
  const { vue: v, fen: f, filtres } = c;
  const L = (p: string, s = {}) => lien(p, filtres, s);

  const cmds = v.commandesW(f.cur);
  const a = statsPaiement(cmds), b = statsPaiement(v.commandesW(f.prev));
  const decoupe = tranches(f.cur, 12).map((w) => ({ w, s: statsPaiement(v.commandesW(w)) }));
  const libre = (id: string, nom: string, k: "reussis" | "echoues" | "attente" | "rembourses" | "volume", sens: 1 | -1, description: string, formule: string) =>
    mesureLibre({ id, nom, format: k === "volume" ? "xaf" : "nombre", sens, valeur: a[k], precedente: b[k], serie: decoupe.map((x) => x.s[k]), page: "/admin/paiements", description, formule });

  const succes = mesurer(v, "succes_paiement", f.cur, f.prev, 12);
  const kpis = [
    succes,
    libre("reussis", "Paiements réussis", "reussis", 1, "Commandes payées (y compris remboursées ensuite)", "Payées + remboursées"),
    mesurer(v, "echecs_paiement", f.cur, f.prev, 12),
    libre("attente", "En attente", "attente", -1, "Commandes dont le paiement n'est pas encore confirmé", "Commandes au statut en attente"),
    libre("rembourses", "Remboursements", "rembourses", -1, "Commandes remboursées au client", "Commandes au statut remboursé"),
    libre("volume", "Volume de transactions", "volume", 1, "Montant encaissé", "Σ montants payés + remboursés"),
  ];

  const seuil = c.reglages.seuils.find((s) => s.metrique === "succes_paiement" && s.actif);
  const alerte = seuil && evaluerSeuil(seuil, succes);

  const methodes = [...grouper(cmds, (x) => x.methode)].map(([k, l]) => ({ k, s: statsPaiement(l) })).sort((x, y) => y.s.volume - x.s.volume);
  const pays = [...grouper(cmds, (x) => v.parId.get(x.marchandId)?.pays)].map(([k, l]) => ({ k, s: statsPaiement(l) })).sort((x, y) => y.s.n - x.s.n);
  const tonSucces = (x: number | null) => (x == null ? undefined : x >= 0.95 ? "good" : x >= 0.85 ? "warn" : "bad") as "good" | "warn" | "bad" | undefined;
  const cellSucces = (x: number | null) => (
    <span className="inline-flex items-center gap-2 justify-end"><span className="w-16 hidden sm:block"><Progression valeur={x} ton={tonSucces(x)} /></span>{formatValeur(x, "pct")}</span>
  );

  const echecs = cmds.filter((x) => x.statut === "echouee").reverse().slice(0, MAX_ECHECS).map((x) => ({
    _id: x.id, marchand: v.parId.get(x.marchandId)?.nom ?? "—", pays: nomPays(v.parId.get(x.marchandId)?.pays ?? ""), montant: x.montant, moyen: nomMethode(x.methode), date: x.date,
  }));

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Paiements" titre="Paiements" sousTitre={<>Encaissements des marchands · <span className="cc-faint">{f.libelle} {f.libelleComp}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><BoutonPDF /></>} />
      {c.erreur && <Note ton="warn">{c.erreur}</Note>}

      {alerte && seuil && (
        <div role="alert" className="cc-card flex items-start gap-3 px-4 py-3" style={{ borderColor: "var(--cc-bad)" }}>
          <AlertOctagon size={17} className="cc-bad shrink-0 mt-0.5" aria-hidden />
          <div className="text-[13px]">
            <p className="font-semibold">Le taux d'échec des paiements dépasse le seuil</p>
            <p className="cc-muted mt-0.5">Succès des paiements en ligne : <strong>{formatValeur(succes.valeur, "pct")}</strong> pour un seuil de {formatValeur(seuil.valeur, "pct")} (gravité {seuil.gravite}). Analysez les moyens de paiement et les pays ci-dessous, puis ouvrez un incident avec le prestataire si un moyen décroche.</p>
          </div>
        </div>
      )}

      <GrilleKpi colonnes={6}>{kpis.map((m) => <Kpi key={m.id} m={m} filtres={filtres} libelleComp={f.libelleComp} />)}</GrilleKpi>

      <Carte titre="Réussites et échecs" sousTitre={f.libelle}>
        {a.reussis + a.echoues ? <Barres empile donnees={decoupe.map((x) => ({ x: etiquette(x.w.debut, f.cur), reussis: x.s.reussis, echoues: x.s.echoues }))} series={[{ cle: "reussis", nom: "Réussis", couleur: "var(--cc-good)" }, { cle: "echoues", nom: "Échoués", couleur: "var(--cc-bad)" }]} format="nombre" />
          : <EtatVide titre="Aucun paiement sur la période" explication="Les paiements apparaissent dès qu'une commande est réglée ou échoue." />}
      </Carte>

      <div className="grid gap-3 lg:grid-cols-2">
        <Carte titre="Par moyen de paiement" sousTitre="Taux de succès = réussis ÷ (réussis + échoués)">
          <Tableau colonnes={[{ cle: "m", nom: "Moyen" }, { cle: "n", nom: "Transactions", droite: true }, { cle: "vol", nom: "Volume", droite: true }, { cle: "ok", nom: "Succès", droite: true }]}
            lignes={methodes.map(({ k, s }) => ({ m: nomMethode(k), n: s.n.toLocaleString("fr-FR"), vol: formatValeur(s.volume, "xaf"), ok: cellSucces(s.succes) }))} vide="Aucun paiement" />
        </Carte>
        <Carte titre="Par pays" sousTitre="Cliquer sur un pays pour filtrer">
          <Tableau colonnes={[{ cle: "p", nom: "Pays" }, { cle: "n", nom: "Transactions", droite: true }, { cle: "e", nom: "Échecs", droite: true }, { cle: "ok", nom: "Succès", droite: true }]}
            lignes={pays.map(({ k, s }) => ({ p: <Link href={L("/admin/paiements", { pays: k })} className="hover:underline">{nomPays(k)}</Link>, n: s.n.toLocaleString("fr-FR"), e: s.echoues.toLocaleString("fr-FR"), ok: cellSucces(s.succes) }))} vide="Aucun paiement" />
        </Carte>
      </div>

      <Carte titre="Derniers paiements échoués" sousTitre={echecs.length >= MAX_ECHECS ? `Les ${MAX_ECHECS} plus récents de la période` : f.libelle} actions={a.echoues ? <Badge ton="bad">{a.echoues.toLocaleString("fr-FR")}</Badge> : undefined}>
        {echecs.length ? (
          <TableauInteractif nomExport="paiements-echoues" parPage={20} lignes={echecs} vide="Aucun échec"
            colonnes={[{ cle: "marchand", nom: "Marchand" }, { cle: "pays", nom: "Pays", filtrable: true }, { cle: "montant", nom: "Montant", format: "xaf", droite: true }, { cle: "moyen", nom: "Moyen", filtrable: true }, { cle: "date", nom: "Date", format: "date" }]} />
        ) : <EtatVide titre="Aucun paiement échoué" explication="Aucune commande au statut échoué sur la période et le périmètre choisis." />}
      </Carte>
    </div>
  );
}
