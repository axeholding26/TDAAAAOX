// Normalisation des téléphones acheteurs (suivi de commande, validation au checkout).
// Fonctions pures uniquement. Lancé par `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserTelephone } from "@/lib/devise-convert";

test("même numéro, avec ou sans indicatif, espaces ou 00", () => {
  for (const saisie of ["+237 6 99 12 34 56", "00237699123456", "237699123456", "699123456", "6-99-12-34-56"]) {
    assert.equal(normaliserTelephone(saisie, "CM"), "+237699123456", saisie);
  }
});

test("pays à 8 chiffres (BF, TG, ML, NE, DJ) acceptés", () => {
  assert.equal(normaliserTelephone("70 12 34 56", "BF"), "+22670123456");
  assert.equal(normaliserTelephone("+226 70 12 34 56", "BF"), "+22670123456");
  assert.equal(normaliserTelephone("90112345", "TG"), "+22890112345");
  assert.equal(normaliserTelephone("65012345", "ML"), "+22365012345");
  assert.equal(normaliserTelephone("93123456", "NE"), "+22793123456");
  assert.equal(normaliserTelephone("77831001", "DJ"), "+25377831001");
});

test("0 national retiré, pays déduit de l’indicatif", () => {
  assert.equal(normaliserTelephone("01 23 45 67 89", "CI"), "+225123456789");
  assert.equal(normaliserTelephone("+225 01 23 45 67 89"), "+225123456789");
  assert.equal(normaliserTelephone("0802 123 4567", "NG"), "+2348021234567");
});

test("numéro d'un autre pays reconnu par son indicatif", () => {
  assert.equal(normaliserTelephone("+221 77 123 45 67", "CM"), "+221771234567");
  assert.equal(normaliserTelephone("+33 6 12 34 56 78", "CM"), "+33612345678");
});

test("numéros invalides refusés", () => {
  assert.equal(normaliserTelephone("", "CM"), null);
  assert.equal(normaliserTelephone("1234", "CM"), null);
  assert.equal(normaliserTelephone("12345678901234", "CM"), null);
  assert.equal(normaliserTelephone("abc", null), null);
});
