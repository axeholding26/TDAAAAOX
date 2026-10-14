// AXSO BUILDER, navigation et médias : liens du design modifiés sur place (clone d'un frère,
// jamais de code), liens cassés détectés, menus du socle, lecture des en-têtes d'image.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parse } from "node-html-parser";
import { OPERATIONS, lireMenus, normaliserLien, verifierLien } from "@/lib/builder/operations/navigation";
import { altPropose, diagnostic, imagesUtilisees, lireEntete, ratio, remplacerImage } from "@/lib/builder/images";
import { validerConfig } from "@/lib/builder/validation";
import type { DonneesBoutique } from "@/lib/builder/types";

const d: DonneesBoutique = { slug: "ndop", nom: "NDOP", devise: "XAF", collections: [{ slug: "ete", nom: "Été" }], produits: [{ id: "p1", nom: "Sac" }] };
const op = (nom: string) => OPERATIONS.find((o) => o.nom === nom)!;
const copie = (v: any) => JSON.parse(JSON.stringify(v));

const ENTETE = `<header><div class="logo">NDOP</div><nav><a id="nav-home" class="active" href="/ndop">Accueil</a><a class="lien" href="/ndop/produits">Collection</a><a class="lien" href="/pnath/produits">Origines</a></nav></header>`;
const PIED = `<footer><div class="foot-grid"><div><h4>Service</h4><ul><li><a href="/ndop/contact">Contact</a></li><li><a>Livraison</a></li></ul></div></div><div class="foot-bottom"><span>© 2026 NDOP</span></div></footer>`;
const section = (id: string, zone: string, html: string) => ({ id, type: "section", config: { zone, nom: zone }, children: [{ id: `${id}r`, type: "row", children: [{ id: `${id}c`, type: "column", children: [{ id: `${id}e`, type: "embed-html", config: { html } }] }] }] });
const cfgDesign = () => ({ sections: {}, builderTree: [section("h", "header", ENTETE), section("f", "footer", PIED)] }) as any;
const htmlDe = (cfg: any, i: number) => cfg.builderTree[i].children[0].children[0].children[0].config.html as string;
const appliquer = (nom: string, cfg: any, args: any) => { const avant = copie(cfg); const apres = op(nom).appliquer(copie(cfg), args, d); return { apres, erreurs: validerConfig(apres, avant) }; };

test("menus du design : un menu par groupe de liens, identifiant section~n", () => {
  const menus = lireMenus(cfgDesign(), d);
  const nav = menus.find((m) => m.id === "h~0")!;
  assert.deepEqual(nav.liens.map((l) => l.libelle), ["Accueil", "Collection", "Origines"]);
  assert.equal(menus.find((m) => m.id === "f~0")!.titre, "Service");
  assert.equal(menus.find((m) => m.id === "principal")!.par_defaut, true);
});

test("modifier le libellé et la cible d'un lien du design", () => {
  const { apres, erreurs } = appliquer("axso_builder_update_menu", cfgDesign(), { menu: "h~0", action: "modifier", index: 2, libelle: "Été <b>", lien: "collections/ete" });
  assert.deepEqual(erreurs, []);
  const a = parse(htmlDe(apres, 0)).querySelectorAll("nav a")[2];
  assert.equal(a.getAttribute("href"), "/ndop/collections/ete");
  assert.equal(a.innerHTML, "Été b");
});

test("ajouter un lien = clone d'un frère (même classe, sans id ni gestionnaire), dans son <li>", () => {
  const { apres, erreurs } = appliquer("axso_builder_update_menu", cfgDesign(), { menu: "h~0", action: "ajouter", libelle: "WhatsApp", lien: "https://wa.me/237600000000", position: 1 });
  assert.deepEqual(erreurs, []);
  const liens = parse(htmlDe(apres, 0)).querySelectorAll("nav a");
  assert.equal(liens.length, 4);
  assert.equal(liens[1].text, "WhatsApp");
  assert.equal(liens[1].getAttribute("id"), undefined); // cloné depuis « Accueil » (id, active retirés)
  assert.ok(!liens[1].classList.contains("active"));
  const pied = appliquer("axso_builder_update_menu", cfgDesign(), { menu: "f~0", action: "ajouter", libelle: "Suivi", lien: "/suivi" }).apres;
  assert.equal(parse(htmlDe(pied, 1)).querySelectorAll("ul > li > a").length, 3);
});

