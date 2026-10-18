// Calculs de Revenue Intelligence (/admin/revenus) absents du moteur : analyse
// par plan, changements de plan, recommandations chiffrées. Module pur.
import { PLANS, PRIX_PLAN, type PlanId } from "./types";
import { Vue, tranche, valeur } from "./moteur";
import { JOUR, type Fenetre } from "./contexte";
import { formatValeur } from "./format";
import type { StatsMarchand } from "./insights";

/** Plan payé par marchand à l'instant t (dernier paiement couvrant t ; absent = Essentiel). */
export function planA(v: Vue, t: number): Map<string, PlanId> {
  const m = new Map<string, PlanId>();
  for (const p of tranche(v.abonnements, { debut: t - 30 * JOUR, fin: t + 1 })) m.set(p.marchandId, p.plan);
  return m;
}

/** Changements de plan payés dans la fenêtre (plan du paiement précédent vs nouveau). */
export function changementsPlan(v: Vue, w: Fenetre) {
  const dernier = new Map<string, PlanId>();
  const out: { id: string; date: number; avant: PlanId; apres: PlanId; sens: "upgrade" | "downgrade" }[] = [];
  for (const p of v.abonnements) {
    if (p.date >= w.fin) break;
    const avant = dernier.get(p.marchandId);
    if (p.date >= w.debut && avant && avant !== p.plan) out.push({ id: p.marchandId, date: p.date, avant, apres: p.plan, sens: PRIX_PLAN[p.plan] > PRIX_PLAN[avant] ? "upgrade" : "downgrade" });
    dernier.set(p.marchandId, p.plan);
  }
  return out;
}

export interface LignePlan {
  plan: PlanId; nom: string; marchands: number; actifs: number; mrr: number; entrees: number; conversion: number | null; churn: number | null;
  arpu: number | null; commandesParMarchand: number | null; iaParMarchand: number | null; adoptionPremium: number | null; upgrades: number; downgrades: number;
}

/** Une ligne par plan. Les marchands sont comptés selon leur plan actuel ; MRR et churn selon le plan effectivement payé. */
export function analysePlans(v: Vue, w: Fenetre): LignePlan[] {
  const debut = planA(v, w.debut), fin = planA(v, w.fin);
  const actifs = v.actifs(w), totalActifs = actifs.size;
  const mrrFin = v.mrrParMarchand(w.fin);
  const changements = changementsPlan(v, w);
  const cmd = new Map<string, number>(), ia = new Map<string, number>(), premium = new Set<string>();
  for (const c of v.payees(w)) cmd.set(c.marchandId, (cmd.get(c.marchandId) ?? 0) + 1);
  for (const e of tranche(v.ia, w)) { ia.set(e.marchandId, (ia.get(e.marchandId) ?? 0) + e.nombre); premium.add(e.marchandId); }
  for (const e of tranche(v.fonctions, w)) if (e.fonction === "marketing" || e.fonction === "axia") premium.add(e.marchandId);
  // Premier paiement d'un marchand dans la fenêtre = entrée sur ce plan.
  const premiers = new Map<string, PlanId>();
  const dejaPayant = new Set<string>();
  for (const p of v.abonnements) {
    if (p.date >= w.fin) break;
    if (p.date >= w.debut && !dejaPayant.has(p.marchandId) && !premiers.has(p.marchandId)) premiers.set(p.marchandId, p.plan);
    if (p.date < w.debut) dejaPayant.add(p.marchandId);
  }
  return PLANS.map(({ id: plan, nom }) => {
    const ids = v.marchands.filter((m) => m.plan === plan).map((m) => m.id);
    const act = ids.filter((id) => actifs.has(id));
    const sous = v.sous(`plan:${plan}`, () => new Set(ids));
    let mrr = 0; for (const [id, p] of fin) if (p === plan) mrr += mrrFin.get(id) ?? 0;
    let base = 0, perdus = 0; for (const [id, p] of debut) if (p === plan) { base++; if (!fin.has(id)) perdus++; }
    const up = changements.filter((c) => c.apres === plan && c.sens === "upgrade").length;
    const entrees = plan === "palier0" ? 0 : [...premiers.values()].filter((p) => p === plan).length + up;
    const somme = (m: Map<string, number>) => act.reduce((s, id) => s + (m.get(id) ?? 0), 0);
    return {
      plan, nom, marchands: ids.length, actifs: act.length, mrr, entrees,
      conversion: plan === "palier0" || !totalActifs ? null : entrees / totalActifs,
      churn: plan === "palier0" || base < 1 ? null : perdus / base,
      arpu: valeur(sous, "arpu", w),
      commandesParMarchand: act.length ? somme(cmd) / act.length : null,
      iaParMarchand: act.length ? somme(ia) / act.length : null,
      adoptionPremium: act.length ? act.filter((id) => premium.has(id)).length / act.length : null,
      upgrades: changements.filter((c) => c.avant === plan && c.sens === "upgrade").length,
      downgrades: changements.filter((c) => c.avant === plan && c.sens === "downgrade").length,
    };
  });
}

/** Recommandations : uniquement des constats chiffrés, avec un volume minimal. Sur les 30 derniers jours. */
export function recommandationsPlans(v: Vue, stats: Map<string, StatsMarchand>): { texte: string; plan: PlanId }[] {
  const out: { texte: string; plan: PlanId }[] = [];
  const parPlan = (p: PlanId) => v.marchands.filter((m) => m.plan === p).map((m) => stats.get(m.id)!).filter((s) => s.mrr > 0 || p === "palier0");
  const pro = parPlan("palier1");
  if (pro.length >= 10) {
    const sans = pro.filter((s) => !s.fonctions30.has("marketing") && !s.fonctions30.has("axia") && s.ia30 === 0).length;
    const part = sans / pro.length;
    if (part >= 0.2) out.push({ plan: "palier1", texte: `${Math.round(part * 100)} % des marchands Pro payants (${sans}/${pro.length}) n'ont utilisé ni Marketing ni Axia sur 30 jours : risque de churn, à accompagner sur ces fonctions.` });
  }
  const ess = parPlan("palier0").filter((s) => s.commandes30 >= 40);
  if (ess.length) out.push({ plan: "palier0", texte: `${ess.length} marchand${ess.length > 1 ? "s" : ""} Essentiel dépasse${ess.length > 1 ? "nt" : ""} 40 commandes sur 30 jours (limite du plan : 60/mois) : candidats au Pro (+${formatValeur(ess.length * PRIX_PLAN.palier1, "xaf")} de MRR potentiel).` });
  const ill = parPlan("palier2");
  if (ill.length >= 10) {
    const faibles = ill.filter((s) => s.commandes30 < 10).length, part = faibles / ill.length;
    if (part >= 0.3) out.push({ plan: "palier2", texte: `${Math.round(part * 100)} % des marchands Illimité payants (${faibles}/${ill.length}) ont moins de 10 commandes sur 30 jours : risque de downgrade vers le Pro.` });
  }
  return out;
}
