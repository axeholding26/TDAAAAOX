// Moyens de paiement selon le pays : réglages par défaut, jamais aucun moyen, paiement à la livraison
// réservé au pays de la boutique, paiement en ligne seulement si la devise est couverte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lireReglagesPaiement, moyensEnLigne, moyensPhysique, paiementEnLigneDisponible } from "@/lib/paiement-pays";
import { operateurCameroun, telCameroun } from "@/lib/wallet";
import { deviseAbonnement } from "@/lib/abonnement-paiement";

test("réglages par défaut et jamais aucun moyen", () => {
  assert.deepEqual(lireReglagesPaiement(null), { livraison: true, whatsapp: true, enLigne: false, livraisonHorsPays: false });
  assert.equal(lireReglagesPaiement({ livraison: false, whatsapp: false, enLigne: false }).livraison, true);
  assert.equal(lireReglagesPaiement({ livraison: false, whatsapp: false, enLigne: true }).livraison, false);
});

test("paiement à la livraison réservé au pays de la boutique", () => {
  const r = lireReglagesPaiement({ enLigne: true });
  assert.deepEqual(moyensPhysique(r, { paysClient: "CM", paysBoutique: "CM", enLigneDispo: true }), { livraison: true, whatsapp: true, enLigne: true });
  assert.deepEqual(moyensPhysique(r, { paysClient: "GA", paysBoutique: "CM", enLigneDispo: true }), { livraison: false, whatsapp: false, enLigne: true });
  assert.deepEqual(moyensPhysique(r, { paysClient: "GA", paysBoutique: "CM", enLigneDispo: false }), { livraison: false, whatsapp: false, enLigne: false });
  const horsPays = lireReglagesPaiement({ livraisonHorsPays: true });
  assert.equal(moyensPhysique(horsPays, { paysClient: "GA", paysBoutique: "CM", enLigneDispo: false }).livraison, true);
});

test("devises en ligne et moyens affichés", () => {
  assert.ok(paiementEnLigneDisponible("xaf"));
  assert.ok(!paiementEnLigneDisponible("NGN"));
  assert.ok(!paiementEnLigneDisponible(null));
  assert.equal(moyensEnLigne("CM"), "MTN MoMo, Orange Money ou carte bancaire");
  assert.equal(moyensEnLigne("KE"), "Mobile Money ou carte bancaire");
});

test("opérateur camerounais et devise d'abonnement", () => {
  assert.equal(operateurCameroun(telCameroun("677 12 34 56")), "mtn");
  assert.equal(operateurCameroun(telCameroun("+237 652123456")), "mtn");
  assert.equal(operateurCameroun(telCameroun("699123456")), "orange");
  assert.equal(operateurCameroun(telCameroun("656123456")), "orange");
  assert.equal(operateurCameroun(telCameroun("681234567")), null); // préfixe incertain : versement à la main
  assert.equal(operateurCameroun(telCameroun("+221 77 123 45 67")), null);
  assert.equal(deviseAbonnement("XOF"), "XOF");
  assert.equal(deviseAbonnement("NGN"), "XAF");
});
