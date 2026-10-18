"use client";
// Composants de base du Command Center qui affichent du texte ou des nombres formatés :
// composants client pour lire la langue (useT) ; réexportés par ./ui (les pages importent toujours ./ui).
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Inbox, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { Mesure, Format } from "@/lib/command-center/moteur";
import { formats } from "@/lib/command-center/format";
import { lien, type Filtres } from "@/lib/command-center/contexte";
import { useT } from "@/components/I18nProvider";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Variation colorée selon le sens de la métrique (une baisse du churn est une bonne nouvelle). */
export function Delta({ variation, format, sens = 1, petit }: { variation: number | null; format: Format; sens?: 1 | -1; petit?: boolean }) {
  const { formatVariation } = formats(useT());
  if (variation == null) return <span className="cc-faint text-[12px]">—</span>;
  const neutre = Math.abs(variation) < (format === "pct" ? 0.005 : 0.01);
  const bon = variation * sens > 0;
  const Icone = neutre ? Minus : variation > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cx("inline-flex items-center gap-1 font-semibold cc-num", petit ? "text-[11.5px]" : "text-[12.5px]", neutre ? "cc-faint" : bon ? "cc-good" : "cc-bad")}>
      <Icone size={petit ? 12 : 13} aria-hidden />
      {formatVariation(variation, format)}
    </span>
  );
}

/** Mini-tendance SVG (aucune librairie) ; la dernière valeur est marquée. */
export function Sparkline({ points, ton = "neutre", largeur = 96, hauteur = 28 }: { points: (number | null)[]; ton?: "good" | "bad" | "neutre"; largeur?: number; hauteur?: number }) {
  const vals = points.map((p) => p ?? 0);
  if (vals.length < 2 || vals.every((v) => v === 0)) return <svg width={largeur} height={hauteur} aria-hidden />;
  const min = Math.min(...vals), max = Math.max(...vals), e = max - min || 1;
  const xy = vals.map((v, i) => [(i / (vals.length - 1)) * (largeur - 4) + 2, hauteur - 3 - ((v - min) / e) * (hauteur - 6)] as const);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const couleur = ton === "good" ? "var(--cc-good)" : ton === "bad" ? "var(--cc-bad)" : "var(--cc-text-3)";
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg width={largeur} height={hauteur} viewBox={`0 0 ${largeur} ${hauteur}`} aria-hidden className="overflow-visible">
      <path d={`${d}L${lx},${hauteur}L2,${hauteur}Z`} fill={couleur} opacity={0.08} />
      <path d={d} fill="none" stroke={couleur} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={2.4} fill={couleur} />
    </svg>
  );
}

const STATUT_TON = { bon: "good", mauvais: "bad", neutre: "neutre", inconnu: "neutre" } as const;

/** KPI complet : valeur, variation, comparaison, mini-tendance, statut, drill-down. */
export function Kpi({ m, filtres, libelleComp, grand }: { m: Mesure; filtres: Filtres; libelleComp: string; grand?: boolean }) {
  const t = useT();
  const { formatValeur } = formats(t);
  const nom = t(m.nom);
  const contenu = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium cc-muted truncate" data-tip={`${t(m.description)} — ${t(m.formule)}`}>{nom}</p>
        <ArrowUpRight size={13} className="cc-faint shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden />
      </div>
      <p className={cx("font-semibold cc-num mt-1 truncate", grand ? "text-[26px]" : "text-[21px]")}>{formatValeur(m.valeur, m.format)}</p>
      <div className="flex items-end justify-between gap-2 mt-1.5">
        <div className="min-w-0">
          <Delta variation={m.variation} format={m.format} sens={m.sens} petit />
          <p className="cc-faint text-[11px] truncate">{m.precedente == null ? t("pas de comparaison") : `${t(libelleComp)} · ${formatValeur(m.precedente, m.format)}`}</p>
        </div>
        <Sparkline points={m.serie} ton={STATUT_TON[m.statut] === "neutre" ? "neutre" : STATUT_TON[m.statut]} largeur={72} hauteur={26} />
      </div>
    </>
  );
  return (
    <Link href={lien(m.page, filtres)} className="group cc-card cc-hover block p-3.5 min-w-0 cc-fade" aria-label={t("{0} : {1}, voir le détail", nom, formatValeur(m.valeur, m.format))}>
      {contenu}
    </Link>
  );
}

