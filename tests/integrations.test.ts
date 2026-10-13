// État des intégrations : une fonction n'est active que si TOUTES ses variables sont
// renseignées, et l'état ne laisse jamais sortir une valeur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { INTEGRATIONS, etatIntegrations, integrationActive } from "@/lib/integrations";

test("intégration active seulement si toutes ses variables sont renseignées", () => {
  const avant = { u: process.env.AFRICASTALKING_USERNAME, k: process.env.AFRICASTALKING_KEY };
  try {
    delete process.env.AFRICASTALKING_USERNAME; delete process.env.AFRICASTALKING_KEY;
    assert.equal(integrationActive("sms"), false);
    process.env.AFRICASTALKING_KEY = "cle-secrete-de-test";
    assert.equal(integrationActive("sms"), false, "une seule variable sur deux ne suffit pas");
    process.env.AFRICASTALKING_USERNAME = "   ";
    assert.equal(integrationActive("sms"), false, "une valeur vide ne compte pas");
    process.env.AFRICASTALKING_USERNAME = "axso";
    assert.equal(integrationActive("sms"), true);
    assert.equal(integrationActive("inconnue"), false);
    assert.ok(!JSON.stringify(etatIntegrations()).includes("cle-secrete-de-test"), "une valeur a fuité dans l'état");
  } finally {
    for (const [nom, v] of [["AFRICASTALKING_USERNAME", avant.u], ["AFRICASTALKING_KEY", avant.k]] as const) { if (v === undefined) delete process.env[nom]; else process.env[nom] = v; }
  }
});

test("chaque variable n'est déclarée qu'une fois, sous une clé unique", () => {
  const variables = INTEGRATIONS.flatMap((i) => i.variables);
  assert.equal(new Set(variables).size, variables.length);
  assert.equal(new Set(INTEGRATIONS.map((i) => i.cle)).size, INTEGRATIONS.length);
});
