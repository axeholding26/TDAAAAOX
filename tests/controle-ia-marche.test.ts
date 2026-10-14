// AXSO MARKET : le simulateur et le score d'opportunité sont des calculs purs, sans infini ni
// NaN ; ce qu'un modèle d'IA renvoie pour une étude sort toujours marqué « estimation ».
import { test } from "node:test";
import assert from "node:assert/strict";
import { MENTION_PROJECTION, scoreOpportunite, simulerBusiness, structurerEtude, type EntreeSimulation } from "@/lib/controle-ia/simulateur";

const BASE: EntreeSimulation = { capital: 500000, coutProduit: 3500, expedition: 800, prixVente: 9900, budgetMarketing: 100000, coutParVisite: 50, tauxConversion: 0.02, tauxRetour: 0.05, coutsExploitation: 30000 };

/** Tous les nombres d'un résultat, à n'importe quelle profondeur. */
const nombres = (v: unknown): number[] => (typeof v === "number" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(nombres) : []);

test("simulateur : trois scénarios cohérents, avec la mention de projection", () => {
  const s = simulerBusiness(BASE);
  assert.deepEqual(s.scenarios.map((x) => x.cle), ["pessimiste", "base", "optimiste"]);
  const [pire, base, mieux] = s.scenarios;
  // 100 000 / 50 = 2 000 visiteurs × 2 % = 40 commandes ; 5 % de retours.
  assert.equal(base.commandes, 40);
  assert.equal(base.chiffreAffaires, Math.round(40 * 9900 * 0.95));
  assert.equal(base.marge, base.chiffreAffaires - 40 * 4300);
  assert.equal(base.resultat, base.marge - 130000);
  assert.equal(base.tresorerieRestante, 500000 + base.resultat);
  assert.equal(base.pointMort, Math.ceil(130000 / (9900 * 0.95 - 4300)));
  assert.ok(pire.resultat < base.resultat && base.resultat < mieux.resultat);
  assert.equal(s.mention, MENTION_PROJECTION);
  assert.equal(s.capitalInsuffisant, false);
});

test("simulateur : conversion nulle = aucune vente, on perd les coûts fixes", () => {
  const s = simulerBusiness({ ...BASE, tauxConversion: 0 });
  for (const x of s.scenarios) {
    assert.equal(x.commandes, 0);
    assert.equal(x.chiffreAffaires, 0);
    assert.equal(x.resultat, -130000);
    assert.equal(x.tresorerieRestante, 370000);
  }
  assert.ok(s.alertes.some((a) => a.includes("conversion nul")));
});

test("simulateur : marge négative = point mort jamais atteint, signalé", () => {
  for (const e of [{ ...BASE, coutProduit: 12000 }, { ...BASE, tauxMarge: -0.2 }]) {
    const s = simulerBusiness(e);
    assert.ok(s.scenarios.every((x) => x.pointMort === null && x.marge <= 0));
    assert.ok(s.alertes.some((a) => a.includes("Marge négative")));
  }
});

test("simulateur : le capital limite les ventes ; insuffisant, il est signalé", () => {
  // 150 000 − 130 000 de coûts fixes = 20 000 : de quoi acheter 4 unités à 4 300.
  const juste = simulerBusiness({ ...BASE, capital: 150000 });
  assert.equal(juste.scenarios[1].commandes, 4);
  assert.equal(juste.scenarios[1].limiteParCapital, true);
  assert.equal(juste.capitalInsuffisant, false);

  const court = simulerBusiness({ ...BASE, capital: 50000 });
  assert.equal(court.capitalInsuffisant, true);
  assert.ok(court.scenarios.every((x) => x.commandes === 0 && x.tresorerieRestante < 0));
  assert.ok(court.alertes.some((a) => a.includes("Capital insuffisant")));

  // Dropshipping : le client paie avant le fournisseur, le capital ne limite pas les ventes.
  assert.equal(simulerBusiness({ ...BASE, capital: 150000, achatAvantVente: false }).scenarios[1].commandes, 40);
});

test("simulateur : jamais d'infini ni de NaN, même avec des entrées absurdes", () => {
  const absurdes: Partial<EntreeSimulation>[] = [
    {}, { prixVente: 0 }, { coutParVisite: 0 }, { coutProduit: 0, expedition: 0 }, { capital: 0 }, { tauxConversion: 5, tauxRetour: 9 },
    { capital: NaN, prixVente: Infinity, tauxConversion: -1, coutParVisite: -3, budgetMarketing: Infinity, tauxMarge: NaN },
    { capital: 1e300, prixVente: 1e300, coutParVisite: 1e-300, panierMoyen: 0, tauxMarge: -1e9 }, { tauxRetour: 1 }, { tauxMarge: 1 },
  ];
  for (const e of absurdes) {
    const s = simulerBusiness({ ...BASE, ...e });
    assert.equal(s.scenarios.length, 3);
    assert.ok(nombres(s).every(Number.isFinite), JSON.stringify(e));
  }
});

