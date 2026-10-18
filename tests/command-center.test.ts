// Command Center : fonctions pures critiques (filtres d'URL, fenêtres, MRR, churn, test A/B).
import { test } from "node:test";
import assert from "node:assert/strict";
import { lireFiltres, fenetres, JOUR } from "@/lib/command-center/contexte";
import { Vue, valeur } from "@/lib/command-center/moteur";
import { testZ, analyserExperience } from "@/lib/command-center/experiences";
import type { Dataset, Marchand, PaiementAbonnement } from "@/lib/command-center/types";

const T = Date.UTC(2026, 9, 17, 12); // « maintenant »

test("lireFiltres : valeurs inconnues ou malformées rejetées", () => {
  const f = lireFiltres({ source: "prod", periode: "999j", pays: "cm", plan: "palier9", industrie: "<script>", acq: "ads_meta", comparer: "annee" });
  assert.equal(f.source, "reel");
  assert.equal(f.periode, "30j");
  assert.equal(f.pays, undefined);
  assert.equal(f.plan, undefined);
  assert.equal(f.industrie, undefined);
  assert.equal(f.acq, "ads_meta");
  assert.equal(f.comparer, "annee");
  assert.equal(lireFiltres({ pays: ["CM", "SN"] }).pays, "CM");
  // Période personnalisée sans dates valides → 30 jours.
  assert.equal(lireFiltres({ periode: "perso", du: "2026-01-01", au: "hier" }).periode, "30j");
  assert.equal(lireFiltres({ periode: "perso", du: "2026-01-01", au: "2026-01-31" }).periode, "perso");
  assert.equal(lireFiltres(new URLSearchParams("source=demo&periode=7j")).source, "demo");
});

test("fenetres : durée, comparaison précédente et annuelle", () => {
  const f = fenetres(lireFiltres({ periode: "7j" }), T);
  assert.equal(f.cur.fin - f.cur.debut, 7 * JOUR);
  assert.deepEqual(f.prev, { debut: T - 14 * JOUR, fin: T - 7 * JOUR });
  const a = fenetres(lireFiltres({ periode: "30j", comparer: "annee" }), T);
  assert.equal(a.cur.debut - a.prev.debut, 365 * JOUR);
  const p = fenetres(lireFiltres({ periode: "perso", du: "2026-10-01", au: "2026-10-10" }), T);
  assert.equal(p.cur.debut, Date.UTC(2026, 9, 1) - 3_600_000); // minuit à Douala (UTC+1)
  assert.equal(p.cur.fin, Date.UTC(2026, 9, 11) - 3_600_000); // jour de fin inclus
  const h = fenetres(lireFiltres({ periode: "hier" }), T);
  assert.equal(h.cur.fin, Date.UTC(2026, 9, 17) - 3_600_000);
});

const marchand = (id: string): Marchand => ({ id, nom: id, pays: "CM", plan: "palier1", industrie: "Mode", source: "organique", creeLe: T - 200 * JOUR, derniereActivite: T, actif: true, etapes: { boutique: null, produit: null, commande: null, paiement: null }, nbProduits: 0, produitsStockFaible: 0 });
const ab = (marchandId: string, joursAvant: number, montant: number): PaiementAbonnement => ({ marchandId, date: T - joursAvant * JOUR, plan: montant > 6000 ? "palier2" : "palier1", montant });

// a : Pro stable · b : Pro → Illimité · c : Pro perdu · d : nouveau Pro · e : Illimité → Pro
const ds: Dataset = {
  source: "demo", genereA: T, manques: [], marchands: ["a", "b", "c", "d", "e"].map(marchand),
  commandes: [], ia: [], fonctions: [], visites: [], depenses: [], experiences: [], incidents: [], tickets: [],
  abonnements: [ab("a", 40, 6000), ab("b", 40, 6000), ab("c", 40, 6000), ab("e", 40, 20000), ab("a", 10, 6000), ab("b", 10, 20000), ab("d", 10, 6000), ab("e", 10, 6000)].sort((x, y) => x.date - y.date),
};

test("Vue.mrr et mouvementsMrr", () => {
  const v = new Vue(ds);
  const w = { debut: T - 30 * JOUR, fin: T };
  assert.equal(v.mrr(w.debut), 38000);
  assert.equal(v.mrr(w.fin), 38000);
  const m = v.mouvementsMrr(w);
  assert.deepEqual({ ...m, parMarchand: undefined }, { debut: 38000, nouveau: 6000, expansion: 14000, contraction: 14000, churn: 6000, fin: 38000, parMarchand: undefined });
  assert.equal(m.debut + m.nouveau + m.expansion - m.contraction - m.churn, m.fin);
  // Un paiement couvre 30 jours : 31 jours après le dernier, plus de MRR.
  assert.equal(v.mrr(T + 21 * JOUR), 0);
  // Segment : seuls les marchands filtrés comptent.
  assert.equal(new Vue(ds, {}, new Set(["e"])).mrr(T), 6000);
});

test("churn : payants perdus ÷ payants au début", () => {
  const v = new Vue(ds);
  assert.equal(valeur(v, "churn", { debut: T - 30 * JOUR, fin: T }), 1 / 4);
  assert.equal(valeur(v, "churn", { debut: T - 400 * JOUR, fin: T - 300 * JOUR }), null); // aucun payant au début
});

test("test z à deux proportions", () => {
  // Référence : 200/1000 vs 250/1000 → z ≈ 2,68, p ≈ 0,0073.
  const r = testZ(1000, 200, 1000, 250);
  assert.ok(Math.abs(r.z! - 2.68) < 0.01);
  assert.ok(Math.abs(r.p! - 0.0073) < 0.0005);
  assert.ok(Math.abs(r.lift! - 0.25) < 1e-9);
  assert.ok(Math.abs(testZ(100, 50, 100, 50).p! - 1) < 1e-6);
  assert.equal(testZ(0, 0, 10, 1).p, null);
  const exp = (variantes: { nom: string; population: number; conversions: number }[]) => analyserExperience({ id: "x", nom: "x", type: "t", hypothese: "h", statut: "en_cours", debut: 0, fin: null, variantes });
  assert.equal(exp([{ nom: "A", population: 1000, conversions: 200 }, { nom: "B", population: 1000, conversions: 250 }]).variantes[0].verdict, "gagnant");
  assert.equal(exp([{ nom: "A", population: 1000, conversions: 250 }, { nom: "B", population: 1000, conversions: 200 }]).variantes[0].verdict, "perdant");
  assert.equal(exp([{ nom: "A", population: 1000, conversions: 200 }, { nom: "B", population: 1000, conversions: 210 }]).variantes[0].verdict, "non_significatif");
  // Écart énorme mais population trop petite : pas de gagnant.
  assert.equal(exp([{ nom: "A", population: 50, conversions: 5 }, { nom: "B", population: 50, conversions: 30 }]).variantes[0].verdict, "insuffisant");
  assert.equal(exp([]).variantes.length, 0);
});
