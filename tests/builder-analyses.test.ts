// Builder — analyses pures : contraste WCAG (valeurs connues), chaque analyseur détecte son
// problème et ne signale rien sur une boutique saine, score de santé borné, format des
// corrections (applicables telles quelles), opération SEO des pages libres.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveThemeConfig, type BlockNode, type ThemeConfig } from "@/lib/theme-config";
import { OPERATIONS_PAR_NOM } from "@/lib/builder/operations";
import { ajusterContraste, contraste, lienCasse, px, rgb, type Boutique, type Probleme } from "@/lib/builder/analyses/commun";
import { analyserMobile } from "@/lib/builder/analyses/mobile";
import { analyserSeo } from "@/lib/builder/analyses/seo";
import { analyserAccessibilite } from "@/lib/builder/analyses/accessibilite";
import { analyserPerformance } from "@/lib/builder/analyses/performance";
import { analyserConversion } from "@/lib/builder/analyses/conversion";
import { analyserDesign } from "@/lib/builder/analyses/design";
import { scoreSante, toutAnalyser, verdict } from "@/lib/builder/analyses/sante";

const clone = <V>(v: V): V => JSON.parse(JSON.stringify(v));
let n = 0;
const bloc = (type: BlockNode["type"], config: Record<string, any> = {}, style?: BlockNode["style"]): BlockNode => ({ id: `${type}_${++n}`, type, config, ...(style && { style }) });
const section = (id: string, zone: string, widgets: BlockNode[]): BlockNode => ({ id, type: "section", config: { nom: id, zone }, children: [{ id: `${id}_r`, type: "row", children: [{ id: `${id}_c`, type: "column", children: widgets }] }] });

const TEXTE = "Des pagnes wax et bogolan travaillés par des ateliers que nous nommons, livrés à Douala et Yaoundé sous 48 heures, paiement à la livraison.";

function saine(): ThemeConfig {
  return resolveThemeConfig("terre-et-or", {
    colors: { fond: "#ffffff", texte: "#1a1a1a", texteMuted: "#555555", surface: "#f5f5f5", accent: "#8a3b12" },
    builderTree: [
      section("entete", "header", [bloc("button", { texte: "Boutique", lien: "produits", taille: "md" })]),
      section("hero", "template", [
        bloc("heading", { texte: "Pagnes faits main", niveau: "h1" }),
        bloc("text", { texte: TEXTE }),
        bloc("button", { texte: "Voir la collection", lien: "produits", taille: "lg" }),
        bloc("image", { url: "https://exemple.com/hero.jpg", alt: "Pagne bogolan plié", ratio: "square" }),
      ]),
      section("produits", "template", [bloc("products", { titre: "Meilleures ventes", nombre: 8, colonnes: 4 })]),
      section("preuve", "template", [bloc("social-proof", { note: "4.8/5", nbClients: "1 200", certifications: ["Paiement à la livraison"] })]),
      section("confiance", "template", [bloc("features", { titre: "Pourquoi nous", items: [{ titre: "Livraison 48 h", texte: "Douala et Yaoundé" }] })]),
      section("pied", "footer", [bloc("text", { texte: "Contact : WhatsApp" })]),
    ],
  });
}

const boutique = (): Boutique => ({
  nom: "NDOP", slug: "ndop", devise: "XAF",
  description: TEXTE, metaTitle: "Pagnes wax et bogolan faits main | NDOP", metaDescription: TEXTE,
  bannerUrl: "https://exemple.com/banniere.jpg", whatsapp: "+237690000000", livraison: { frais: 1000 },
  scripts: { octets: 0, pixels: 1 },
  produits: [
    { id: "p1", nom: "Pagne bogolan", description: TEXTE, metaTitle: "Pagne bogolan | NDOP", metaDesc: TEXTE, images: ["https://exemple.com/1.jpg"], prix: 15000, prixCompare: 18000 },
    { id: "p2", nom: "Pagne kente", description: TEXTE, metaTitle: "Pagne kente | NDOP", metaDesc: TEXTE, images: ["https://exemple.com/2.jpg"], prix: 20000 },
  ],
  collections: [{ slug: "wax", nom: "Wax" }],
  avisApprouves: 4,
});

/** Premier bloc d'un type dans l'arbre. */
function trouver(cfg: ThemeConfig, type: string, pred: (n: BlockNode) => boolean = () => true): BlockNode & { config: Record<string, any> } {
  const tous: BlockNode[] = [];
  const v = (ns: BlockNode[]) => ns.forEach((x) => { tous.push(x); v(x.children ?? []); });
  v(cfg.builderTree ?? []);
  return tous.find((x) => x.type === type && pred(x)) as any;
}

