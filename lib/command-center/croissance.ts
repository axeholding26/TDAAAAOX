// Calculs du Growth Center (/admin/croissance) absents du moteur : réactivation,
// dormants, acquisition par canal / campagne, mesures dérivées. Module pur.
import { Vue, tranche, ventiler, type Mesure, type Format } from "./moteur";
import { JOUR, type Fenetre } from "./contexte";

const DORMANCE = 30 * JOUR;

/** Mesure (valeur, comparaison, mini-tendance) d'un calcul qui n'est pas une métrique du moteur. */
export function mesureCalculee(
  def: { id: string; nom: string; format: Format; sens: 1 | -1; description: string; formule: string; page: string; instant?: boolean },
  calc: (w: Fenetre) => number | null, cur: Fenetre, prev: Fenetre, points = 8,
): Mesure {
  const a = calc(cur), b = calc(prev);
  const variation = a == null || b == null ? null : def.format === "pct" ? a - b : b === 0 ? (a === 0 ? 0 : null) : (a - b) / Math.abs(b);
  const seuil = def.format === "pct" ? 0.005 : 0.01;
  const statut = variation == null ? "inconnu" : Math.abs(variation) < seuil ? "neutre" : variation * def.sens > 0 ? "bon" : "mauvais";
  const pas = (cur.fin - cur.debut) / points;
  const serie = Array.from({ length: points }, (_, i) => {
    const fin = cur.debut + pas * (i + 1);
    return calc(def.instant ? { debut: fin - (cur.fin - cur.debut), fin } : { debut: fin - pas, fin });
  });
  return { id: def.id, nom: def.nom, format: def.format, sens: def.sens, valeur: a, precedente: b, variation, statut, serie, page: def.page, description: def.description, formule: def.formule };
}

/** Dates d'activité triées par marchand (commandes, usage produit, IA). */
function activites(v: Vue): Map<string, number[]> {
  const m = new Map<string, number[]>();
  const add = (id: string, d: number) => { let a = m.get(id); if (!a) m.set(id, (a = [])); a.push(d); };
  for (const c of v.commandes) add(c.marchandId, c.date);
  for (const e of v.fonctions) add(e.marchandId, e.date);
  for (const e of v.ia) add(e.marchandId, e.date);
  for (const a of m.values()) a.sort((x, y) => x - y);
  return m;
}

const memoAct = new WeakMap<Vue, Map<string, number[]>>();
const act = (v: Vue) => { let a = memoAct.get(v); if (!a) memoAct.set(v, (a = activites(v))); return a; };

/** Marchands redevenus actifs dans la fenêtre après ≥ 30 jours sans aucune activité. */
export function reactives(v: Vue, w: Fenetre): Set<string> {
  const out = new Set<string>();
  for (const [id, dates] of act(v)) {
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] >= w.fin) break;
      if (dates[i] >= w.debut && dates[i] - dates[i - 1] >= DORMANCE) { out.add(id); break; }
    }
  }
  return out;
}

/** Marchands inscrits depuis plus de 30 jours, sans activité sur les 30 jours précédant t. */
export function dormants(v: Vue, t: number): number {
  const actifs = v.actifs({ debut: t - DORMANCE, fin: t });
  return v.marchands.filter((m) => m.creeLe <= t - DORMANCE && !actifs.has(m.id)).length;
}

/** Marchands dont le tout premier paiement d'abonnement tombe dans la fenêtre. */
export function nouveauxPayants(v: Vue, w: Fenetre): number {
  const vus = new Set<string>();
  let n = 0;
  for (const p of v.abonnements) {
    if (p.date >= w.fin) break;
    if (vus.has(p.marchandId)) continue;
    vus.add(p.marchandId);
    if (p.date >= w.debut) n++;
  }
  return n;
}

/** Acquisition par canal : visiteurs, inscriptions, conversion, dépenses, CAC (les dépenses ne valent que sans segment). */
export function parCanal(v: Vue, w: Fenetre) {
  const inscrits = ventiler(v, "nouveaux_marchands", w, "source");
  const visiteurs = new Map<string, number>(), depenses = new Map<string, number>();
  if (!v.filtreActif()) {
    for (const x of tranche(v.ds.visites, w)) visiteurs.set(x.source, (visiteurs.get(x.source) ?? 0) + x.visiteurs);
    for (const d of tranche(v.ds.depenses, w)) depenses.set(d.canal, (depenses.get(d.canal) ?? 0) + d.montant);
  }
  return [...new Set([...inscrits.keys(), ...visiteurs.keys(), ...depenses.keys()])].map((canal) => {
    const n = inscrits.get(canal) ?? 0, vis = visiteurs.get(canal) ?? null, dep = depenses.get(canal) ?? null;
    return { canal, inscrits: n, visiteurs: vis, conversion: vis ? n / vis : null, depenses: dep, cac: dep != null && n > 0 ? dep / n : null };
  }).sort((a, b) => b.inscrits - a.inscrits);
}

/** Dépenses par campagne ; le CAC est celui du canal (une inscription n'est rattachée qu'à un canal, pas à une campagne). */
export function parCampagne(v: Vue, w: Fenetre) {
  if (v.filtreActif()) return [];
  const camp = new Map<string, { canal: string; depenses: number }>();
  for (const d of tranche(v.ds.depenses, w)) { const c = camp.get(d.campagne) ?? { canal: d.canal, depenses: 0 }; c.depenses += d.montant; camp.set(d.campagne, c); }
  const canaux = new Map(parCanal(v, w).map((c) => [c.canal, c]));
  return [...camp].map(([nom, c]) => ({ nom, canal: c.canal, depenses: c.depenses, inscritsCanal: canaux.get(c.canal)?.inscrits ?? 0, cacCanal: canaux.get(c.canal)?.cac ?? null })).sort((a, b) => b.depenses - a.depenses);
}
