// Abonnements, signatures et droits d'équipe. Fonctions pures uniquement.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { expirationApresPaiement } from "@/lib/abonnement";
import { verifierSignatureWebhook } from "@/lib/notchpay";
import { grilleCouverte, ROLE_PRESETS, TOUT_ECRITURE } from "@/lib/permissions";

const JOUR = 24 * 3600 * 1000;

test("abonnement : un renouvellement du même palier garde les jours restants", () => {
  const now = new Date("2026-10-13T00:00:00Z");
  const fin = new Date(now.getTime() + 10 * JOUR);
  assert.equal(expirationApresPaiement({ planType: "palier2", planExpiresAt: fin }, "palier2", 30, now).getTime(), now.getTime() + 40 * JOUR);
  // palier différent ou expiré : repart d'aujourd'hui
  assert.equal(expirationApresPaiement({ planType: "palier1", planExpiresAt: fin }, "palier2", 30, now).getTime(), now.getTime() + 30 * JOUR);
  assert.equal(expirationApresPaiement({ planType: "palier2", planExpiresAt: new Date(now.getTime() - JOUR) }, "palier2", 30, now).getTime(), now.getTime() + 30 * JOUR);
  assert.equal(expirationApresPaiement({ planType: "palier2", planExpiresAt: null }, "palier2", 30, now).getTime(), now.getTime() + 30 * JOUR);
});

test("webhook NotchPay : seule la signature HMAC du corps exact passe", () => {
  process.env.NOTCHPAY_WEBHOOK_SECRET = "secret-test";
  const corps = JSON.stringify({ type: "payment.complete", data: { amount: 6000 } });
  const sig = crypto.createHmac("sha256", "secret-test").update(corps).digest("hex");
  assert.equal(verifierSignatureWebhook(corps, sig), true);
  assert.equal(verifierSignatureWebhook(corps.replace("6000", "9000"), sig), false);
  assert.equal(verifierSignatureWebhook(corps, null), false);
  assert.equal(verifierSignatureWebhook(corps, "abc"), false);
  delete process.env.NOTCHPAY_WEBHOOK_SECRET;
  assert.equal(verifierSignatureWebhook(corps, sig), false); // sans secret, rien ne passe
});

test("équipe : un membre ne donne jamais plus que ses propres droits", () => {
  const gerant = ROLE_PRESETS.gerant;
  assert.equal(grilleCouverte(ROLE_PRESETS.caissier, gerant), true);
  assert.equal(grilleCouverte(TOUT_ECRITURE, gerant), false); // gérant n'a pas l'équipe ni la finance en écriture
  assert.equal(grilleCouverte(ROLE_PRESETS.comptable, gerant), false);
  assert.equal(grilleCouverte(TOUT_ECRITURE, TOUT_ECRITURE), true); // le propriétaire peut tout déléguer
});
