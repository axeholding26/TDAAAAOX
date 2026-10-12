// Calculs d'argent de Sourcing et des paiements en ligne : devises, prix conseillé,
// coût réel, contrôle du montant payé, paliers. Fonctions pures uniquement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserDevise, schemaDevise, tauxEntre } from "@/lib/sourcing/cout-rendu";
import { calculerCoutReel, prixPsychologique, recommanderPrix } from "@/lib/sourcing/rentabilite";
import { MOTIFS_ANNULATION, MOTIFS_IMPUTABLES_FOURNISSEUR } from "@/lib/sourcing/statuts";
import { paiementCouvre } from "@/lib/notchpay";
import { aAcces, palierAuMoins, type Palier } from "@/lib/plans";
import { prixClient } from "@/lib/pricing";

test("devises : les écritures courantes sont reconnues, l'inconnu est refusé", () => {
  assert.equal(normaliserDevise("RMB"), "CNY");
  assert.equal(normaliserDevise(" $ "), "USD");
  assert.equal(normaliserDevise("fcfa"), "XAF");
  assert.equal(normaliserDevise("ZZZ"), null);
  assert.equal(normaliserDevise(42), null);
  assert.equal(schemaDevise.parse("rmb"), "CNY");
  assert.equal(schemaDevise.safeParse("ZZZ").success, false);
});

test("taux de change : conversion par la table, jamais inversée", () => {
  const table = { XAF: 1, USD: 0.0016 };
  assert.equal(tauxEntre("XAF", "XAF", table), 1);
  assert.equal(Math.round(tauxEntre("USD", "XAF", table)), 625);
  assert.equal(Math.round(tauxEntre("$", "FCFA", table)), 625);
  assert.equal(tauxEntre("USD", "XAF", 600), 600);
});

test("palier psychologique : toujours au-dessus du prix calculé", () => {
  assert.equal(prixPsychologique(14167, "XAF"), 14900);
  assert.equal(prixPsychologique(8500, "XAF"), 8900);
  assert.equal(prixPsychologique(137, "GHS"), 139);
  for (const prix of [990, 4999, 9900, 19901, 123456]) assert.ok(prixPsychologique(prix, "XAF") >= prix, `palier sous le prix pour ${prix}`);
});

test("prix conseillé : l'exemple de référence (coût 8 500, marge 40 %) donne 14 900", () => {
  assert.equal(recommanderPrix({ mode: "auto", coutHorsPaiement: 8500, devise: "XAF" }).prix, 14900);
  assert.equal(recommanderPrix({ mode: "marge_fixe", coutHorsPaiement: 8500, devise: "XAF", margeFixe: 6400 }).prix, 14900);
  assert.equal(recommanderPrix({ mode: "marge_pct", coutHorsPaiement: 6000, devise: "XAF", margePct: 0.4 }).prix, 10000);
});

test("prix conseillé : les frais de paiement sont couverts par le prix", () => {
  const { prix } = recommanderPrix({ mode: "marge_fixe", coutHorsPaiement: 9000, devise: "XAF", margeFixe: 1000, tauxFraisPaiement: 0.02 });
  assert.ok(prix * 0.98 - 9000 >= 999, "le bénéfice voulu n'est pas atteint après frais");
});

test("prix conseillé : une marge impossible est ramenée, jamais de prix négatif ou infini", () => {
  const r = recommanderPrix({ mode: "marge_pct", coutHorsPaiement: 8500, devise: "XAF", margePct: 0.9, tauxFraisPaiement: 0.15 });
  assert.ok(Number.isFinite(r.prix) && r.prix > 8500);
  assert.ok(r.explication.some((l) => l.includes("ramenée")));
});

test("coût réel : le risque de refus à la livraison augmente le coût par commande", () => {
  const base = { prixUnitaire: 3000, deviseFournisseur: "XAF", quantite: 1, pays: "CM" as const, deviseCible: "XAF", transportInternational: 1500, tauxDroits: 0, livraisonLocale: 1500, coutPubParCommande: 2000, tauxRetour: 0, prixVente: 14900 };
  const sans = calculerCoutReel({ ...base, tauxRefus: 0 });
  const avec = calculerCoutReel({ ...base, tauxRefus: 0.25 });
  assert.ok(avec.coutTotal > sans.coutTotal);
  assert.ok((avec.margeNette ?? 0) < (sans.margeNette ?? 0));
  assert.ok(sans.coutTotal >= 3000 + 1500 + 1500 + 2000);
});

test("paiement en ligne : confirmé seulement si abouti, au bon montant et dans la bonne devise", () => {
  assert.equal(paiementCouvre({ status: "complete", amount: 5000, currency: "XAF" }, 5000, "XAF"), true);
  assert.equal(paiementCouvre({ status: "complete", amount: "5000", currency: "xaf" }, 5000, "XAF"), true);
  assert.equal(paiementCouvre({ status: "complete", amount: 100, currency: "XAF" }, 5000, "XAF"), false);
  assert.equal(paiementCouvre({ status: "complete", amount: 5000, currency: "NGN" }, 5000, "XAF"), false);
  assert.equal(paiementCouvre({ status: "pending", amount: 5000, currency: "XAF" }, 5000, "XAF"), false);
  assert.equal(paiementCouvre(null, 5000, "XAF"), false);
  assert.equal(paiementCouvre({ status: "complete", currency: "XAF" }, 5000, "XAF"), false);
});

test("paliers : Sourcing réservé au palier 2, une valeur héritée vaut palier 0", () => {
  assert.equal(aAcces("palier0", "sourcing_mondial"), false);
  assert.equal(aAcces("palier1", "sourcing_mondial"), false);
  assert.equal(aAcces("palier2", "sourcing_mondial"), true);
  assert.equal(aAcces("gratuit" as Palier, "sourcing_mondial"), false);
  assert.equal(palierAuMoins("premium" as Palier, "palier1"), false);
});

test("annulation fournisseur : seul un motif imputable au fournisseur compte contre lui", () => {
  assert.deepEqual([...MOTIFS_IMPUTABLES_FOURNISSEUR].sort(), ["retard", "rupture", "sans_reponse"]);
  for (const m of MOTIFS_IMPUTABLES_FOURNISSEUR) assert.ok(m in MOTIFS_ANNULATION);
  assert.ok(!MOTIFS_IMPUTABLES_FOURNISSEUR.includes("client") && !MOTIFS_IMPUTABLES_FOURNISSEUR.includes("marchand"));
});

test("commission Axso : 10 % ajoutés au prix payé en ligne, rien sur un produit payé à la livraison", () => {
  assert.equal(prixClient(10000, 0.1, "digital"), 11000);
  assert.equal(prixClient(10000, 0.1, "physique"), 10000);
  assert.equal(prixClient(999, 0.1, "digital"), 1099);
});
