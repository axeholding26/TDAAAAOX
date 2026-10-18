// Expériences A/B : test z bilatéral à deux proportions (variante vs contrôle). Module pur.
import type { Experience } from "./types";

/** Population minimale par variante avant de pouvoir déclarer un gagnant. */
export const POPULATION_MIN = 100;
export const SEUIL_P = 0.05;

/** Fonction d'erreur (Abramowitz & Stegun 7.1.26, erreur < 1,5e-7). */
function erf(x: number) {
  const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
const phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));

export interface TestZ { tauxA: number; tauxB: number; lift: number | null; z: number | null; p: number | null }

/** A = contrôle, B = variante. p-value bilatérale ; null si non calculable. */
export function testZ(nA: number, cA: number, nB: number, cB: number): TestZ {
  const tauxA = nA ? cA / nA : 0, tauxB = nB ? cB / nB : 0;
  const lift = tauxA > 0 ? (tauxB - tauxA) / tauxA : null;
  if (!nA || !nB) return { tauxA, tauxB, lift, z: null, p: null };
  const pool = (cA + cB) / (nA + nB);
  const se = Math.sqrt(pool * (1 - pool) * (1 / nA + 1 / nB));
  if (!se) return { tauxA, tauxB, lift, z: null, p: null };
  const z = (tauxB - tauxA) / se;
  return { tauxA, tauxB, lift, z, p: 2 * (1 - phi(Math.abs(z))) };
}

export type Verdict = "gagnant" | "perdant" | "non_significatif" | "insuffisant";

export function analyserExperience(e: Experience) {
  const [ctrl, ...autres] = e.variantes;
  const variantes = autres.map((x) => {
    const t = testZ(ctrl.population, ctrl.conversions, x.population, x.conversions);
    // Approximation normale valable si ≥ 5 succès et ≥ 5 échecs par groupe.
    const assez = [ctrl, x].every((g) => g.population >= POPULATION_MIN && g.conversions >= 5 && g.population - g.conversions >= 5);
    const verdict: Verdict = !assez || t.p == null ? "insuffisant" : t.p >= SEUIL_P ? "non_significatif" : t.tauxB > t.tauxA ? "gagnant" : "perdant";
    return { nom: x.nom, population: x.population, conversions: x.conversions, ...t, confiance: t.p == null ? null : 1 - t.p, verdict };
  });
  return { controle: ctrl ?? null, tauxControle: ctrl?.population ? ctrl.conversions / ctrl.population : null, variantes };
}
