// AXSO BUILDER — design system, marque, cohérence et gabarits : tout est pur. Un schéma de
// composant vient du catalogue réel, chaque token pointe sur un vrai champ du thème, la marque
// fixée par le marchand bloque ce qui la contredit, et un gabarit ne passe que validé.
import { test } from "node:test";
import assert from "node:assert/strict";
import { THEME_DEFAULTS, type ThemeConfig } from "@/lib/theme-config";
import { detectCategory } from "@/lib/generate-store-config";
import { schemaBoutique, schemaComposant } from "@/lib/builder/schema";
import { conflitsMarque, distance, marqueDe, validerCoherenceMarque, validerStyle } from "@/lib/builder/marque";
import { OPERATIONS, TOKENS, champReel, reglagesDepuisTokens, listerGabarits, MOT_CATEGORIE, majMarque, changementsSensiblesMarque } from "@/lib/builder/operations/design";
import { validerConfig } from "@/lib/builder/validation";
import { ErreurBuilder } from "@/lib/builder/types";

const DONNEES = { slug: "test", nom: "Kora", devise: "XAF", collections: [], produits: [] };
const op = (nom: string) => OPERATIONS.find((o) => o.nom === `axso_builder_${nom}`)!;
const base = (): ThemeConfig => JSON.parse(JSON.stringify(THEME_DEFAULTS["terre-et-or"]));
const avecMarque = (m: Record<string, unknown>) => ({ ...base(), marque: m }) as ThemeConfig;
const code = (f: () => unknown) => { try { f(); return null; } catch (e) { assert.ok(e instanceof ErreurBuilder, String(e)); return e.code; } };

const bloc = (id: string, type: string, config: Record<string, unknown> = {}, style?: Record<string, unknown>) => ({ id, type, config, style }) as any;
const section = (id: string, enfants: any[], zone = "template") => ({ id, type: "section", config: { zone }, children: [{ id: `${id}_r`, type: "row", children: [{ id: `${id}_c`, type: "column", children: enfants }] }] }) as any;

test("schéma de composant : dérivé du catalogue, du style des blocs et du socle", () => {
  const h = schemaComposant("heading")!;
  assert.equal(h.source, "catalogue");
  assert.ok("texte" in h.content);
  assert.deepEqual((h.layout.niveau as any).enum, ["h1", "h2", "h3", "h4"]);
  assert.ok((h.style as any).spacing && (h.style as any).visibility);
  assert.ok((h.responsive as any).mobile.typography);
  const p = schemaComposant("products")!;
  assert.ok((p.data.tri as any).enum.includes("ventes"));
  assert.ok("nombre" in p.data);
  assert.deepEqual(schemaComposant("section")!.enfants, ["row"]);
  assert.equal(schemaComposant("hero"), null, "section du socle seulement si la boutique est sur le socle");
  assert.ok((schemaComposant("hero", { socle: true })!.layout.style as any).enum.includes("split"));
  assert.ok(schemaComposant("fiche:gallery"));
  assert.equal(schemaComposant("carrousel-3d"), null, "jamais de composant inventé");
});

test("tokens : chaque token avec champ pointe sur un vrai champ du thème ; les autres sont refusés avec la raison", () => {
  const cfg = base() as any;
  for (const [nom, t] of Object.entries(TOKENS)) {
    const champ = champReel(t);
    if (!champ) continue;
    const [racine] = champ.split(".");
    assert.ok(racine in cfg || racine === "navigationStyle", `${nom} → ${champ}`);
  }
  assert.deepEqual(reglagesDepuisTokens({ "color.primary": "#112233", "font.heading": "lora", "radius.base": "8px" }), { couleurs: { accent: "#112233" }, polices: { titre: "lora" }, arrondi: "8px" });
  assert.equal(code(() => reglagesDepuisTokens({ "spacing.md": "16px" })), "INVALID_INPUT");
  const r = op("update_tokens").appliquer(base(), { tokens: { "color.primary": "#112233", "button.style": "pill" } }, DONNEES) as any;
  assert.equal(r.colors.accent, "#112233");
  assert.equal(r.boutons.style, "pill");
  assert.equal(r.reglagesDesign.boutons, true, "appliqué aussi au design importé, comme le Constructeur");
});

