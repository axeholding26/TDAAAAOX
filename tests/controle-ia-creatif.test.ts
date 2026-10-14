// AXSO CONTROL, module créatif : choix honnête du moteur, briefs bornés, médiathèque
// étanche entre boutiques, propositions de campagne sans dépense.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  briefImage, cleSupprimable, dimensionsPng, estUtilise, indicateurs, lireAnnonces, lireUsage, moteursPour, recommandations, urlTelechargeable,
  type EtatMoteur,
} from "@/lib/controle-ia/creation/regles";

const etats: EtatMoteur[] = [
  { id: "gemini", portee: "plateforme", capacites: ["image", "edition", "video", "animation"] },
  { id: "higgsfield", portee: "boutique", capacites: ["image", "video"] },
  { id: "eteint", portee: null, capacites: ["detourage"] },
];

test("moteur : la boutique d'abord, puis la plateforme ; capacité sans moteur configuré = aucun moteur", () => {
  assert.deepEqual(moteursPour("image", etats), ["higgsfield", "gemini"]);
  assert.deepEqual(moteursPour("edition", etats), ["gemini"]);
  assert.deepEqual(moteursPour("detourage", etats), []); // annoncé mais non configuré : pas de faux rendu
  assert.deepEqual(moteursPour("agrandissement", etats), []);
  assert.deepEqual(moteursPour("image", etats, "gemini"), ["gemini"]);
  assert.deepEqual(moteursPour("edition", etats, "higgsfield"), []); // moteur imposé incapable : pas de repli silencieux
});

test("brief : fiche produit tronquée, présentée comme donnée ; format respecté", () => {
  const b = briefImage("ad", { produit: { nom: "Sac", description: "x".repeat(5000) }, marque: { nom: "Ma boutique", couleurs: ["#c2622d"] }, format: "story", titre: "Promo" });
  assert.ok(b.includes('Subject (product data): "Sac"'));
  assert.ok(b.length < 2000);
  assert.ok(b.includes("9:16"));
  assert.ok(b.includes('"Promo"'));
});

test("annonces : JSON du modèle nettoyé, toujours exactement n, secours si réponse cassée", () => {
  const ok = lireAnnonces('```json {"annonces":[{"angle":"A","titre":"T","texte":"x","visuel":"v1"},{"visuel":""}]}', 3, "Sac");
  assert.equal(ok.length, 3);
  assert.equal(ok[0].visuel, "v1");
  assert.equal(lireAnnonces("pas du json", 5, "Sac").length, 5);
  assert.equal(lireAnnonces("[]", 0, "Sac").length, 0);
});

test("médiathèque : usage lu prudemment ; suppression limitée au dossier de la boutique", () => {
  assert.deepEqual(lireUsage(null), { produits: [], campagnes: [], pages: [] });
  assert.equal(estUtilise(lireUsage({ produits: ["p1"], pages: 3 })), true);
  assert.equal(cleSupprimable("t1", "boutiques/t1/images/a.png"), true);
  assert.equal(cleSupprimable("t1", "boutiques/t2/images/a.png"), false);
  assert.equal(cleSupprimable("t1", "boutiques/t1/../t2/a.png"), false);
  assert.equal(cleSupprimable("t1", "boutiques/t1/digitals/livre.pdf"), false);
  assert.equal(cleSupprimable("t1", null), false);
});

test("téléchargement : https public seulement", () => {
  assert.equal(urlTelechargeable("https://x.public.blob.vercel-storage.com/a.png"), true);
  for (const u of ["http://exemple.com/a.png", "https://localhost/a", "https://127.0.0.1/a", "https://[::1]/a", "https://metadata/a", "https://u:p@exemple.com/a", "https://nas.local/a", "file:///etc/passwd"]) {
    assert.equal(urlTelechargeable(u), false, u);
  }
});

test("dimensions d'un PNG lues dans l'en-tête", () => {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0); b.write("IHDR", 12, "ascii"); b.writeUInt32BE(1024, 16); b.writeUInt32BE(1280, 20);
  assert.deepEqual(dimensionsPng(b), { largeur: 1024, hauteur: 1280 });
  assert.equal(dimensionsPng(Buffer.from("GIF89a-------------------")), null);
});

test("campagne : indicateurs sans division par zéro ; propositions sans dépense", () => {
  const base = { budget: 100000, budgetJour: 5000, depense: 0, impressions: 0, clics: 0, conversions: 0, roas: 0, statut: "active" };
  assert.equal(indicateurs(base).ctr, null);
  assert.match(recommandations({ ...base, statut: "brouillon" })[0].changement, /Aucun/);
  assert.match(recommandations({ ...base, impressions: 200 })[0].changement, /Attendre/);
  const perte = recommandations({ ...base, impressions: 10000, clics: 50, depense: 20000, conversions: 1, roas: 0.4 });
  assert.ok(perte.some((r) => r.outil === "pause_campaign"));
  assert.ok(perte.some((r) => r.outil === "create_ad_set")); // CTR 0,5 %
  const rentable = recommandations({ ...base, impressions: 10000, clics: 300, depense: 20000, conversions: 30, roas: 4 });
  assert.ok(rentable.some((r) => /accord/.test(r.raison)));
  assert.ok(rentable.every((r) => r.outil !== "launch_campaign"));
});
