// Essai de 7 jours du plan Illimité (lib/essai-regles.ts) : un seul par compte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculerEssai, finEssaiDepuis, rappelDu, tempsRestant } from "@/lib/essai-regles";

const T0 = new Date("2026-10-21T10:00:00Z");
const h = (n: number) => new Date(T0.getTime() + n * 3600_000);

test("jamais démarré : proposé au compte gratuit, pas à un compte payant", () => {
  assert.deepEqual(calculerEssai([{}], "palier0", T0), { phase: "disponible", finLe: null, proposer: true, montrerFin: false });
  assert.equal(calculerEssai([{}], "palier1", T0).proposer, false);
});

test("refusé : plus proposé à l'arrivée, mais encore disponible (démarrable depuis Abonnement)", () => {
  const e = calculerEssai([{ essaiStatut: "refuse" }], "palier0", T0);
  assert.equal(e.phase, "disponible");
  assert.equal(e.proposer, false);
});

test("démarré : 7 jours pile, puis terminé — et plus jamais disponible", () => {
  const fin = finEssaiDepuis(T0);
  assert.equal(fin.getTime() - T0.getTime(), 7 * 24 * 3600_000);
  const b = [{ essaiStatut: "accepte", essaiFinLe: fin }];
  assert.equal(calculerEssai(b, "palier0", h(1)).phase, "en_cours");
  const apres = calculerEssai(b, "palier0", h(7 * 24 + 1));
  assert.equal(apres.phase, "termine");
  assert.equal(apres.proposer, false);
  assert.equal(apres.montrerFin, true);
});

test("un essai utilisé sur une boutique vaut pour tout le compte", () => {
  const e = calculerEssai([{}, { essaiStatut: "accepte", essaiFinLe: h(-1) }], "palier0", T0);
  assert.equal(e.phase, "termine");
  assert.equal(e.proposer, false);
});

test("fin d'essai : fenêtre une seule fois, et pas si le compte a payé", () => {
  assert.equal(calculerEssai([{ essaiStatut: "fin_vue", essaiFinLe: h(-1) }], "palier0", T0).montrerFin, false);
  assert.equal(calculerEssai([{ essaiStatut: "accepte", essaiFinLe: h(-1) }], "palier2", T0).montrerFin, false);
});

test("rappels : 48 h avant la fin puis à la fin, une fois chacun", () => {
  assert.equal(rappelDu(h(72), null, T0), null);
  assert.equal(rappelDu(h(47), null, T0), "j2");
  assert.equal(rappelDu(h(47), "j2", T0), null);
  assert.equal(rappelDu(h(-1), "j2", T0), "fin");
  assert.equal(rappelDu(h(-1), null, T0), "fin");
  assert.equal(rappelDu(h(-1), "fin", T0), null);
});

test("compte à rebours lisible", () => {
  assert.equal(tempsRestant(h(7 * 24), T0), "7 j 0 h");
  assert.equal(tempsRestant(h(5.5), T0), "5 h 30 min");
  assert.equal(tempsRestant(h(-2), T0), "0 min");
});
