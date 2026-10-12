// Calculs d'argent de la caisse : panier, remises, taxes, paiements, conflits hors ligne.
// Fonctions pures uniquement (aucune base de données). Lancé par `npm test`, avant chaque build.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOUS_DROITS } from "@/lib/pos/droits";
import { arrondir, calculerPanier, montantBrut, montantRemise, type OptionsPanier } from "@/lib/pos/tarification";
import { repartirPaiements } from "@/lib/pos/paiements";
import { detecterConflits, plafonnerPaiements, type EntreeConflits } from "@/lib/pos/hors-ligne/conflits";
import { actionsPossibles, statutApresReception } from "@/lib/pos/operations/transferts";
import type { LignePanier } from "@/lib/pos/types";

const ligne = (prixUnitaire: number, quantite = 1, plus: Partial<LignePanier> = {}): LignePanier => ({ produitId: "p", nom: "Article", prixUnitaire, quantite, ...plus });
const caissier = { ...TOUS_DROITS, remise: true, remise_hors_plafond: false, prix_personnalise: false, produit_offert: false };
const options = (plus: Partial<OptionsPanier> = {}): OptionsPanier => ({ tauxTVA: 0, droits: caissier, devise: "XAF", plafondRemisePct: 10, ...plus });
const codes = (p: { alertes: { code: string; bloquant: boolean }[] }) => p.alertes.filter((a) => a.bloquant).map((a) => a.code);

test("arrondi : pas de centime perdu par les flottants", () => {
  assert.equal(arrondir(1.005, 2), 1.01);
  assert.equal(arrondir(1499.5), 1500);
});

test("produit au poids : grammes × prix au kilo", () => {
  assert.equal(montantBrut(2000, 750, "kg"), 1500);
  assert.equal(calculerPanier([ligne(2000, 750, { uniteVente: "kg" })], options()).total, 1500);
});

test("une remise ne dépasse jamais sa base", () => {
  assert.equal(montantRemise({ type: "montant", valeur: 5000 }, 1000), 1000);
  assert.equal(montantRemise({ type: "pourcentage", valeur: 250 }, 1000), 1000);
  assert.equal(montantRemise({ type: "montant", valeur: -50 }, 1000), 0);
});

test("panier simple : le total est la somme des lignes", () => {
  const p = calculerPanier([ligne(1000, 2), ligne(500)], options());
  assert.equal(p.sousTotal, 2500);
  assert.equal(p.total, 2500);
  assert.deepEqual(p.alertes, []);
});

test("TVA incluse dans le prix : HT + taxe = prix affiché", () => {
  const p = calculerPanier([ligne(11925)], options({ tauxTVA: 0.1925, prixTTC: true }));
  assert.equal(p.total, 11925);
  assert.equal(p.totalHT + p.montantTaxes, 11925);
  assert.equal(p.totalHT, 10000);
});

test("TVA en sus : elle s'ajoute au prix", () => {
  assert.equal(calculerPanier([ligne(1000)], options({ tauxTVA: 0.2, prixTTC: false })).total, 1200);
});

test("remise globale répartie : la somme des lignes reste égale au total", () => {
  const p = calculerPanier([ligne(333), ligne(333), ligne(333)], options({ remise: { type: "montant", valeur: 99 } }));
  assert.equal(p.total, 900);
  assert.equal(p.lignes.reduce((s, l) => s + l.total, 0), p.total);
});

test("remise dans le plafond : acceptée", () => {
  const p = calculerPanier([ligne(1000, 1, { remise: { type: "pourcentage", valeur: 10 } })], options());
  assert.equal(p.total, 900);
  assert.deepEqual(codes(p), []);
});

test("remise sans le droit « remise » : refusée", () => {
  const p = calculerPanier([ligne(1000, 1, { remise: { type: "pourcentage", valeur: 5 } })], options({ droits: { ...caissier, remise: false } }));
  assert.deepEqual(codes(p), ["remise_non_autorisee"]);
});

test("remise au-dessus du plafond : refusée sans le droit « hors plafond », acceptée avec", () => {
  const lignes = [ligne(1000, 1, { remise: { type: "pourcentage", valeur: 20 } })];
  assert.deepEqual(codes(calculerPanier(lignes, options())), ["remise_hors_plafond"]);
  assert.deepEqual(codes(calculerPanier(lignes, options({ droits: { ...caissier, remise_hors_plafond: true } }))), []);
});

test("remises cumulées (ligne + panier) : jugées ensemble contre le plafond", () => {
  const dix = { type: "pourcentage" as const, valeur: 10 };
  const cinq = { type: "pourcentage" as const, valeur: 5 };
  assert.deepEqual(codes(calculerPanier([ligne(1000, 1, { remise: dix })], options({ remise: dix }))), ["remise_hors_plafond"]);
  assert.deepEqual(codes(calculerPanier([ligne(1000, 1, { remise: cinq })], options({ remise: cinq }))), []);
});

