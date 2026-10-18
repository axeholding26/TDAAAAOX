import Link from "next/link";
import { X } from "lucide-react";
import { contexteCC } from "@/lib/command-center/serveur";
import { fichesMarchands } from "@/lib/command-center/marchands";
import { NOM_STATUT, type StatutSante } from "@/lib/command-center/insights";
import { NOM_PLAN, nomPays } from "@/lib/command-center/types";
import { NOM_ETAPE } from "@/lib/command-center/reglages";
import { lien } from "@/lib/command-center/contexte";
import { peutAgir, peutVoir } from "@/lib/command-center/rbac";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { EnTetePage, Carte, ListeBarres, EtatVide, Note, Fraicheur } from "@/components/command-center/ui";
import type { Ligne } from "@/components/command-center/client";
import { TableMarchands } from "./TableMarchands";

const STATUTS: StatutSante[] = ["croissance", "sain", "risque", "critique"];
const TON = { croissance: "cc-good", sain: "", risque: "cc-warn", critique: "cc-bad" } as const;
const ETAPES = ["boutique", "produit", "commande", "paiement"] as const;
type Etape = (typeof ETAPES)[number];

export default async function Marchands({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const c = await contexteCC("marchands", sp);
  const t = await getT();
  const { formatValeur } = formats(t);
  const { vue: v, fen: f, filtres, session } = c;
  const un = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) as string | undefined;
  const statut = STATUTS.find((s) => s === un("statut"));
  const etape = ETAPES.find((e) => e === un("etape")) as Etape | undefined;
  const L = (p: string) => lien(p, filtres);

  const fiches = fichesMarchands(v, c.reglages.poids_sante);
  // Drill-down « n'a pas atteint l'étape » : même définition que l'entonnoir (inscrits ayant eu 14 jours, étape non atteinte sous 14 jours).
  const pasAtteint = etape ? new Set(v.nouveauxMurs(f.cur).filter((m) => !v.active(m, etape)).map((m) => m.id)) : null;
  const base = pasAtteint ? fiches.filter((x) => pasAtteint.has(x.m.id)) : fiches;
  const affiches = statut ? base.filter((x) => x.sante.statut === statut) : base;
  const voirRevenu = peutVoir(session.role, "revenus");

  const compte = Object.fromEntries(STATUTS.map((s) => [s, base.filter((x) => x.sante.statut === s).length])) as Record<StatutSante, number>;
  const top = [...base].sort((a, b) => b.s.gmv30 - a.s.gmv30).filter((x) => x.s.gmv30 > 0).slice(0, 10);

  // Uniquement les colonnes affichées : ni email ni téléphone vers le client.
  const lignes: Ligne[] = affiches.map(({ m, s, sante, churn, revenu30, expansion }) => ({
    _id: m.id, _href: L(`/admin/marchands/${m.id}`),
    nom: m.nom, pays: t(nomPays(m.pays)), plan: t(NOM_PLAN[m.plan]), gmv: s.gmv30, commandes: s.commandes30,
    ...(voirRevenu ? { revenu: revenu30 } : {}),
    activite: m.derniereActivite, ia: s.ia30, score: sante.score, statut: t(NOM_STATUT[sante.statut]),
    croissance: sante.croissance, churn, expansion: expansion?.score ?? null,
  }));

  const sansFiltre = (k: "statut" | "etape") => {
    const q = new URLSearchParams();
    if (k !== "statut" && statut) q.set("statut", statut);
    if (k !== "etape" && etape) q.set("etape", etape);
    return L(`/admin/marchands${q.size ? `?${q}` : ""}`);
  };
  const avecStatut = (s: StatutSante) => L(`/admin/marchands?statut=${s}${etape ? `&etape=${etape}` : ""}`);

  return (
    <div className="space-y-5">
      <EnTetePage
        eyebrow={t("Marchands")}
        titre="Merchant Intelligence"
        sousTitre={t("{0} marchands dans le périmètre · indicateurs sur les 30 derniers jours", formatValeur(v.marchands.length, "nombre", true))}
        actions={<Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} />}
      />
      {c.erreur && <Note ton="warn">{t(c.erreur)}</Note>}
      {(statut || etape) && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          <span className="cc-faint">{t("Filtré :")}</span>
          {etape && <Link href={sansFiltre("etape")} className="cc-badge cc-badge-accent">{t("Inscrits ({0}) sans « {1} » sous 14 j", t(f.libelle).toLowerCase(), t(NOM_ETAPE[etape]))} <X size={11} aria-label={t("Retirer")} /></Link>}
          {statut && <Link href={sansFiltre("statut")} className="cc-badge cc-badge-accent">{t(NOM_STATUT[statut])} <X size={11} aria-label={t("Retirer")} /></Link>}
        </div>
      )}

      {!v.marchands.length ? (
        <Carte><EtatVide titre={t("Aucun marchand dans ce périmètre")} explication={t(c.ds.source === "reel" ? "Aucune boutique ne correspond aux filtres. Élargissez-les ou consultez les données de démonstration." : "Élargissez les filtres.")} /></Carte>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
            <Carte titre={t("Répartition santé")} sousTitre={t("Score santé /100 — cliquez pour filtrer")} actions={<Link href={L("/admin/succes-client")} className="cc-btn cc-btn-ghost cc-btn-sm">{t("Succès client")}</Link>}>
              <div className="grid grid-cols-2 gap-2">
                {STATUTS.map((s) => (
                  <Link key={s} href={avecStatut(s)} aria-current={statut === s ? "true" : undefined} className="cc-card cc-hover p-3 block" style={statut === s ? { borderColor: "var(--cc-accent)" } : undefined}>
                    <p className="text-[12px] cc-muted">{t(NOM_STATUT[s])}</p>
                    <p className={`text-[22px] font-semibold cc-num ${TON[s]}`}>{formatValeur(compte[s], "nombre", true)}</p>
                    <p className="cc-faint text-[11px] cc-num">{base.length ? t("{0} %", Math.round((compte[s] / base.length) * 100)) : "—"}</p>
                  </Link>
                ))}
              </div>
            </Carte>
            <Carte titre={t("Top 10 par GMV")} sousTitre={t("Commandes payées, 30 derniers jours")}>
              {top.length ? <ListeBarres format="xaf" lignes={top.map((x) => ({ cle: x.m.id, nom: x.m.nom, valeur: x.s.gmv30, sous: t(nomPays(x.m.pays)), href: L(`/admin/marchands/${x.m.id}`) }))} />
                : <EtatVide titre={t("Aucune vente sur 30 jours")} explication={t("Le classement apparaîtra dès qu'un marchand du périmètre encaisse une commande.")} />}
            </Carte>
          </div>

          <Carte titre={t("Tous les marchands")} sousTitre={t("Cliquez sur un nom pour la vue 360°. Risque churn : score heuristique (santé), pas un modèle entraîné.")}>
            <TableMarchands lignes={lignes} revenu={voirRevenu} source={c.ds.source} peutAgir={peutAgir(session.role)} lienPage={L("/admin/marchands")} />
          </Carte>
        </>
      )}
    </div>
  );
}
