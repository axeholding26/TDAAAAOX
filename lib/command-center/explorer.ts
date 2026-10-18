// Explorer les données : une métrique × une dimension (ou le temps), sur la période des
// filtres globaux, avec un constat factuel calculé. Module pur.
import { METRIQUE, valeur, ventiler, type Vue } from "./moteur";
import { JOUR, type Fenetre, type Fenetres } from "./contexte";
import { NOM_PLAN, SOURCES_ACQ, nomPays, type PlanId } from "./types";
import { formatValeur, formatVariation, dateCourte } from "./format";

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

const pct = (x: number) => formatValeur(x, "pct");
const evol = (a: number | null, b: number | null, f: string) => {
  if (a == null || b == null) return null;
  if (f === "pct") return formatVariation(a - b, "pct");
  return b === 0 ? null : formatVariation((a - b) / Math.abs(b), "nombre");
};

/** Constat factuel calculé (jamais d'interprétation causale). */
export function constat(id: string, dim: Dimension, lignes: { nom: string; valeur: number | null; precedente?: number | null; part?: number | null }[], cur: number | null, prev: number | null, libComp: string): string {
  const m = METRIQUE[id];
  const fmt = (x: number | null) => formatValeur(x, m.format);
  const ok = lignes.filter((l) => l.valeur != null);
  if (!ok.length && cur == null) return "Pas de données pour cette métrique sur la période.";
  if (dim === "aucune") {
    const e = evol(cur, prev, m.format);
    return `${m.nom} : ${fmt(cur)}${e ? `, ${e} ${libComp} (${fmt(prev)})` : ""}.`;
  }
  if (dim === "temps") {
    if (ok.length < 2) return "Pas assez de points pour décrire une tendance.";
    const max = ok.reduce((a, b) => (b.valeur! > a.valeur! ? b : a));
    const min = ok.reduce((a, b) => (b.valeur! < a.valeur! ? b : a));
    const e = evol(cur, prev, m.format);
    return `${m.nom} : plus haut le ${max.nom} (${fmt(max.valeur)}), plus bas le ${min.nom} (${fmt(min.valeur)}).${e ? ` Sur la période : ${fmt(cur)}, ${e} ${libComp}.` : ""}`;
  }
  if (ok.length < 2) return `Un seul segment présent : ${ok[0]?.nom ?? "—"} (${fmt(ok[0]?.valeur ?? null)}).`;
  const top = ok[0];
  const e = evol(top.valeur, top.precedente ?? null, m.format);
  const tendance = e ? `, ${e.startsWith("−") ? "en baisse" : e === "0 %" || e === "0 pt" ? "stable" : "en hausse"} (${e}) ${libComp}` : "";
  if (m.additive && top.part != null) return `${top.nom} représente ${pct(top.part)} du total (${fmt(top.valeur)})${tendance}. ${ok.length} segments au total.`;
  const bas = ok[ok.length - 1];
  return `${top.nom} a la valeur la plus élevée (${fmt(top.valeur)})${tendance} ; la plus basse : ${bas.nom} (${fmt(bas.valeur)}).`;
}