test("produit offert et prix modifié : exigent leur droit", () => {
  const offert = calculerPanier([ligne(1000, 1, { offert: true })], options());
  assert.equal(offert.total, 0);
  assert.deepEqual(codes(offert), ["offert_non_autorise"]);
  assert.deepEqual(codes(calculerPanier([ligne(1000, 1, { prixPersonnalise: 1 })], options())), ["prix_non_autorise"]);
  assert.deepEqual(codes(calculerPanier([ligne(1000, 1, { prixPersonnalise: 800 })], options({ droits: { ...caissier, prix_personnalise: true } }))), []);
});

test("quantité nulle ou décimale : refusée", () => {
  assert.deepEqual(codes(calculerPanier([ligne(1000, 0)], options())), ["quantite_invalide"]);
  assert.deepEqual(codes(calculerPanier([ligne(1000, 1.5)], options())), ["quantite_invalide"]);
});

test("code promo : appliqué après la remise, jamais au-delà du total", () => {
  const p = calculerPanier([ligne(1000)], options({ codePromo: { type: "montant", valeur: 5000 } }));
  assert.equal(p.total, 0);
  assert.equal(p.remiseCodePromo, 1000);
});

test("paiement mixte : Mobile Money + carte + espèces soldent la vente", () => {
  const r = repartirPaiements(47500, [{ mode: "especes", montant: 10000 }, { mode: "mobile_money", montant: 25000 }, { mode: "carte", montant: 12500 }]);
  assert.deepEqual([r.paye, r.reste, r.monnaie, r.credit], [47500, 0, 0, 0]);
});

test("espèces : l'excédent est rendu, il n'est pas encaissé", () => {
  const r = repartirPaiements(7200, [{ mode: "especes", montant: 10000 }]);
  assert.deepEqual([r.paye, r.monnaie, r.reste], [7200, 2800, 0]);
});

test("Mobile Money au-dessus du reste à payer : refusé (aucune monnaie possible)", () => {
  assert.throws(() => repartirPaiements(5000, [{ mode: "mobile_money", montant: 6000 }]), /dépasse/);
});

test("paiement partiel et crédit : le reste dû et la part à crédit sont exacts", () => {
  assert.equal(repartirPaiements(10000, [{ mode: "especes", montant: 4000 }]).reste, 6000);
  const r = repartirPaiements(10000, [{ mode: "especes", montant: 4000 }, { mode: "credit", montant: 6000 }]);
  assert.deepEqual([r.paye, r.credit, r.reste], [4000, 6000, 0]);
});

test("montant de paiement nul ou négatif : refusé", () => {
  assert.throws(() => repartirPaiements(5000, [{ mode: "especes", montant: 0 }]));
  assert.throws(() => repartirPaiements(5000, [{ mode: "carte", montant: -100 }]));
});

test("hors ligne : un paiement sans monnaie est ramené au total, les espèces non", () => {
  assert.deepEqual(plafonnerPaiements([{ mode: "mobile_money", montant: 30000 }], 25000), [{ mode: "mobile_money", montant: 25000 }]);
  assert.deepEqual(plafonnerPaiements([{ mode: "especes", montant: 30000 }], 25000), [{ mode: "especes", montant: 30000 }]);
});

const conflit = (plus: Partial<EntreeConflits> = {}): EntreeConflits => ({
  numero: "AX1", numeroLocal: "L1", totalServeur: 1000, totalLocal: 1000, sessionLocale: "s", sessionServeur: "s", especes: 1000, remiseSync: 0,
  lignes: [{ nom: "Article", prixEncaisse: 1000, prixCatalogue: null, parCaissier: false }], stocks: [{ nom: "Article", apres: 3 }], venteSansStock: false, fmt: String, ...plus,
});

test("synchronisation : une vente sans écart ne signale rien", () => {
  assert.deepEqual(detecterConflits(conflit()), []);
});

test("synchronisation : survente, prix changé et total différent sont signalés", () => {
  const types = (e: EntreeConflits) => detecterConflits(e).map((c) => c.type);
  assert.deepEqual(types(conflit({ stocks: [{ nom: "Article", apres: -2 }] })), ["survente"]);
  assert.deepEqual(types(conflit({ stocks: [{ nom: "Article", apres: -2 }], venteSansStock: true })), []);
  assert.deepEqual(types(conflit({ lignes: [{ nom: "Article", prixEncaisse: 1000, prixCatalogue: 1200, parCaissier: false }] })), ["prix"]);
  assert.deepEqual(types(conflit({ lignes: [{ nom: "Article", prixEncaisse: 1000, prixCatalogue: 1200, parCaissier: true }] })), []);
  assert.deepEqual(types(conflit({ totalServeur: 900 })), ["total"]);
});

test("transferts : statut après réception et actions permises selon les droits", () => {
  assert.equal(statutApresReception([{ quantiteExpediee: 5, quantiteRecue: 5 }]), "recu");
  assert.equal(statutApresReception([{ quantiteExpediee: 5, quantiteRecue: 3 }]), "partiellement_recu");
  assert.ok(actionsPossibles("expedie", TOUS_DROITS).includes("recevoir"));
  assert.ok(!actionsPossibles("expedie", { ...TOUS_DROITS, transfert_recevoir: false }).includes("recevoir"));
  assert.deepEqual(actionsPossibles("recu", TOUS_DROITS), []);
});
