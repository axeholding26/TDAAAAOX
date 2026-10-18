// Merchant Intelligence : une ligne calculée par marchand (santé, churn, expansion,
// revenu Axso). Module pur, partagé par /admin/marchands, /admin/marchands/[id] et
// /admin/succes-client — même formules que lib/command-center/insights.ts.
import type { Marchand } from "./types";
import { JOUR } from "./contexte";
import { tranche, type Vue } from "./moteur";
import { statsMarchands, santeMarchand, radarExpansion, type Sante, type StatsMarchand, type Expansion } from "./insights";
import type { PoidsSante } from "./reglages";

/** Même formule que radarChurn (insights.ts), étendue à tous les marchands. Heuristique, pas un modèle entraîné. */
export const risqueChurn = (score: number) => Math.round(Math.max(0, Math.min(0.98, ((100 - score) / 100) * 1.15 - 0.05)) * 100) / 100;

export interface FicheMarchand {
  m: Marchand; s: StatsMarchand; sante: Sante; churn: number;
  /** Revenu Axso 30 j : commissions + paiements d'abonnement. */
  revenu30: number; expansion: Expansion | null;
}

export function fichesMarchands(v: Vue, poids: PoidsSante): FicheMarchand[] {
  const stats = statsMarchands(v);
  const abo = new Map<string, number>();
  for (const p of tranche(v.abonnements, { debut: v.maintenant - 30 * JOUR, fin: v.maintenant + 1 })) abo.set(p.marchandId, (abo.get(p.marchandId) ?? 0) + p.montant);
  const exp = new Map(radarExpansion(v, stats).map((e) => [e.marchand.id, e]));
  return v.marchands.map((m) => {
    const s = stats.get(m.id)!;
    const sante = santeMarchand(m, s, poids);
    return { m, s, sante, churn: risqueChurn(sante.score), revenu30: s.commission30 + (abo.get(m.id) ?? 0), expansion: exp.get(m.id) ?? null };
  });
}