test("supprimer et réordonner des liens du design", () => {
  const sup = appliquer("axso_builder_update_menu", cfgDesign(), { menu: "f~0", action: "supprimer", index: 1 }).apres;
  assert.equal(parse(htmlDe(sup, 1)).querySelectorAll("li").length, 1);
  const { apres } = appliquer("axso_builder_reorder_menu_items", cfgDesign(), { menu: "h~0", ordre: [2, 0, 1] });
  assert.deepEqual(parse(htmlDe(apres, 0)).querySelectorAll("nav a").map((a) => a.text), ["Origines", "Accueil", "Collection"]);
  assert.throws(() => op("axso_builder_reorder_menu_items").appliquer(cfgDesign(), { menu: "h~0", ordre: [0, 0, 1] }, d), /une seule fois/);
});

test("aucun code ne passe : javascript:, data:, http:, gestionnaire d'événement", () => {
  for (const lien of ["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,x", "http://site.cm", "/autre-boutique/produits", "produits\" onclick=\"x"])
    assert.throws(() => op("axso_builder_update_menu").appliquer(cfgDesign(), { menu: "h~0", action: "modifier", index: 0, lien }, d), /Lien refusé|Lien manquant/, lien);
  // Un lien modèle qui porte un gestionnaire : le clone ne le garde pas, la validation ne voit aucun danger ajouté.
  const piege = { sections: {}, builderTree: [section("h", "header", `<header><nav><a href="/ndop" onclick="go('x')">A</a></nav></header>`)] } as any;
  const { apres, erreurs } = appliquer("axso_builder_update_menu", piege, { menu: "h~0", action: "ajouter", libelle: "B", lien: "contact" });
  assert.deepEqual(erreurs, []);
  assert.equal((htmlDe(apres, 0).match(/onclick/g) ?? []).length, 1);
});

test("liens cassés : collection, page libre, produit, autre boutique, lien mort", () => {
  const cfg = { pagesPerso: { ramadan: { titre: "Ramadan" } } };
  assert.equal(verifierLien("/ndop/collections/ete", d, cfg).valide, true);
  assert.equal(verifierLien("/ndop/collections/hiver", d, cfg).valide, false);
  assert.equal(verifierLien("/ndop/p/ramadan", d, cfg).valide, true);
  assert.equal(verifierLien("p/noel", d, cfg).valide, false);
  assert.equal(verifierLien("/ndop/produits/p1", d, cfg).valide, true);
  assert.equal(verifierLien("/ndop/produits/disparu", d, cfg).valide, false);
  assert.match(verifierLien("/pnath/produits", d, cfg).raison!, /autre boutique/);
  assert.equal(verifierLien("", d, cfg).valide, false);
  assert.equal(verifierLien("tel:+237600000000", d, cfg).valide, true);
  assert.equal(normaliserLien("/ndop/a-propos", "ndop"), "a-propos");
});

test("socle : menu principal initialisé depuis les liens par défaut, colonnes du pied", () => {
  const cfg: any = { sections: {}, contactPage: { actif: true } };
  const r: any = op("axso_builder_update_menu").appliquer(copie(cfg), { menu: "principal", action: "ajouter", libelle: "Été", lien: "collections/ete", position: 0 }, d);
  assert.deepEqual(r.navigation.principal.map((l: any) => l.lien), ["collections/ete", "produits", "contact", "collections/ete"]);
  const p = op("axso_builder_add_menu").appliquer(copie(cfg), { titre: "Aide", liens: [{ libelle: "Suivi", lien: "/suivi" }] }, d);
  assert.equal(lireMenus(p, d).find((m) => m.id === "pied:0")!.liens[0].href, "/suivi");
  assert.throws(() => op("axso_builder_add_menu").appliquer(cfgDesign(), { titre: "Aide" }, d), /pied de page de son design/);
});