test("score d'opportunité : pondéré, expliqué, et borné", () => {
  const parfait = scoreOpportunite({ demande: 5, concurrence: 5, risque: 5, tauxMarge: 0.5, budgetRequis: 100, budgetDisponible: 500 });
  assert.equal(parfait.total, 100);
  assert.equal(parfait.confiance, 1);
  assert.equal(parfait.criteres.reduce((s, c) => s + c.poids, 0), 100);
  assert.ok(parfait.criteres.every((c) => c.explication.length > 0));

  assert.equal(scoreOpportunite({ demande: 1, concurrence: 1, risque: 1, tauxMarge: -0.3, budgetRequis: 1000, budgetDisponible: 0 }).total, 0);
  // Un budget requis double du budget disponible : la moitié de la note du critère.
  assert.equal(scoreOpportunite({ budgetRequis: 1000, budgetDisponible: 500 }).criteres.find((c) => c.cle === "budget")!.note, 5);
  // Un critère absent ou hors barème ne compte pas : le score porte sur le reste.
  const partiel = scoreOpportunite({ demande: 5, concurrence: 9 });
  assert.equal(partiel.total, 100);
  assert.equal(partiel.confiance, 0.3);
  assert.equal(scoreOpportunite({}).total, 0);
  assert.ok(nombres(scoreOpportunite({ demande: NaN, tauxMarge: Infinity, budgetRequis: 0, budgetDisponible: Infinity })).every(Number.isFinite));
});

test("étude : chaque chiffre du modèle sort marqué estimation, avec une confiance", () => {
  const e = structurerEtude({
    resume: "Résumé",
    sections: { demande: { analyse: "Forte", points: ["a", 3], chiffres: [{ libelle: "Acheteurs", valeur: 120000, unite: "personnes" }, { libelle: "Sûr", valeur: 5, confiance: "certaine" }, { libelle: "Texte", valeur: "beaucoup" }] }, intrus: { analyse: "x" } },
  }, { volets: ["demande", "prix"], plan: false });
  assert.deepEqual(Object.keys(e.sections), ["demande", "prix"]);
  assert.equal(e.sections.demande.source, "estimation_modele");
  assert.deepEqual(e.sections.demande.points, ["a"]);
  assert.equal(e.sections.demande.chiffres.length, 2);
  assert.ok(e.sections.demande.chiffres.every((c) => c.estimation === true && c.confiance === "faible" && c.base.length > 0));
  assert.deepEqual(e.sections.prix, { source: "estimation_modele", analyse: "", points: [], chiffres: [] });
  assert.equal("opportunites_produit" in e, false);
});

test("étude : scores, marges et scénarios sont recalculés, pas repris du modèle", () => {
  const brut = {
    opportunites: [
      { nom: "Parfum A", prix_vente_estime: 10000, cout_rendu_estime: 6000, budget_requis: 400000, demande: 4, concurrence: 2, risque: 3, score: 99, confiance: "moyenne" },
      { nom: "Parfum B", prix_vente_estime: 10000, cout_rendu_estime: 4000, budget_requis: 200000, demande: 5, concurrence: 4, risque: 4 },
      { pourquoi: "sans nom" },
    ],
    repartition_budget: [{ poste: "Stock", montant: 400000 }, { poste: "Publicité", montant: 200000 }, { poste: "Faux", montant: "beaucoup" }],
    hypotheses_simulation: { prix_vente: 10000, cout_produit: 4000, expedition: 500, budget_marketing: 100000, cout_par_visite: 50, taux_conversion: 0.02, taux_retour: 3 },
  };
  // Avec plan : tous les champs sont présents (Required lève les « possibly undefined » de l'union).
  const e = structurerEtude(brut, { volets: [], plan: true, budget: 500000 }) as Required<ReturnType<typeof structurerEtude>>;
  assert.deepEqual(e.opportunites_produit.map((o) => o.nom), ["Parfum B", "Parfum A"]);
  const a = e.opportunites_produit[1];
  assert.equal(a.taux_marge_estime, 0.4);
  assert.deepEqual(a.score, scoreOpportunite({ demande: 4, concurrence: 2, risque: 3, tauxMarge: 0.4, budgetRequis: 400000, budgetDisponible: 500000 }));
  assert.ok(e.opportunites_produit.every((o) => o.estimation === true));
  assert.equal(e.opportunites_produit[0].confiance, "faible");
  assert.equal(e.repartition_budget.total, 600000);
  assert.equal(e.repartition_budget.depasse_budget, true);
  if (e.scenarios.source !== "calcul_sur_hypotheses_du_modele") throw new Error("simulation attendue");
  assert.equal(e.scenarios.mention, MENTION_PROJECTION);
  assert.equal(e.scenarios.hypotheses.taux_retour, undefined); // « 3 » n'est pas un taux : écarté
  assert.equal(e.scenarios.scenarios[1].commandes, 40);

  // Réponse inexploitable du modèle : une étude vide, jamais une exception ni un chiffre inventé.
  for (const vide of [null, "texte", [], { sections: 4, opportunites: "non" }]) {
    const v = structurerEtude(vide, { volets: ["demande"], plan: true }) as Required<ReturnType<typeof structurerEtude>>;
    assert.equal(v.opportunites_produit.length, 0);
    assert.equal(v.scenarios.source, "non_calcule");
    assert.ok(nombres(v).every(Number.isFinite));
  }
});
