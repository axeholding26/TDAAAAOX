// Explorer les données : une métrique × une dimension (ou le temps), sur la période des
// filtres globaux, avec un constat factuel calculé. Module pur.
import { METRIQUE, valeur, ventiler, type Vue } from "./moteur";
import { JOUR, type Fenetre, type Fenetres } from "./contexte";
import { NOM_PLAN, SOURCES_ACQ, nomPays, type PlanId } from "./types";
import { dateCourte, formats, T_FR } from "./format";
import type { T } from "@/lib/i18n";

export const DIMENSIONS = [
  { id: "aucune", nom: "Aucune" }, { id: "pays", nom: "Pays" }, { id: "plan", nom: "Plan" },
  { id: "industrie", nom: "Industrie" }, { id: "source", nom: "Source d'acquisition" }, { id: "temps", nom: "Temps" },
] as const;
export type Dimension = (typeof DIMENSIONS)[number]["id"];
export const GRANULARITES = [{ id: "jour", nom: "Jour", ms: JOUR }, { id: "semaine", nom: "Semaine", ms: 7 * JOUR }, { id: "mois", nom: "Mois", ms: 30 * JOUR }] as const;
export type Granularite = (typeof GRANULARITES)[number]["id"];
const MAX_POINTS = 400;

export function libelleDim(dim: Dimension, k: string) {
  return dim === "pays" ? nomPays(k) : dim === "plan" ? NOM_PLAN[k as PlanId] ?? k : dim === "source" ? SOURCES_ACQ[k] ?? k : k;
}

export interface Ligne { cle: string; nom: string; valeur: number | null; precedente: number | null; part: number | null }

/** Ventilation par segment. Métriques additives : ventiler() ; ratios : on garde « null » (pas de 0 trompeur). */
export function parDimension(v: Vue, id: string, f: Fenetres, dim: Exclude<Dimension, "aucune" | "temps">): Ligne[] {
  const m = METRIQUE[id];
  let a: Map<string, number | null>, b: Map<string, number | null>;
  if (m.additive) { a = ventiler(v, id, f.cur, dim); b = ventiler(v, id, f.prev, dim); }
  else {
    const groupes = new Map<string, Set<string>>();
    for (const x of v.marchands) { const k = x[dim] as string; if (!groupes.has(k)) groupes.set(k, new Set()); groupes.get(k)!.add(x.id); }
    a = new Map(); b = new Map();
    for (const [k, ids] of groupes) { const s = v.sous(`${dim}:${k}`, () => ids); a.set(k, valeur(s, id, f.cur)); b.set(k, valeur(s, id, f.prev)); }
  }
  const total = m.additive ? [...a.values()].reduce<number>((s, x) => s + (x ?? 0), 0) : 0;
  return [...a].map(([cle, val]) => ({ cle, nom: libelleDim(dim, cle), valeur: val, precedente: b.get(cle) ?? null, part: m.additive && total > 0 && val != null ? val / total : null }))
    .sort((x, y) => (y.valeur ?? -Infinity) - (x.valeur ?? -Infinity));
}

/** Découpe la fenêtre en tranches de la granularité (la dernière est tronquée à la fin), au plus MAX_POINTS. */
export function tranches(w: Fenetre, g: Granularite): Fenetre[] {
  const pas = Math.max(GRANULARITES.find((x) => x.id === g)!.ms, Math.ceil((w.fin - w.debut) / MAX_POINTS));
  const out: Fenetre[] = [];
  for (let d = w.debut; d < w.fin; d += pas) out.push({ debut: d, fin: Math.min(d + pas, w.fin) });
  return out;
}

/** Série temporelle (métriques de stock : valeur en fin de tranche, sur la même durée que la tranche). */
export function parTemps(v: Vue, id: string, w: Fenetre, g: Granularite) {
  return tranches(w, g).map((t) => ({ cle: String(t.debut), nom: dateCourte(t.debut), valeur: valeur(v, id, t), debut: t.debut }));
}


/** Constat factuel calculé (jamais d'interprétation causale). */
export function constat(id: string, dim: Dimension, lignes: { nom: string; valeur: number | null; precedente?: number | null; part?: number | null }[], cur: number | null, prev: number | null, libComp: string, t: T = T_FR): string {
  const F = formats(t);
  const m = METRIQUE[id];
  const nom = t(m.nom), comp = t(libComp);
  const fmt = (x: number | null) => F.formatValeur(x, m.format);
  const evol = (a: number | null, b: number | null, f: string) => {
    if (a == null || b == null) return null;
    if (f === "pct") return F.formatVariation(a - b, "pct");
    return b === 0 ? null : F.formatVariation((a - b) / Math.abs(b), "nombre");
  };
  const ok = lignes.filter((l) => l.valeur != null);
  if (!ok.length && cur == null) return t("Pas de données pour cette métrique sur la période.");
  if (dim === "aucune") {
    const e = evol(cur, prev, m.format);
    return e ? t("{0} : {1}, {2} {3} ({4}).", nom, fmt(cur), e, comp, fmt(prev)) : t("{0} : {1}.", nom, fmt(cur));
  }
  if (dim === "temps") {
    if (ok.length < 2) return t("Pas assez de points pour décrire une tendance.");
    const max = ok.reduce((a, b) => (b.valeur! > a.valeur! ? b : a));
    const min = ok.reduce((a, b) => (b.valeur! < a.valeur! ? b : a));
    const e = evol(cur, prev, m.format);
    return t("{0} : plus haut le {1} ({2}), plus bas le {3} ({4}).", nom, max.nom, fmt(max.valeur), min.nom, fmt(min.valeur)) + (e ? " " + t("Sur la période : {0}, {1} {2}.", fmt(cur), e, comp) : "");
  }
  if (ok.length < 2) return t("Un seul segment présent : {0} ({1}).", ok[0]?.nom ?? "—", fmt(ok[0]?.valeur ?? null));
  const top = ok[0];
  const e = evol(top.valeur, top.precedente ?? null, m.format);
  const tendance = e ? t(e.startsWith("−") ? ", en baisse ({0}) {1}" : e === F.formatVariation(0, "nombre") || e === F.formatVariation(0, "pct") ? ", stable ({0}) {1}" : ", en hausse ({0}) {1}", e, comp) : "";
  if (m.additive && top.part != null) return t("{0} représente {1} du total ({2}){3}. {4} segments au total.", top.nom, F.formatValeur(top.part, "pct"), fmt(top.valeur), tendance, ok.length);
  const bas = ok[ok.length - 1];
  return t("{0} a la valeur la plus élevée ({1}){2} ; la plus basse : {3} ({4}).", top.nom, fmt(top.valeur), tendance, bas.nom, fmt(bas.valeur));
}
