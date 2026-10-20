// Répartition d'un paiement en ligne : le vendeur touche son prix et sa livraison en entier.
import { test } from "node:test";
import assert from "node:assert/strict";
import { partVendeur, prixClient } from "../lib/pricing";

test("dropshipping : la commission ne porte pas sur la livraison", () => {
  const brut = prixClient(10_000, 0.1, "dropshipping") + 2_000; // 11 000 + 2 000
  assert.deepEqual(partVendeur(brut, 2_000, 0.1, "XAF"), { montantNet: 12_000, montantCommission: 1_000 });
});

test("FCFA : jamais de centimes dans le portefeuille", () => {
  const r = partVendeur(prixClient(999, 0.1, "digital"), 0, 0.13, "XAF");
  assert.equal(Number.isInteger(r.montantNet) && Number.isInteger(r.montantCommission), true);
  assert.equal(r.montantNet + r.montantCommission, 1_129);
});

test("monnaie à centimes : arrondi au centime, total conservé", () => {
  const r = partVendeur(11, 0, 0.1, "EUR");
  assert.deepEqual(r, { montantNet: 10, montantCommission: 1 });
});
