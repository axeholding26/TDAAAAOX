// AXSO CONTROL : une IA externe n'a jamais plus de droits que ce qui lui a été accordé,
// ni que le compte qui l'a autorisée ; les actions à risque attendent l'accord du marchand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ROLE_PRESETS, TOUT_ECRITURE } from "@/lib/permissions";
import { SCOPES, SCOPES_FINS, creerClientId, dansLimite, decider, fournisseurDuClient, grilleDesScopes, intersecter, lireClientId, pkceValide, prixHorsLimite, redirectionAcceptable, risqueOutil, scopeFinAxia } from "@/lib/controle-ia/regles";

process.env.AUTH_SECRET ||= "secret-de-test";

test("les scopes n'ouvrent que les modules demandés ; un scope inconnu n'ouvre rien", () => {
  const g = grilleDesScopes(["axso:products:write", "axso:finance:read", "axso:equipe:write", "admin", "autre:products:write"]);
  assert.equal(g.produits, "ecriture");
  assert.equal(g.finance, "lecture");
  assert.equal(g.commandes, "aucun");
  assert.equal(g.equipe, "aucun");
  assert.equal(g.parametres, "aucun");
  assert.equal(Object.values(grilleDesScopes([])).every((n) => n === "aucun"), true);
});

test("pas d'escalade : tous les scopes + compte caissier = droits du caissier", () => {
  const g = intersecter(grilleDesScopes(SCOPES), ROLE_PRESETS.caissier);
  assert.equal(g.produits, "lecture");
  assert.equal(g.finance, "aucun");
  assert.equal(g.marketing, "aucun");
  // et un propriétaire ne donne que ce qu'il a coché
  assert.equal(intersecter(grilleDesScopes(["axso:orders:read"]), TOUT_ECRITURE).commandes, "lecture");
  assert.equal(intersecter(grilleDesScopes(["axso:orders:read"]), TOUT_ECRITURE).produits, "aucun");
});

test("décision selon le mode", () => {
  for (const mode of ["assistant", "copilot", "autopilot"] as const) {
    assert.equal(decider(mode, "faible", false), "executer", "une lecture ne demande jamais d'accord");
    assert.equal(decider(mode, "eleve", true), "accord", "le risque élevé demande toujours un accord");
  }
  assert.equal(decider("assistant", "faible", true), "accord");
  assert.equal(decider("copilot", "faible", true), "executer");
  assert.equal(decider("copilot", "moyen", true), "accord");
  assert.equal(decider("autopilot", "moyen", true), "executer");
});

test("risque des outils et limite de prix", () => {
  assert.equal(risqueOutil("payer_commission_affilie", true), "eleve");
  assert.equal(risqueOutil("mettre_a_jour_prix", true), "moyen");
  assert.equal(risqueOutil("ajouter_produit", false), "faible");
  assert.equal(prixHorsLimite(10_000, 11_500, 15), false);
  assert.equal(prixHorsLimite(10_000, 11_800, 15), true);
  assert.equal(prixHorsLimite(10_000, 8_000, 15), true);
  assert.equal(prixHorsLimite(0, 500, 15), true);
});

test("PKCE", () => {
  const verifier = "a".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  assert.equal(pkceValide(verifier, challenge), true);
  assert.equal(pkceValide("b".repeat(43), challenge), false);
  assert.equal(pkceValide("court", challenge), false);
});

test("client OAuth : identifiant signé, adresses de retour sûres", () => {
  assert.equal(redirectionAcceptable("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(redirectionAcceptable("http://localhost:4321/callback"), true);
  assert.equal(redirectionAcceptable("http://pirate.example/callback"), false);
  assert.equal(redirectionAcceptable("javascript:alert(1)"), false);
  assert.equal(creerClientId("X", ["http://pirate.example/cb"]), null);
  assert.equal(creerClientId("X", []), null);

  const id = creerClientId("Claude <script>", ["https://claude.ai/api/mcp/auth_callback"])!;
  assert.deepEqual(lireClientId(id), { nom: "Claude script", redirectUris: ["https://claude.ai/api/mcp/auth_callback"] });
  // adresse de retour changée après coup : la signature ne correspond plus
  const faux = Buffer.from(JSON.stringify({ nom: "Claude", redirectUris: ["https://pirate.example/cb"] })).toString("base64url");
  assert.equal(lireClientId(`${faux}.${id.split(".")[1]}`), null);
  assert.equal(lireClientId("n-importe-quoi"), null);
});

test("droits fins : jamais ouverts par un simple « modifier »", () => {
  // les droits fins ne donnent accès à aucun module à eux seuls
  assert.equal(Object.values(grilleDesScopes(Object.keys(SCOPES_FINS))).every((n) => n === "aucun"), true);
  assert.equal(scopeFinAxia("payer_commission_affilie"), "axso:payments:write");
  assert.equal(scopeFinAxia("generer_video"), "axso:creative:write");
  assert.equal(scopeFinAxia("lister_produits"), undefined);
});

test("autopilote : un montant ne passe seul que sous la limite fixée", () => {
  const limites = { budgetPubMax: 75_000, transactionMax: 0 };
  assert.equal(dansLimite({ type: "pub", valeur: 50_000 }, limites), true);
  assert.equal(dansLimite({ type: "pub", valeur: 75_001 }, limites), false);
  assert.equal(dansLimite({ type: "transaction", valeur: 1 }, limites), false, "limite à 0 = toujours avec accord");
  assert.equal(dansLimite(null, limites), false, "montant inconnu = accord");
  assert.equal(dansLimite({ type: "pub", valeur: NaN }, limites), false);
  assert.equal(dansLimite({ type: "pub", valeur: -5 }, limites), false);
});

test("fournisseur d'IA reconnu", () => {
  assert.equal(fournisseurDuClient("Claude", "https://claude.ai/api/mcp/auth_callback"), "claude");
  assert.equal(fournisseurDuClient("App", "https://chatgpt.com/connector_platform_oauth_redirect"), "chatgpt");
  assert.equal(fournisseurDuClient("Gemini CLI", "http://localhost:1234/cb"), "gemini");
  assert.equal(fournisseurDuClient("Mon agent", "https://exemple.com/cb"), "autre");
});