/** Anneau de score /100. */
export function Jauge({ score, taille = 88, epaisseur = 7, libelle }: { score: number | null; taille?: number; epaisseur?: number; libelle?: string }) {
  const t = useT();
  const r = (taille - epaisseur) / 2, c = 2 * Math.PI * r, p = score == null ? 0 : score / 100;
  const couleur = score == null ? "var(--cc-text-3)" : score >= 75 ? "var(--cc-good)" : score >= 50 ? "var(--cc-warn)" : "var(--cc-bad)";
  return (
    <div className="relative shrink-0" style={{ width: taille, height: taille }} role="img" aria-label={t("{0} : {1} sur 100", libelle ?? t("Score"), score ?? t("inconnu"))}>
      <svg width={taille} height={taille} className="-rotate-90">
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="var(--cc-surface-3)" strokeWidth={epaisseur} />
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke={couleur} strokeWidth={epaisseur} strokeLinecap="round" strokeDasharray={`${c * p} ${c}`} style={{ transition: "stroke-dasharray .6s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-semibold cc-num" style={{ fontSize: taille * 0.3 }}>{score ?? "—"}</span>
        <span className="cc-faint" style={{ fontSize: Math.max(9, taille * 0.11) }}>/100</span>
      </div>
    </div>
  );
}

/** Liste de barres horizontales (classements). */
export function ListeBarres({ lignes, format, max }: { lignes: { cle: string; nom: ReactNode; valeur: number; sous?: ReactNode; href?: string }[]; format: Format; max?: number }) {
  const { formatValeur } = formats(useT());
  const m = max ?? Math.max(1, ...lignes.map((l) => l.valeur));
  if (!lignes.length) return <EtatVide titre="Aucune donnée" />;
  return (
    <ul className="space-y-2.5">
      {lignes.map((l) => {
        const corps = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate">{l.nom}</span>
              <span className="cc-num font-medium shrink-0">{formatValeur(l.valeur, format)}{l.sous && <span className="cc-faint font-normal ml-1.5">{l.sous}</span>}</span>
            </div>
            <div className="h-1.5 mt-1 rounded-full" style={{ background: "var(--cc-surface-3)" }}>
              <div className="h-full rounded-full" style={{ width: `${Math.max(1.5, (l.valeur / m) * 100)}%`, background: "var(--cc-s1)" }} />
            </div>
          </>
        );
        return <li key={l.cle}>{l.href ? <Link href={l.href} className="block rounded-md hover:opacity-80">{corps}</Link> : corps}</li>;
      })}
    </ul>
  );
}

/** État vide. `titre` traduit ici (no-op s'il l'est déjà). */
export function EtatVide({ titre, explication, action }: { titre: string; explication?: string; action?: ReactNode }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center justify-center text-center py-8 px-4 gap-2">
      <Inbox size={20} className="cc-faint" aria-hidden />
      <p className="text-[13px] font-medium">{t(titre)}</p>
      {explication && <p className="cc-faint text-[12px] max-w-sm">{t(explication)}</p>}
      {action}
    </div>
  );
}

/** Onglets de navigation par lien (conservent le contexte). */
export function Onglets({ onglets, actif }: { onglets: { id: string; nom: string; href: string }[]; actif: string }) {
  const t = useT();
  return (
    <nav className="cc-tabs cc-no-print" aria-label={t("Sections")}>
      {onglets.map((o) => <Link key={o.id} href={o.href} className="cc-tab" aria-current={o.id === actif ? "page" : undefined}>{o.nom}</Link>)}
    </nav>
  );
}

/** Tableau simple. Pour tri / recherche / export : TableauInteractif. */
export function Tableau({ colonnes, lignes, vide }: { colonnes: { cle: string; nom: string; droite?: boolean }[]; lignes: Record<string, ReactNode>[]; vide?: string }) {
  if (!lignes.length) return <EtatVide titre={vide ?? "Aucune donnée"} />;
  return (
    <div className="overflow-x-auto -mx-4">
      <table className="cc-table">
        <thead><tr>{colonnes.map((c) => <th key={c.cle} className={c.droite ? "r" : ""}>{c.nom}</th>)}</tr></thead>
        <tbody>{lignes.map((l, i) => <tr key={i}>{colonnes.map((c) => <td key={c.cle} className={cx(c.droite && "r cc-num")}>{l[c.cle]}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Bandeau de fraîcheur / source : on n'affiche jamais du « temps réel » qui n'en est pas. */
export function Fraicheur({ genereA, source, erreur }: { genereA: number; source: "reel" | "demo"; erreur?: string | null }) {
  const t = useT();
  const age = Math.max(0, Math.round((Date.now() - genereA) / 1000));
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] cc-faint" suppressHydrationWarning>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: erreur ? "var(--cc-warn)" : age < 120 ? "var(--cc-good)" : "var(--cc-text-3)" }} aria-hidden />
      {source === "demo" ? t("Données de démonstration") : erreur ? t("Données retardées") : age < 60 ? t("Mis à jour il y a {0} s", age) : t("Mis à jour il y a {0} min", Math.round(age / 60))}
    </span>
  );
}
