// AXSO CONTROL, module commerce : segments de clients, marge, tendance et indicateurs de campagne.
// Règle testée partout : ce qui n'est pas mesuré vaut null, jamais 0 ni une estimation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { indicateursCampagne, marge, segmenter, seuilVip, variation, versionAJour, versionClient } from "@/lib/controle-ia/modules/commerce/analyse";

const J = 86_400_000;
const maintenant = new Date("2026-10-14T12:00:00Z");
const il_y_a = (jours: number) => new Date(maintenant.getTime() - jours * J);
const achats = (commandes: number, depense: number, premiere: number, derniere: number) => ({ commandes, depense, premiere: il_y_a(premiere), derniere: il_y_a(derniere) });

test("seuil VIP : 90e centile des acheteurs, aucun VIP sous 10 acheteurs", () => {
  assert.equal(seuilVip([100, 200, 300]), 0);
  assert.equal(seuilVip([0, 0, ...Array.from({ length: 10 }, (_, i) => (i + 1) * 10)]), 100);
});

test("segments : l'inactivité passe avant la valeur, puis VIP, nouveaux, fidèles, occasionnels", () => {
  assert.equal(segmenter({ commandes: 0, depense: 0, premiere: null, derniere: null }, 100, maintenant), "prospect");
  assert.equal(segmenter(achats(9, 9000, 400, 200), 100, maintenant), "lost");
  assert.equal(segmenter(achats(9, 9000, 400, 90), 100, maintenant), "at_risk");
  assert.equal(segmenter(achats(1, 500, 5, 5), 100, maintenant), "vip");
  assert.equal(segmenter(achats(1, 50, 5, 5), 100, maintenant), "new");
  assert.equal(segmenter(achats(3, 50, 100, 10), 100, maintenant), "loyal");
  assert.equal(segmenter(achats(2, 50, 100, 10), 0, maintenant), "occasional");
});

test("marge : calculée sur la seule part du CA dont le coût est connu", () => {
  assert.deepEqual(marge({ ca: 1000, caCouvert: 0, cout: 0 }), { marge: null, taux: null, couverture: 0 });
  assert.deepEqual(marge({ ca: 1000, caCouvert: 500, cout: 300 }), { marge: 200, taux: 40, couverture: 50 });
  assert.deepEqual(marge({ ca: 0, caCouvert: 0, cout: 0 }), { marge: null, taux: null, couverture: 0 });
});

test("tendance : pas de pourcentage inventé quand la période précédente est vide", () => {
  assert.equal(variation(150, 100), 50);
  assert.equal(variation(50, 100), -50);
  assert.equal(variation(150, 0), null);
});

test("campagne : ROAS seulement s'il a été remonté, rien sans dépense", () => {
  assert.deepEqual(indicateursCampagne({ depense: 0, impressions: 0, clics: 0, conversions: 0, roas: 0 }), { ctr: null, cpc: null, cpa: null, roas: null });
  assert.deepEqual(indicateursCampagne({ depense: 1000, impressions: 2000, clics: 50, conversions: 4, roas: 0 }), { ctr: 2.5, cpc: 20, cpa: 250, roas: null });
  assert.equal(indicateursCampagne({ depense: 1000, impressions: 0, clics: 0, conversions: 0, roas: 3.456 }).roas, 3.46);
});

test("verrou optimiste : même date seulement, une version illisible est périmée", () => {
  const d = new Date("2026-10-13T09:12:44.120Z");
  assert.equal(versionAJour("2026-10-13T09:12:44.120Z", d), true);
  assert.equal(versionAJour("2026-10-13T09:12:44.121Z", d), false);
  assert.equal(versionAJour("n'importe quoi", d), false);
  const c = { nom: "Awa", email: null, telephone: "+237", adresse: null, ville: "Douala", pays: null, segment: null };
  assert.equal(versionClient(c), versionClient({ ...c }));
  assert.notEqual(versionClient(c), versionClient({ ...c, ville: "Yaoundé" }));
});
