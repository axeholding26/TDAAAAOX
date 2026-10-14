// Socle du Builder MCP : comparaison avant/après, risque, validation (structure, code
// injecté, design importé intouchable) et lien d'aperçu signé.
import { test } from "node:test";
import assert from "node:assert/strict";
import { comparer, resumer } from "@/lib/builder/diff";
import { risqueChangements } from "@/lib/builder/risque";
import { validerConfig } from "@/lib/builder/validation";
import { jetonApercu, lireJetonApercu } from "@/lib/builder/apercu";

process.env.AUTH_SECRET ||= "secret-de-test";

const widget = (id: string, type: string, config: Record<string, any> = {}) => ({ id, type, config });
const section = (id: string, enfant: any, zone?: string) => ({
  id, type: "section", config: zone ? { zone } : {},
  children: [{ id: `${id}_r`, type: "row", children: [{ id: `${id}_c`, type: "column", children: [enfant] }] }],
});
const base = () => ({
  colors: { fond: "#ffffff", accent: "#111111", texte: "#222222", surface: "#f5f5f5" },
  builderTree: [section("hero", widget("h1", "heading", { texte: "Bienvenue" })), section("prod", widget("p1", "products", { titre: "Nos produits" }))],
});

test("diff : ajout, suppression, déplacement, modification et thème", () => {
  const avant = base();
  const apres = base();
  apres.builderTree.reverse();
  (apres.builderTree[0].children[0].children[0].children[0] as any).config.titre = "Meilleures ventes";
  apres.builderTree.push(section("conf", widget("t1", "text", { texte: "Paiement à la livraison" })) as any);
  apres.colors.accent = "#000000";
  const ch = comparer(avant, apres);
  assert.ok(ch.some((c) => c.type === "deplacement" && c.cible === "prod"));
  assert.ok(ch.some((c) => c.type === "modification" && c.cible === "p1"));
  assert.equal(ch.filter((c) => c.type === "ajout").length, 1, "seule la racine d'un sous-arbre ajouté est signalée");
  assert.ok(ch.some((c) => c.cible === "colors"));
  const sansHero = base(); sansHero.builderTree.shift();
  assert.deepEqual(comparer(avant, sansHero).filter((c) => c.type === "suppression").map((c) => c.cible), ["hero"]);
  assert.equal(comparer(avant, base()).length, 0);
  assert.match(resumer(ch), /^[+~↕-] /m);
});

test("risque : texte faible, couleurs moyen, CSS ou refonte élevé", () => {
  assert.equal(risqueChangements([{ type: "modification", cible: "p1", detail: "texte" }]).risque, "faible");
  assert.equal(risqueChangements([{ type: "modification", cible: "colors", detail: "Couleurs" }, { type: "modification", cible: "fonts", detail: "Typo" }]).risque, "moyen");
  assert.equal(risqueChangements([{ type: "modification", cible: "customCss", detail: "CSS" }, { type: "modification", cible: "colors", detail: "c" }]).risque, "eleve");
  const refonte = Array.from({ length: 30 }, (_, i) => ({ type: "modification" as const, cible: `b${i}`, detail: "x" }));
  assert.equal(risqueChangements(refonte).risque, "eleve");
  assert.ok(risqueChangements(refonte).score <= 100);
});

test("validation : structure, types, code injecté, design importé", () => {
  const ok = base();
  assert.deepEqual(validerConfig(ok, ok), []);
  const inconnu = base(); (inconnu.builderTree[0].children[0].children[0].children[0] as any).type = "carrousel-magique";
  assert.ok(validerConfig(inconnu, ok).some((e) => /inconnu/.test(e)));
  const mauvaisNid = base(); (mauvaisNid.builderTree as any).push(widget("seul", "heading", { texte: "x" }));
  assert.ok(validerConfig(mauvaisNid, ok).some((e) => /ne peut pas être placé/.test(e)));
  for (const piege of ['<script>alert(1)</script>', "javascript:alert(1)", '<img src=x onerror="alert(1)">']) {
    const c = base(); (c.builderTree[0].children[0].children[0].children[0] as any).config.texte = piege;
    assert.ok(validerConfig(c, ok).some((e) => /code non autorisé/.test(e)), piege);
  }
  const dbl = base(); (dbl.builderTree[1] as any).id = "hero";
  assert.ok(validerConfig(dbl, ok).some((e) => /double/.test(e)));
  assert.ok(validerConfig({ ...ok, colors: { ...ok.colors, accent: "red; background:url(x)" } }, ok).some((e) => /couleur/.test(e)));
  assert.ok(validerConfig({ ...ok, builderHtml: "<div>neuf</div>" }, ok).some((e) => /design importé/.test(e)));
  // Un design importé qui contient déjà du code reste modifiable ailleurs : on ne refuse que ce qui en AJOUTE.
  const design = { ...ok, builderTree: [...ok.builderTree, section("d", widget("e1", "embed-html", { html: '<a onclick="x()">Acheter</a>' }))] };
  assert.deepEqual(validerConfig({ ...design, colors: { ...design.colors, accent: "#333333" } }, design), []);
  const copieDesign = { ...design, builderTree: [...design.builderTree, section("d2", widget("e2", "embed-html", { html: '<a onclick="x()">Acheter</a>' }))] };
  assert.deepEqual(validerConfig(copieDesign, design), [], "dupliquer une section de design à l'identique est permis");
  const designNeuf = { ...design, builderTree: [...design.builderTree, section("d3", widget("e3", "embed-html", { html: "<p>écrit par une IA</p>" }))] };
  assert.ok(validerConfig(designNeuf, design).some((e) => /embed-html/.test(e)));
  assert.ok(validerConfig({ ...ok, pagesPerso: { "Mauvais Slug": { builderTree: [] } } }, ok).some((e) => /adresse de page/.test(e)));
});

test("aperçu : jeton signé, lié à une boutique, expirant", () => {
  const j = jetonApercu("boutique-a")!;
  assert.equal(lireJetonApercu(j), "boutique-a");
  assert.equal(lireJetonApercu(j.replace("boutique-a", "boutique-b")), null, "changer la boutique casse la signature");
  assert.equal(lireJetonApercu(j, Date.now() + 2 * 3600_000), null, "expiré après une heure");
  assert.equal(lireJetonApercu("n.importe.quoi"), null);
  assert.equal(lireJetonApercu(undefined), null);
});
