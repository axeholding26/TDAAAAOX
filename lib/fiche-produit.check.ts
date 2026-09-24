// Vérification des règles de la fiche produit (panneau Constructeur + AXIA).
// Lancer : npx tsx lib/fiche-produit.check.ts
import assert from "node:assert";
import { appliquerActionFiche, sectionsFiche } from "./fiche-produit";

let pp = appliquerActionFiche(null, { action: "ajouter", type: "howto", index: 3 }).pp;
assert.equal(sectionsFiche(pp)[3].type, "howto", "insertion à la position demandée");
assert.throws(() => appliquerActionFiche(pp, { action: "ajouter", type: "howto" }), /déjà/, "section unique non dupliquée");
assert.throws(() => appliquerActionFiche(pp, { action: "supprimer", section: "quantity" }), /masquée/, "section de base jamais supprimée");

pp = appliquerActionFiche(pp, { action: "ajouter", type: "richtext" }).pp;
pp = appliquerActionFiche(pp, { action: "ajouter", type: "richtext" }).pp;
const ids = sectionsFiche(pp).map((s) => s.id);
assert.equal(new Set(ids).size, ids.length, "ids uniques même pour les sections répétables");

pp = appliquerActionFiche(pp, { action: "deplacer", section: "howto", index: 0 }).pp;
assert.equal(sectionsFiche(pp)[0].type, "howto", "déplacement par type");
pp = appliquerActionFiche(pp, { action: "masquer", section: "trust" }).pp;
assert.equal(sectionsFiche(pp).find((s) => s.type === "trust")!.actif, false);
pp = appliquerActionFiche(pp, { action: "configurer", section: "trust", config: { colonnes: 4 } }).pp;
assert.equal(sectionsFiche(pp).find((s) => s.type === "trust")!.config.colonnes, 4);
pp = appliquerActionFiche(pp, { action: "styliser", section: "variants", style: { fontScale: "lg", hack: "x" } }).pp;
assert.deepEqual(sectionsFiche(pp).find((s) => s.type === "variants")!.style, { fontScale: "lg" }, "style filtré");
assert.throws(() => appliquerActionFiche(pp, { action: "mise_en_page", layout: "zzz" }));
console.log("fiche-produit : OK");
