// Standard d'import de thème : un fichier conforme passe sans remarque et se
// découpe bien en sections (même découpage que le Constructeur, côté serveur).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { validerThemeImporte, PROMPT_IMPORT_THEME } from "@/lib/prompt-import-theme";
import { decouperDesign, type ElementDesign } from "@/lib/decoupage-design";

const CONFORME = `<!doctype html><html><head><title>Mon thème</title><style>:root{--a:#000}</style></head><body>
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
