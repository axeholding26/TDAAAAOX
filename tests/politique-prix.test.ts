// Politique de prix (lib/pricing.ts) : numérique +13 %, physique en ligne +10 %, à la livraison 0 %,
// et le vendeur reçoit toujours exactement son prix, même dans une commande mixte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { partVendeur, prixClient, tauxCommande } from "@/lib/pricing";

test("prix payé par le client selon le type", () => {
  assert.equal(prixClient(10000, 0.1, "fichier"), 11300);
  assert.equal(prixClient(10000, 0.1, "formation"), 11300);
  assert.equal(prixClient(10000, 0.1, "en_ligne"), 11000);
  assert.equal(prixClient(10000, 0.1, "dropshipping"), 11000);
  assert.equal(prixClient(10000, 0.1, "physique"), 10000);
});

test("le vendeur reçoit son prix, livraison en entier, même dans une commande mixte", () => {
  const lignes = [{ prix: prixClient(10000, 0.1, "fichier"), quantite: 1, type: "fichier" }, { prix: prixClient(5000, 0.1, "dropshipping"), quantite: 2, type: "dropshipping" }];
  const taux = tauxCommande(lignes, 0.1);
  const brut = 11300 + 2 * 5500 + 1500; // + livraison non majorée
  const { montantNet, montantCommission } = partVendeur(brut, 1500, taux, "XAF");
  assert.equal(montantNet, 10000 + 2 * 5000 + 1500);
  assert.equal(montantCommission, 1300 + 1000);
  assert.ok(Math.abs(tauxCommande([{ prix: 11300, quantite: 1, type: "licence" }], 0.1) - 0.13) < 1e-9);
});