test("thème : valeurs hors liste refusées en tout ou rien", () => {
  assert.equal(code(() => op("update_typography").appliquer(base(), { titre: "comic-sans" }, DONNEES)), "INVALID_INPUT");
  assert.equal(code(() => op("update_colors").appliquer(base(), { accent: "red" }, DONNEES)), "INVALID_INPUT");
  assert.equal(code(() => op("update_theme").appliquer(base(), { couleurs: { accent: "#111111" }, arrondi: "7px" }, DONNEES)), "INVALID_INPUT");
  assert.equal(code(() => op("update_radius").appliquer(base(), {}, DONNEES)), "INVALID_INPUT");
  const r = op("update_spacing").appliquer(base(), { paddingSection: "xl" }, DONNEES) as any;
  assert.equal(r.layout.paddingSection, "xl");
});

test("garde de marque : couleur hors palette et police non autorisée refusées ; marque déduite non bloquante", () => {
  const marque = { couleurs: { principales: ["#c2622d"], secondaires: ["#fff8f0", "#2c1503"] }, polices: ["playfair", "inter"] };
  assert.equal(code(() => op("update_colors").appliquer(avecMarque(marque), { accent: "#1e40ff" }, DONNEES)), "POLICY_BLOCKED");
  assert.equal(code(() => op("update_typography").appliquer(avecMarque(marque), { titre: "anton" }, DONNEES)), "POLICY_BLOCKED");
  // Variante très proche d'une couleur approuvée, et neutres : acceptés.
  assert.equal((op("update_colors").appliquer(avecMarque(marque), { accent: "#c5652f", texte: "#111111" }, DONNEES) as any).colors.accent, "#c5652f");
  assert.equal((op("update_typography").appliquer(avecMarque(marque), { titre: "inter" }, DONNEES) as any).fonts.titre, "inter");
  // Verrou : même une couleur de la palette ne passe pas.
  assert.equal(code(() => op("update_colors").appliquer(avecMarque({ ...marque, verrous: ["couleurs"] }), { accent: "#fff8f0" }, DONNEES)), "POLICY_BLOCKED");
  // Sans marque fixée : rien n'est bloqué.
  assert.equal((op("update_colors").appliquer(base(), { accent: "#1e40ff" }, DONNEES) as any).colors.accent, "#1e40ff");
  assert.deepEqual(conflitsMarque(base(), { ...base(), colors: { ...base().colors, accent: "#1e40ff" } }, marqueDe(base(), { nom: "Kora" })), []);
  assert.ok(distance("#c2622d", "#c5652f")! < 40 && distance("#c2622d", "#1e40ff")! > 200);
});

test("marque : mise à jour validée ; lever un verrou est signalé comme sensible", () => {
  assert.equal(code(() => majMarque({}, { couleurs: { principales: ["rouge"] } })), "INVALID_INPUT");
  assert.equal(code(() => majMarque({}, { polices: ["comic-sans"] })), "INVALID_INPUT");
  assert.equal(code(() => majMarque({}, { logo: { principal: "javascript:alert(1)" } })), "INVALID_INPUT");
  const m = majMarque({}, { nom: "Kora", couleurs: { principales: ["#B5522E"] }, verrous: ["logo"], ton: "chaleureux, vouvoiement" });
  assert.deepEqual(m.verrous, ["logo"]);
  const r = op("update_brand").appliquer(base(), { polices: ["inter"] }, DONNEES) as any;
  assert.deepEqual(r.marque.polices, ["inter"]);
  assert.deepEqual(changementsSensiblesMarque(m, { verrous: [] }), ["lève le verrou « logo »"]);
  assert.equal(changementsSensiblesMarque(m, { logo: { principal: "https://x.test/l.png" } }).length, 1);
  assert.deepEqual(changementsSensiblesMarque(m, { ton: "neutre" }), []);
});

