import Link from "next/link";
import { AlertOctagon } from "lucide-react";
import { contexteCC } from "@/lib/command-center/serveur";
import { mesurer } from "@/lib/command-center/moteur";
import { lien } from "@/lib/command-center/contexte";
import { nomPays } from "@/lib/command-center/types";
import { peutVoir } from "@/lib/command-center/rbac";
import { evaluerSeuil } from "@/lib/command-center/insights";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { mesureLibre, statsPaiement, tranches, etiquette, grouper, nomMethode } from "@/lib/command-center/commerce";
import { EnTetePage, Carte, Kpi, GrilleKpi, Badge, Progression, EtatVide, Note, Fraicheur, Tableau } from "@/components/command-center/ui";
import { BoutonPDF, TableauInteractif } from "@/components/command-center/client";
import { Barres } from "@/components/command-center/graphiques";

const MAX_ECHECS = 1000;

export default async function Paiements({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const c = await contexteCC("paiements", searchParams);
  const t = await getT();
  const { formatValeur } = formats(t);
  const n = (x: number) => x.toLocaleString(t.loc);
  const { vue: v, fen: f, filtres, session } = c;
  const voirMarchands = peutVoir(session.role, "marchands");
  const L = (p: string, s = {}) => lien(p, filtres, s);

  const cmds = v.commandesW(f.cur);
  const a = statsPaiement(cmds), b = statsPaiement(v.commandesW(f.prev));
  const decoupe = tranches(f.cur, 12).map((w) => ({ w, s: statsPaiement(v.commandesW(w)) }));
  const libre = (id: string, nom: string, k: "reussis" | "echoues" | "attente" | "rembourses" | "volume", sens: 1 | -1, description: string, formule: string) =>
    mesureLibre({ id, nom: t(nom), format: k === "volume" ? "xaf" : "nombre", sens, valeur: a[k], precedente: b[k], serie: decoupe.map((x) => x.s[k]), page: "/admin/paiements", description: t(description), formule: t(formule) });

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
    _id: x.id, _href: voirMarchands ? L(`/admin/marchands/${x.marchandId}`) : undefined, marchand: v.parId.get(x.marchandId)?.nom ?? "—", pays: t(nomPays(v.parId.get(x.marchandId)?.pays ?? "")), montant: x.montant, moyen: t(nomMethode(x.methode)), date: x.date,
  }));

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow={t("Paiements")} titre={t("Paiements")} sousTitre={<>{t("Encaissements des marchands")} · <span className="cc-faint">{t(f.libelle)} {t(f.libelleComp)}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><BoutonPDF /></>} />
      {c.erreur && <Note ton="warn">{t(c.erreur)}</Note>}

      {alerte && seuil && (
        <div role="alert" className="cc-card flex items-start gap-3 px-4 py-3" style={{ borderColor: "var(--cc-bad)" }}>
          <AlertOctagon size={17} className="cc-bad shrink-0 mt-0.5" aria-hidden />
          <div className="text-[13px]">
            <p className="font-semibold">{t("Le taux d'échec des paiements dépasse le seuil")}</p>
            <p className="cc-muted mt-0.5">{t("Succès des paiements en ligne : {0} pour un seuil de {1} (gravité {2}). Analysez les moyens de paiement et les pays ci-dessous, puis ouvrez un incident avec le prestataire si un moyen décroche.", formatValeur(succes.valeur, "pct"), formatValeur(seuil.valeur, "pct"), t(seuil.gravite))}</p>
          </div>
        </div>
      )}

      <GrilleKpi colonnes={6}>{kpis.map((m) => <Kpi key={m.id} m={m} filtres={filtres} libelleComp={t(f.libelleComp)} />)}</GrilleKpi>

      <Carte titre={t("Réussites et échecs")} sousTitre={t(f.libelle)}>
        {a.reussis + a.echoues ? <Barres empile donnees={decoupe.map((x) => ({ x: etiquette(x.w.debut, f.cur), reussis: x.s.reussis, echoues: x.s.echoues }))} series={[{ cle: "reussis", nom: t("Réussis"), couleur: "var(--cc-good)" }, { cle: "echoues", nom: t("Échoués"), couleur: "var(--cc-bad)" }]} format="nombre" />
          : <EtatVide titre={t("Aucun paiement sur la période")} explication={t("Les paiements apparaissent dès qu'une commande est réglée ou échoue.")} />}
      </Carte>

      <div className="grid gap-3 lg:grid-cols-2">
        <Carte titre={t("Par moyen de paiement")} sousTitre={t("Taux de succès = réussis ÷ (réussis + échoués)")}>
          <Tableau colonnes={[{ cle: "m", nom: t("Moyen de paiement") }, { cle: "n", nom: t("Transactions"), droite: true }, { cle: "vol", nom: t("Volume"), droite: true }, { cle: "ok", nom: t("Succès"), droite: true }]}
            lignes={methodes.map(({ k, s }) => ({ m: t(nomMethode(k)), n: n(s.n), vol: formatValeur(s.volume, "xaf"), ok: cellSucces(s.succes) }))} vide={t("Aucun paiement")} />
        </Carte>
        <Carte titre={t("Par pays")} sousTitre={t("Cliquer sur un pays pour filtrer")}>
          <Tableau colonnes={[{ cle: "p", nom: t("Pays") }, { cle: "n", nom: t("Transactions"), droite: true }, { cle: "e", nom: t("Échecs"), droite: true }, { cle: "ok", nom: t("Succès"), droite: true }]}
            lignes={pays.map(({ k, s }) => ({ p: <Link href={L("/admin/paiements", { pays: k })} className="hover:underline">{t(nomPays(k))}</Link>, n: n(s.n), e: n(s.echoues), ok: cellSucces(s.succes) }))} vide={t("Aucun paiement")} />
        </Carte>
      </div>

      <Carte titre={t("Derniers paiements échoués")} sousTitre={echecs.length >= MAX_ECHECS ? t("Les {0} plus récents de la période", MAX_ECHECS) : t(f.libelle)} actions={a.echoues ? <Badge ton="bad">{n(a.echoues)}</Badge> : undefined}>
        {echecs.length ? (
          <TableauInteractif nomExport="paiements-echoues" parPage={20} lignes={echecs} vide={t("Aucun échec")}
            colonnes={[{ cle: "marchand", nom: t("Marchand") }, { cle: "pays", nom: t("Pays"), filtrable: true }, { cle: "montant", nom: t("Montant"), format: "xaf", droite: true }, { cle: "moyen", nom: t("Moyen"), filtrable: true }, { cle: "date", nom: t("Date"), format: "date" }]} />
        ) : <EtatVide titre={t("Aucun paiement échoué")} explication={t("Aucune commande au statut échoué sur la période et le périmètre choisis.")} />}
      </Carte>
    </div>
  );
}