const DONNEES: any = { slug: "ndop", nom: "NDOP", devise: "XAF", collections: [{ slug: "wax", nom: "Wax" }], produits: [{ id: "p1", nom: "Pagne bogolan" }] };

const ANALYSEURS = { analyserMobile, analyserSeo, analyserAccessibilite, analyserPerformance, analyserConversion, analyserDesign };

test("contraste WCAG : valeurs connues", () => {
  assert.equal(contraste("#000000", "#ffffff"), 21);
  assert.equal(contraste("#fff", "#fff"), 1);
  assert.equal(contraste("#777777", "#ffffff"), 4.48); // le gris « limite » bien connu, juste sous 4,5
  assert.equal(contraste("rgb(255, 255, 255)", "#767676"), 4.54);
  assert.equal(contraste("var(--ink)", "#fff"), null);
  assert.deepEqual(rgb("#abc"), [170, 187, 204]);
  const c = ajusterContraste("#999999", "#ffffff", 4.6)!;
  assert.ok(contraste(c, "#ffffff")! >= 4.6);
  assert.equal(px("1.5rem"), 24);
  assert.equal(px("50%"), null);
});

test("boutique saine : aucun faux positif, score 100", () => {
  const cfg = saine(), b = boutique();
  for (const [nom, f] of Object.entries(ANALYSEURS)) assert.deepEqual(f(cfg, b), [], nom);
  const s = scoreSante(toutAnalyser(cfg, b));
  assert.equal(s.global, 100);
  assert.equal(s.domaines.marque, null);
});

test("mobile : bouton trop petit, largeur fixe, grille trop serrée", () => {
  const cfg = saine();
  trouver(cfg, "button", (x) => x.config?.taille === "lg").config!.taille = "sm";
  trouver(cfg, "image").style = { width: "600px" }; // bloc : flex-basis qui rétrécit, pas un débordement
  (cfg.builderTree![1].children![0].children![0].children!).push({ id: "emb", type: "embed-html", config: { html: '<div style="width:600px"><p style="width:600px">Large</p></div>' } });
  cfg.layout = { ...cfg.layout, colonnesMobile: 3 };
  const p = analyserMobile(cfg, boutique());
  assert.ok(p.some((x) => /trop petit pour le doigt/.test(x.message)));
  assert.deepEqual(p.filter((x) => /600px/.test(x.message)).map((x) => x.cible), ["emb"]);
  assert.ok(p.some((x) => x.cible === "theme:layout"));
});

test("SEO : deux h1, page libre sans métadonnées (correction appliquable), lien cassé, image sans alt", () => {
  const cfg = saine() as any;
  trouver(cfg, "heading").config.niveau = "h1";
  cfg.builderTree[2].children[0].children[0].children.unshift(bloc("heading", { texte: "Encore un titre", niveau: "h1" }));
  trouver(cfg, "image").config.alt = "";
  trouver(cfg, "button", (x: BlockNode) => x.config?.taille === "lg").config.lien = "collections/inconnue";
  cfg.pagesPerso = { ramadan: { nom: "Ramadan", builderTree: [section("r1", "template", [bloc("heading", { texte: "Offres du Ramadan", niveau: "h1" }), bloc("text", { texte: TEXTE })])] } };
  const p = analyserSeo(cfg, boutique());
  assert.ok(p.some((x) => /2 titres h1/.test(x.message)));
  assert.ok(p.some((x) => x.gravite === "critique" && /collection « inconnue »/.test(x.message)));
  assert.ok(p.some((x) => /sans texte alternatif/.test(x.message)));
  const page = p.find((x) => x.cible === "page:p/ramadan" && x.correction)!;
  assert.equal(page.correction!.op, "axso_builder_update_seo");
  const apres = OPERATIONS_PAR_NOM.get(page.correction!.op)!.appliquer(clone(cfg), page.correction!.args, {} as any) as any;
  assert.equal(apres.pagesPerso.ramadan.seo.titre, "Ramadan | NDOP");
  assert.ok(apres.pagesPerso.ramadan.seo.description.length <= 155);
  assert.ok(!analyserSeo(apres, boutique()).some((x) => x.cible === "page:p/ramadan" && /manquant/.test(x.message)));
});

