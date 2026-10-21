// Réglages par élément des pages catalogue, commande, À propos, contact et fiche (lib/elements-pages.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cssElementsPage } from "@/lib/elements-pages";
import { resolveThemeConfig } from "@/lib/theme-config";
import { pageDepuisChemin } from "@/lib/pages-boutique";

const SEL = ".axs-store>div:nth-of-type(1)>h1:nth-of-type(1)";

test("le style d'un élément devient une règle CSS sur son chemin, mobile compris", () => {
  const css = cssElementsPage({ styles: { [SEL]: { base: { couleur: "#f00" }, mobile: { taille: "14px" } } } });
  assert.ok(css.includes(`${SEL}{color:#f00 !important;}`));
  assert.ok(css.includes(`@media (max-width:639px){${SEL}{font-size:14px !important;}}`), "mobile sans conteneur de référence");
  assert.ok(css.includes(`@container (max-width:639px){${SEL}`), "mobile dans la fiche (@container)");
  assert.equal(cssElementsPage(undefined), "");
});

test("un sélecteur ne peut pas sortir de sa règle", () => {
  assert.ok(!cssElementsPage({ styles: { "h1}body{display:none": { base: { couleur: "red" } } } }).includes("}body{"));
});

test("les réglages survivent à la lecture de la config par la vitrine", () => {
  const elementsPages = { catalogue: { styles: { [SEL]: { base: { couleur: "#f00" } } }, contenus: { [SEL]: { texte: "Nos produits" } } } };
  assert.deepEqual(resolveThemeConfig("terre-et-or", { elementsPages }).elementsPages, elementsPages);
});

test("page reconnue avec ou sans le nom de la boutique dans l'adresse (sous-domaine)", () => {
  assert.equal(pageDepuisChemin("ma-boutique", "/ma-boutique/produits"), "catalogue");
  assert.equal(pageDepuisChemin("ma-boutique", "/checkout"), "commande");
  assert.equal(pageDepuisChemin("ma-boutique", "/produits/abc"), "produit");
});
