// « Signaler un problème » : validation, limite par heure, page et capture acceptées.
import { test } from "node:test";
import assert from "node:assert/strict";
import { schemaSignalement, schemaTraitement, limiteAtteinte, LIMITE_PAR_HEURE, captureValide, pageNormalisee, sujetDe } from "@/lib/signalements";

test("description obligatoire et bornée", () => {
  assert.equal(schemaSignalement.safeParse({ description: "court" }).success, false);
  assert.equal(schemaSignalement.safeParse({ description: "x".repeat(4001) }).success, false);
  const ok = schemaSignalement.parse({ description: "  Le bouton Enregistrer ne marche pas  ", erreur: "" });
  assert.equal(ok.description, "Le bouton Enregistrer ne marche pas");
  assert.equal(ok.erreur, null);
  assert.equal(ok.page, "");
});

test("limite de signalements par heure", () => {
  assert.equal(limiteAtteinte(LIMITE_PAR_HEURE - 1), false);
  assert.equal(limiteAtteinte(LIMITE_PAR_HEURE), true);
});

test("capture : stockage Axso ou petite image seulement", () => {
  assert.ok(captureValide("https://abc.public.blob.vercel-storage.com/imports/x.png"));
  assert.ok(captureValide("data:image/png;base64,iVBORw0KGgo="));
  assert.equal(captureValide("https://espion.example/pixel.gif"), false);
  assert.equal(captureValide("http://abc.public.blob.vercel-storage.com/x.png"), false);
  assert.equal(captureValide("data:text/html;base64,PHNjcmlwdD4="), false);
  assert.equal(captureValide("data:image/png;base64," + "A".repeat(3_000_000)), false);
  assert.equal(schemaSignalement.safeParse({ description: "Un problème réel ici", capture: "javascript:alert(1)" }).success, false);
});

test("page : chemin du tableau de bord seulement", () => {
  assert.equal(pageNormalisee("/dashboard/builder?onglet=pages"), "/dashboard/builder?onglet=pages");
  assert.equal(pageNormalisee("https://autre.site/dashboard/x"), "/dashboard/x");
  assert.equal(pageNormalisee("/admin"), "");
  assert.equal(pageNormalisee("//evil.com/x"), "");
  assert.equal(sujetDe("/dashboard/produits/12"), "produits");
  assert.equal(sujetDe("/dashboard"), "accueil");
});

test("traitement admin : statut connu", () => {
  assert.ok(schemaTraitement.safeParse({ statut: "resolu", reponse: "Corrigé" }).success);
  assert.equal(schemaTraitement.safeParse({ statut: "ferme" }).success, false);
});
