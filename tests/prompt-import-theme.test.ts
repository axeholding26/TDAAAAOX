// Standard d'import de thème : un fichier conforme passe sans remarque et se
// découpe bien en sections (même découpage que le Constructeur, côté serveur).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { validerThemeImporte, PROMPT_IMPORT_THEME } from "@/lib/prompt-import-theme";
import { decouperDesign, type ElementDesign } from "@/lib/decoupage-design";

const CONFORME = `<!doctype html><html><head><title>Mon thème</title><style>:root{--couleur-fond:#000000}</style></head><body>
<header><a class="logo" data-axso-nom href="#">Ma marque</a><nav><a href="#">Accueil</a><a href="#">Boutique</a></nav></header>
<div class="view active" id="view-home">
  <section class="hero"><h1>Titre</h1><p>Texte</p><a href="#" class="btn">Voir</a><img src="https://x.test/a.jpg" alt=""></section>
  <section class="collection"><h2>Nouveautés</h2><div class="product-grid"><a href="#" class="product-card"><img src="https://x.test/b.jpg" alt=""><h3>Robe</h3><span class="price">12 000 FCFA</span></a></div></section>
</div>
<footer><a href="#">Contact</a><span>© 2026 <span data-axso-nom>Ma marque</span></span></footer>
</body></html>`;

test("thème conforme : aucune remarque, 1 en-tête + 2 sections + 1 pied", () => {
  assert.deepEqual(validerThemeImporte(CONFORME), { erreurs: [], avertissements: [] });
  const body = parse(CONFORME).querySelector("body")!.innerHTML;
  const sections = decouperDesign(body, (h) => parse(h).children as unknown as ElementDesign[]);
  assert.deepEqual(sections.map((s) => s.config?.zone), ["header", "template", "template", "footer"]);
  assert.match(PROMPT_IMPORT_THEME, /class="view active" id="view-home"/);
});

test("thème non conforme : erreurs et avertissements listés", () => {
  const r = validerThemeImporte(`<body><main><h1>Salut <em>toi</em></h1><button>Ok</button><img src="a.jpg"><script>x()</script><div onclick="y()" class="logo">L</div></main></body>`);
  assert.equal(r.erreurs.length, 1); // pas de .view
  for (const motif of [/script/, /onclick/, /https/, /<button>/, /mêlé/, /data-axso-nom/])
    assert.ok(r.avertissements.some((a) => motif.test(a)), String(motif));
  assert.match(validerThemeImporte(`<div class="view"></div><div class="view"></div>`).erreurs[0], /2 conteneurs/);
});

// ─── Boutique complète et page seule ─────────────────────────────────────────
import { PROMPTS_IMPORT, charteDepuisCss } from "@/lib/prompt-import-theme";
import { extraireVuesLibrairie, gabaritCarteDepuisDemo, remplacerTokensCarte } from "@/lib/theme-import-clone";

const CARTE = `<a href="#" class="product-card"><img src="https://x.test/b.jpg" alt=""><h3>Robe longue</h3><span class="price">12 000 FCFA</span></a>`;
const BOUTIQUE = `<!doctype html><html><head><title>Shop</title><style>:root{--couleur-fond:#FFFFFF;--couleur-accent:#C2622D;--couleur-texte:#111111}</style></head><body>
<header><a class="logo" data-axso-nom href="#">Ma marque</a><nav><a href="#">Accueil</a><a href="#">Boutique</a><a href="#">Contact</a></nav></header>
<div class="view active" id="view-home"><section class="hero"><h1>Titre</h1></section><section class="collection"><h2>Nouveautés</h2><div id="homeGrid">${CARTE}${CARTE}</div></section></div>
<div class="view active" id="view-boutique"><section class="plp"><h1>Collection</h1><div id="plpGrid">${CARTE}${CARTE}</div></section></div>
<footer><a href="#">Contact</a><span>© <span data-axso-nom>Ma marque</span></span></footer>
</body></html>`;