test("cohérence du style : couleurs hors palette, polices, boutons, doublons", () => {
  const cfg = { ...base(), builderTree: [
    section("s1", [bloc("b1", "button", { style: "primary" }), bloc("b2", "button", { style: "outline", taille: "lg" }), bloc("b3", "button", { style: "ghost" })]),
    section("s2", [bloc("t1", "text", { texte: "A" }, { typography: { police: "anton", color: "#00ff00" } }), bloc("t2", "text", { texte: "A" }, { typography: { police: "cinzel" } })]),
  ] } as any;
  const p = validerStyle(cfg);
  const cats = p.map((x) => x.categorie);
  assert.ok(cats.includes("couleurs"), "vert hors palette");
  assert.ok(cats.includes("boutons"));
  assert.ok(cats.includes("typographie"), "4 polices");
  assert.ok(!cats.includes("doublons"), "deux textes identiques mais stylés différemment ne sont pas des doublons");
  cfg.builderTree.push(section("s3", [bloc("t3", "text", { texte: "A" })]), section("s4", [bloc("t4", "text", { texte: "A" })]));
  assert.ok(validerStyle(cfg).some((x) => x.categorie === "doublons"));
});

test("cohérence de marque : couleurs de tout le brouillon, ton, visuels", () => {
  const cfg = { ...base(), marque: { couleurs: { principales: ["#c2622d"], secondaires: ["#fff8f0"] }, polices: ["playfair", "inter"], ton: "élégant, vouvoiement" },
    builderTree: [section("s1", [bloc("h1", "heading", { texte: "Découvre ta routine" }, { background: { color: "#1e40ff" } }), bloc("i1", "image", { url: "" })])] } as any;
  const r = validerCoherenceMarque(cfg, marqueDe(cfg, { nom: "Kora" }));
  const cats = r.problemes.map((x) => x.categorie);
  assert.ok(r.problemes.some((x) => x.categorie === "couleurs" && x.gravite === "erreur" && x.message.includes("#1e40ff")));
  assert.ok(cats.includes("ton"), "tutoiement pour un ton au vouvoiement");
  assert.ok(cats.includes("visuels"));
  assert.ok(cats.includes("logo"));
  assert.ok(r.score < 100);
});

test("gabarits : catégories réelles, design complet refusé, socle appliqué en gardant la marque", () => {
  for (const [c, mot] of Object.entries(MOT_CATEGORIE)) assert.equal(detectCategory(mot), c, `${mot} → ${c}`);
  const g = listerGabarits();
  assert.ok(g.some((x) => x.id === "design:ndop-site") && g.some((x) => x.id === "socle:beauty"));
  const creer = op("create_from_template");
  assert.equal(code(() => creer.appliquer(base(), { template_id: "design:ndop-site" }, DONNEES)), "POLICY_BLOCKED");
  assert.equal(code(() => creer.appliquer(base(), { template_id: "socle:inexistant" }, DONNEES)), "NOT_FOUND");
  const style = creer.appliquer(base(), { template_id: "design:ndop-site", style_seulement: true }, DONNEES) as any;
  assert.equal(style.colors.accent, "#B5522E");
  assert.equal(style.fonts.titre, "archivo");
  const avant = { ...base(), marque: { nom: "Kora" } } as any;
  const socle = creer.appliquer(avant, { template_id: "socle:beauty" }, DONNEES) as any;
  assert.deepEqual(socle.colors, avant.colors);
  assert.deepEqual(socle.marque, avant.marque);
  assert.ok(socle.sectionOrder.includes("hero") && socle.productPage.sections.length);
  assert.deepEqual(validerConfig(socle, avant), []);
  assert.equal(code(() => creer.appliquer({ ...base(), builderHtml: "<div></div>" } as any, { template_id: "socle:beauty" }, DONNEES)), "POLICY_BLOCKED");
});