test("accessibilité : contraste du thème et d'un bloc, champ sans libellé dans un design", () => {
  const cfg = saine() as any;
  cfg.colors.texte = "#aaaaaa";
  trouver(cfg, "text").style = { typography: { color: "#cccccc" } };
  cfg.builderTree[5].children[0].children[0].children.push({ id: "emb", type: "embed-html", config: { html: '<form><input type="email" placeholder="Votre email"></form><a class="x"></a>' } });
  const p = analyserAccessibilite(cfg, boutique());
  assert.ok(p.some((x) => x.cible === "theme:colors.texte" && x.gravite === "critique"));
  assert.ok(p.some((x) => x.domaine === "accessibilite" && /#cccccc/.test(x.message)));
  assert.ok(p.some((x) => /champ de formulaire sans libellé/.test(x.message)));
  assert.ok(p.some((x) => /sans texte ni aria-label/.test(x.message)));
});

test("performance : polices multiples, vidéo automatique, image lourde, scripts", () => {
  const cfg = saine() as any;
  cfg.fonts = { titre: "archivo", corps: "inter" };
  cfg.axsoDesignPolices = { titre: "playfair", corps: "lora" };
  cfg.builderTree[1].children[0].children[0].children.push(bloc("video", { videoUrl: "https://exemple.com/v.mp4", autoplay: true }));
  const b = { ...boutique(), medias: [{ url: "https://exemple.com/hero.jpg", octets: 2_000_000 }], scripts: { octets: 50_000, pixels: 4 } };
  const p = analyserPerformance(cfg, b);
  assert.ok(p.some((x) => x.cible === "theme:fonts"));
  assert.ok(p.some((x) => /lecture automatique/.test(x.message)));
  assert.ok(p.some((x) => x.gravite === "critique" && /1953 Ko/.test(x.message)));
  assert.ok(p.some((x) => /Scripts de suivi/.test(x.message)));
  assert.ok(!JSON.stringify(p).includes("<script"));
});

test("conversion : pas d'action, pas de preuve, faux prix barré, chiffres réels", () => {
  const cfg = saine() as any;
  cfg.builderTree = cfg.builderTree.filter((s: BlockNode) => s.id !== "preuve");
  for (const s of cfg.builderTree) for (const r of s.children) for (const c of r.children) c.children = c.children.filter((w: BlockNode) => w.type !== "button");
  const b = boutique();
  b.produits[1].prixCompare = 20000;
  const p = analyserConversion(cfg, b, { visites: 1000, commandes: 2, ajoutsPanier: 50 });
  assert.ok(p.some((x) => x.gravite === "critique" && /Aucun bouton d'action/.test(x.message)));
  assert.ok(p.some((x) => /4 avis clients approuvés/.test(x.message)));
  assert.ok(p.some((x) => /prix barré/.test(x.message)));
  assert.ok(p.some((x) => /0.20 %/.test(x.message)));
  assert.ok(p.some((x) => /ajouts au panier/.test(x.message)));
});

test("design/UX : galerie trouée (correction qui retire les vides), image vide, section vide", () => {
  const cfg = saine() as any;
  cfg.builderTree[1].children[0].children[0].children.push(bloc("gallery", { images: ["https://exemple.com/a.jpg", ""] }), bloc("image", { url: "" }));
  cfg.builderTree.push({ id: "vide", type: "section", config: { zone: "template" }, children: [] });
  const p = analyserDesign(cfg, boutique());
  assert.ok(p.some((x) => x.gravite === "critique" && /galerie/.test(x.message)));
  assert.ok(p.some((x) => /Aucune image/.test(x.message)));
  assert.ok(p.some((x) => x.cible === "vide"));
});

test("score de santé : borné 0-100, marque prise en compte seulement si évaluée", () => {
  const pire: Probleme[] = Array.from({ length: 30 }, () => ({ gravite: "critique", domaine: "seo", cible: "x", message: "m", correction: null }));
  const s = scoreSante(pire);
  assert.equal(s.domaines.seo, 0);
  assert.ok(s.global >= 0 && s.global <= 100);
  assert.equal(scoreSante([], 40).global, Math.round((100 * 7 + 40) / 8));
  assert.equal(scoreSante([], 250).domaines.marque, 100);
  assert.equal(scoreSante([]).domaines.marque, null);
});

test("format : { gravite, domaine, cible, message, correction } ; correction = opération existante aux paramètres acceptés", () => {
  const cfg = saine() as any;
  cfg.colors.texte = "#bbbbbb";
  trouver(cfg, "button").config.taille = "sm";
  trouver(cfg, "heading").style = { typography: { taille: "64px" } };
  trouver(cfg, "text").style = { typography: { color: "#dddddd" } };
  cfg.builderTree[1].children[0].children[0].children.push(bloc("gallery", { images: ["https://exemple.com/a.jpg", ""] }));
  cfg.pagesPerso = { ete: { nom: "Été", builderTree: [section("e1", "template", [bloc("text", { texte: "Court." })])] } };
  const tous = toutAnalyser(cfg, boutique());
  assert.ok(tous.length > 0);
  for (const p of tous) {
    assert.deepEqual(Object.keys(p).sort(), ["cible", "correction", "domaine", "gravite", "message"]);
    assert.ok(["info", "attention", "critique"].includes(p.gravite));
    if (!p.correction) continue;
    const op = OPERATIONS_PAR_NOM.get(p.correction.op);
    assert.ok(op, p.correction.op);
    for (const k of Object.keys(p.correction.args)) assert.ok(k in op!.parameters.properties, `${p.correction.op}.${k}`);
    // Appliquée telle quelle par l'opération réelle : ni refus, ni erreur.
    assert.doesNotThrow(() => op!.appliquer(clone(cfg), p.correction!.args, DONNEES), `${p.correction.op} ${JSON.stringify(p.correction.args)}`);
  }
  assert.ok(tous.filter((p) => p.correction).length >= 3);
});

test("validation globale : structure refusée ou problème critique → pas prêt", () => {
  const cfg = saine();
  assert.equal(verdict(cfg, cfg, []).pret, true);
  const casse = clone(cfg) as any;
  casse.builderTree.push({ id: "z", type: "inventé", children: [] });
  const v = verdict(casse, cfg, []);
  assert.equal(v.pret, false);
  assert.ok(v.structure.some((e) => /inconnu/.test(e)));
  assert.equal(verdict(cfg, cfg, [{ gravite: "critique", domaine: "ux", cible: "x", message: "m", correction: null }]).pret, false);
});

test("liens : internes, externes, cassés", () => {
  const cfg = saine() as any, b = boutique();
  cfg.pagesPerso = { ete: { nom: "Été", builderTree: [] } };
  assert.equal(lienCasse("produits", cfg, b), null);
  assert.equal(lienCasse("/ndop/collections/wax", cfg, b), null);
  assert.equal(lienCasse("https://wa.me/237", cfg, b), null);
  assert.equal(lienCasse("p/ete", cfg, b), null);
  assert.match(lienCasse("p/hiver", cfg, b)!, /inexistante/);
  assert.match(lienCasse("produits/zzz", cfg, b)!, /introuvable/);
  assert.equal(lienCasse("#", cfg, b), "lien vide");
  assert.equal(lienCasse(null, cfg, b), "élément cliquable sans adresse");
});

test("axso_builder_update_seo : texte brut borné, renommage qui suit les liens", () => {
  const op = OPERATIONS_PAR_NOM.get("axso_builder_update_seo")!;
  const cfg = { ...saine(), pagesPerso: { promo: { nom: "Promo", builderTree: [section("s", "template", [bloc("button", { texte: "Voir", lien: "p/promo" })])] } } } as any;
  cfg.builderTree[1].children[0].children[0].children.push(bloc("button", { texte: "Promo", lien: "/ndop/p/promo" }));
  assert.throws(() => op.appliquer(clone(cfg), { page: "promo", titre: "<b>x</b>" }, {} as any), /HTML/);
  assert.throws(() => op.appliquer(clone(cfg), { page: "absente", titre: "x" }, {} as any), /introuvable/);
  assert.throws(() => op.appliquer(clone(cfg), { page: "promo", nouveau_slug: "Pas Bon" }, {} as any), /minuscules/);
  const r = op.appliquer(clone(cfg), { page: "promo", titre: "Promo d'été | NDOP", noindex: true, nouveau_slug: "promo-ete" }, {} as any) as any;
  assert.equal(r.pagesPerso.promo, undefined);
  assert.deepEqual(r.pagesPerso["promo-ete"].seo, { titre: "Promo d'été | NDOP", noindex: true });
  const json = JSON.stringify(r);
  assert.ok(json.includes('"p/promo-ete"') && json.includes('"/ndop/p/promo-ete"') && !/p\/promo"/.test(json));
});
