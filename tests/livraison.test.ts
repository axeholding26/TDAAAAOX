// Livraison — réglages Ma boutique : anciens formats relus (zones en noms, clés de l'inscription IA),
// comparaison des zones sans accents ni casse, ville de commande, zone couverte par un livreur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lireReglagesLivraison, livreurCouvre, trouverZone, villeCommande, zoneDeVille } from "@/lib/livraison-reglages";

test("anciens formats relus", () => {
  const r = lireReglagesLivraison({ zones: ["Akwa", " akwa ", "Bépanda", ""], locale: 1500, gratuiteA: 20000 });
  assert.deepEqual(r.zones.map((z) => z.nom), ["Akwa", "Bépanda"]);
  assert.equal(r.zones[0].frais, null);
  assert.equal(r.frais, 1500);
  assert.equal(r.minimum, 20000);
  assert.deepEqual(lireReglagesLivraison(null), { gratuite: false, frais: 0, minimum: 0, delai: "", zones: [] });
});

test("zones avec tarif, montant invalide ignoré", () => {
  const r = lireReglagesLivraison({ frais: 2000, zones: [{ nom: "Akwa", frais: 1000, delai: "24 h" }, { nom: "Deido", frais: -5 }] });
  assert.deepEqual(r.zones, [{ nom: "Akwa", frais: 1000, delai: "24 h" }, { nom: "Deido", frais: null, delai: "" }]);
  assert.equal(r.frais, 2000);
});

test("zones comparées sans accents ni casse", () => {
  const { zones } = lireReglagesLivraison({ zones: ["Bépanda"] });
  assert.equal(trouverZone(zones, "BEPANDA ")?.nom, "Bépanda");
  assert.equal(trouverZone(zones, "Akwa"), undefined);
  assert.equal(trouverZone(zones, ""), undefined);
});

test("ville de commande et zone du livreur", () => {
  assert.equal(villeCommande("Akwa", "Douala"), "Akwa, Douala");
  assert.equal(villeCommande("Akwa", "akwa"), "Akwa");
  assert.equal(villeCommande("", "Douala"), "Douala");
  assert.equal(zoneDeVille("Akwa, Douala"), "Akwa");
  assert.ok(livreurCouvre("Bonapriso, Akwa", "akwa, Douala"));
  assert.ok(!livreurCouvre("Bonapriso", "Akwa, Douala"));
  assert.ok(!livreurCouvre(null, "Akwa"));
});