test("gabarit généré : blocs du catalogue seulement, champs filtrés, validé par le moteur, en-tête et pied gardés", () => {
  const creer = op("create_from_template");
  assert.equal(code(() => creer.appliquer(base(), { template_id: "genere", proposition: { blocs: [{ type: "carrousel-3d" }] } }, DONNEES)), "INVALID_INPUT");
  const avant = { ...base(), builderHtml: "<header></header>", builderTree: [section("h", [bloc("e1", "text", { texte: "entête" })], "header"), section("old", [bloc("x", "text")]), section("f", [bloc("e2", "text")], "footer")] } as any;
  const r = creer.appliquer(avant, { template_id: "genere", proposition: {
    couleurs: { accent: "#8a3b12", texte: undefined }, polices: { titre: "fraunces" },
    blocs: [{ type: "heading", config: { texte: "Beauté d'Afrique", niveau: "h1", script: "<script>" } }, { type: "products", config: { nombre: 8 } }],
  } }, DONNEES) as any;
  assert.deepEqual(r.builderTree.map((s: any) => s.config.zone), ["header", "template", "template", "footer"]);
  const h = r.builderTree[1].children[0].children[0].children[0];
  assert.equal(h.config.texte, "Beauté d'Afrique");
  assert.equal(h.config.script, undefined, "champ hors catalogue retiré");
  assert.equal(r.colors.accent, "#8a3b12");
  assert.equal(r.builderHtml, avant.builderHtml);
  assert.deepEqual(validerConfig(r, avant), []);
  // Design importé non découpé : remplacer l'accueil effacerait son en-tête.
  assert.equal(code(() => creer.appliquer({ ...base(), builderHtml: "<div></div>" } as any, { template_id: "genere", proposition: { blocs: [{ type: "heading" }] } }, DONNEES)), "POLICY_BLOCKED");
});

test("schéma de boutique : compact (jamais le HTML importé), paginé, page par page", () => {
  const html = `<section><h1 data-axs-el="a">Titre du design</h1><p data-axs-el="b">${"x".repeat(5000)}</p></section>`;
  const cfg = { ...base(), builderHtml: html, builderTree: [
    { id: "d1", type: "section", config: { zone: "template", nom: "Hero" }, children: [{ id: "r", type: "row", children: [{ id: "c", type: "column", children: [{ id: "e", type: "embed-html", config: { html } }] }] }] },
    ...Array.from({ length: 25 }, (_, i) => section(`s${i}`, [bloc(`b${i}`, "button", { texte: "Voir", lien: "produits" })])),
  ], pagesPerso: { ramadan: { nom: "Ramadan", builderTree: [], statut: "brouillon" } } } as any;
  const s = schemaBoutique(cfg) as any;
  const json = JSON.stringify(s);
  assert.ok(!json.includes("x".repeat(200)), "HTML jamais renvoyé");
  const accueil = s.store.pages.accueil;
  assert.equal(accueil.total, 26);
  assert.equal(accueil.nodes.length, 20);
  assert.equal(accueil.suite, 20);
  const embed = accueil.nodes[0].children[0].children[0].children[0];
  assert.deepEqual(embed.properties.textes_principaux, ["Titre du design"]);
  assert.equal(embed.properties.elements_editables, 2);
  assert.equal(embed.permissions.modifier_proprietes, false);
  const bouton = accueil.nodes[1].children[0].children[0].children[0];
  assert.deepEqual(bouton.events, { lien: { clic: "aller_a", cible: "produits" } });
  assert.match(bouton.version, /^[0-9a-f]{8}$/);
  assert.ok(s.store.pages["p/ramadan"]);
  assert.equal((schemaBoutique(cfg, { page: "accueil", offset: 20 }) as any).nodes.length, 6);
  assert.equal(schemaBoutique(cfg, { page: "nulle-part" }), null);
  const court = schemaBoutique(cfg, { page: "accueil", profondeur: 1 }) as any;
  assert.deepEqual(court.nodes[0].children, { tronque: 1 });
});