test("boutique complète : conforme, vues complétées, liens rattachés, carte tokenisée", () => {
  assert.deepEqual(validerThemeImporte(BOUTIQUE, "boutique"), { erreurs: [], avertissements: [] });
  const vues = extraireVuesLibrairie({ htmlBrut: BOUTIQUE, slug: "ma-boutique", completer: true })!;
  assert.ok(vues, "accueil + catalogue suffisent en mode completer");
  assert.equal(extraireVuesLibrairie({ htmlBrut: BOUTIQUE, slug: "ma-boutique" }), null, "la bibliothèque exige toujours les 6 vues");
  assert.match(vues.chromeAvant, /href="\/ma-boutique\/produits"/);
  assert.match(vues.panier, /id="view-panier"/);
  const carte = gabaritCarteDepuisDemo(vues.boutique)!;
  for (const jeton of ["{{NOM}}", "{{PRIX}}", "{{IMAGE}}", "{{LIEN}}"]) assert.ok(carte.includes(jeton), jeton);
  const rendu = remplacerTokensCarte(carte, { id: "p1", nom: "Sac <cuir>", prixAffiche: "5 000 FCFA", image: "https://x.test/s.jpg" }, "ma-boutique");
  assert.match(rendu, /href="\/ma-boutique\/produits\/p1"/);
  assert.match(rendu, /Sac &lt;cuir&gt;/);
  assert.doesNotMatch(rendu, /Robe longue/);
});

test("boutique complète non conforme : vues et grille manquantes signalées", () => {
  const r = validerThemeImporte(`<body><div class="view active" id="view-home"></div></body>`, "boutique");
  assert.ok(r.erreurs.some((e) => /view-boutique/.test(e)));
  assert.ok(r.erreurs.some((e) => /plpGrid/.test(e)));
});

test("page seule : en-tête et pied ignorés, prompt sans en-tête", () => {
  const ok = `<html><head><style>:root{--couleur-fond:#000000}</style></head><body><div class="view active" id="view-home"><section class="hero"><h1>Salon</h1></section></div></body></html>`;
  assert.deepEqual(validerThemeImporte(ok, "page"), { erreurs: [], avertissements: [] });
  const r = validerThemeImporte(ok.replace("<body>", "<body><header><nav></nav></header>"), "page");
  assert.ok(r.avertissements.some((a) => /ignorés/.test(a)));
  assert.match(PROMPTS_IMPORT.page, /PAS de <header>/);
  assert.match(PROMPTS_IMPORT.boutique, /id="plpGrid"/);
});

test("charte : variables imposées → couleurs et variables à surcharger", () => {
  assert.deepEqual(charteDepuisCss(":root{--couleur-fond:#FFFFFF; --couleur-accent : #C2622D;--autre:#123456}"), {
    couleurs: { fond: "#ffffff", accent: "#c2622d" },
    mapping: { fond: "--couleur-fond", accent: "--couleur-accent" },
  });
});

import { cssPageImportee, cssSectionsDesign } from "@/lib/scope-css";
test("CSS d'une page importée : confiné à ses sections, celui de la boutique n'y entre pas", () => {
  const page = cssPageImportee("@media (max-width:600px){.hero{padding:0}}");
  assert.match(page, /@scope \(\[data-axs-css-page\]\)/);
  assert.match(page, /@container \(max-width:600px\)/);
  assert.equal(cssPageImportee(undefined), "");
  assert.match(cssSectionsDesign({ builderCss: ".hero{color:red}", colors: {} }), /@scope \(\[data-axs-embed-html\]:not\(\[data-axs-css-page\]\)\)/);
});

import { appliquerNouveauTheme, resolveThemeConfig } from "@/lib/theme-config";
test("changer de thème garde les pages libres (pages importées), menus, marque et SEO", () => {
  const ancien = { ...resolveThemeConfig("terre-et-or"), pagesPerso: { salon: { nom: "Salon", builderTree: [], css: ".a{}" } }, navigation: { principal: [] }, seo: { titre: "x" } } as any;
  const r = appliquerNouveauTheme(ancien, resolveThemeConfig("terre-et-or")) as any;
  assert.equal(r.pagesPerso.salon.css, ".a{}");
  assert.deepEqual(r.navigation, { principal: [] });
  assert.equal(r.seo.titre, "x");
});