test("en-tête : réglages appliqués aussi au design, logo du design en image", () => {
  const r = op("axso_builder_update_header").appliquer(cfgDesign(), { type: "minimal", recherche: false, logo_url: "https://cdn.exemple.cm/logo.png" }, d);
  assert.equal(r.navigationStyle!.type, "minimal");
  assert.equal(r.reglagesDesign!.navigation, true);
  assert.match(htmlDe(r, 0), /<div class="logo"><img src="https:\/\/cdn\.exemple\.cm\/logo\.png" alt="NDOP"/);
  const f = op("axso_builder_update_footer").appliquer(cfgDesign(), { copyright: "© 2027 NDOP SARL" }, d);
  assert.match(htmlDe(f, 1), /<span>© 2027 NDOP SARL<\/span>/);
});

// ─── Images ──────────────────────────────────────────────────────────────────
const png = () => { const b = Buffer.alloc(24); b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4); b.write("IHDR", 12, "latin1"); b.writeUInt32BE(1920, 16); b.writeUInt32BE(1080, 20); return b; };
const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03, 0, 0, 0, 0]); // 800×600
const gif = () => Buffer.from([...Buffer.from("GIF89a"), 0x40, 0x01, 0xf0, 0x00]); // 320×240
const webpX = () => { const b = Buffer.alloc(30); b.write("RIFF", 0, "latin1"); b.write("WEBPVP8X", 8, "latin1"); b.writeUIntLE(1199, 24, 3); b.writeUIntLE(799, 27, 3); return b; };
const webpL = () => { const b = Buffer.alloc(25); b.write("RIFF", 0, "latin1"); b.write("WEBPVP8L", 8, "latin1"); b.writeUInt32LE((100 - 1) | ((50 - 1) << 14), 21); return b; };
const avif = () => { const b = Buffer.alloc(64); b.writeUInt32BE(32, 0); b.write("ftypavif", 4, "latin1"); b.write("ispe", 40, "latin1"); b.writeUInt32BE(640, 48); b.writeUInt32BE(480, 52); return b; };

test("en-têtes d'image : PNG, JPEG, GIF, WebP (VP8X, VP8L), AVIF", () => {
  assert.deepEqual(lireEntete(png()), { format: "png", largeur: 1920, hauteur: 1080 });
  assert.deepEqual(lireEntete(jpeg()), { format: "jpeg", largeur: 800, hauteur: 600 });
  assert.deepEqual(lireEntete(gif()), { format: "gif", largeur: 320, hauteur: 240 });
  assert.deepEqual(lireEntete(webpX()), { format: "webp", largeur: 1200, hauteur: 800 });
  assert.deepEqual(lireEntete(webpL()), { format: "webp", largeur: 100, hauteur: 50 });
  assert.deepEqual(lireEntete(avif()), { format: "avif", largeur: 640, hauteur: 480 });
  assert.equal(lireEntete(Buffer.from("pas une image")), null);
  assert.equal(ratio(1920, 1080), "16:9");
  assert.ok(diagnostic({ format: "png", octets: 2_000_000, largeur: 4000, hauteur: 3000 }).problemes.length === 2);
  assert.equal(altPropose('Sac <script>x</script> "cuir"', "bannière"), "Sac x &quot;cuir&quot; — bannière");
});

test("images utilisées et remplacement partout dans le brouillon (design figé exclu)", () => {
  const cfg: any = {
    builderHtml: `<img src="https://a.cm/x.png">`,
    builderTree: [section("t", "template", `<section><img src="https://a.cm/x.png" alt=""><div style="background:url('https://a.cm/x.png')"></div></section>`)],
    sections: { hero: { slideshowImages: ["https://a.cm/x.png"] } },
  };
  assert.ok(imagesUtilisees(cfg).length >= 3);
  const r = remplacerImage(cfg, "https://a.cm/x.png", "https://b.cm/y.webp");
  assert.equal(r.n, 3);
  assert.equal(r.figes, 1);
  assert.equal(r.cfg.builderHtml, cfg.builderHtml);
});
