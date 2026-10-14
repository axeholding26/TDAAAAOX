// Builder — pages libres, sections, composants, contenu, liaisons produits : chaque opération
// pure (cas nominal, id inconnu, règle d'imbrication), le validateur de config et la
// construction des requêtes de liaison. Le résultat doit aussi passer la validation du moteur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPERATIONS, planPourIntention, validerConfigBloc } from "@/lib/builder/operations/structure";
import { requeteLiaison, selectionner } from "@/lib/builder/liaisons";
import { validerConfig } from "@/lib/builder/validation";
import { ErreurBuilder, type DonneesBoutique } from "@/lib/builder/types";
import type { BlockNode } from "@/lib/theme-config";

const D: DonneesBoutique = { slug: "demo", nom: "Demo", devise: "XAF", collections: [{ slug: "ramadan", nom: "Ramadan" }], produits: [{ id: "p1", nom: "Robe" }] };
const clone = <V>(v: V): V => JSON.parse(JSON.stringify(v));
const sectionDe = (id: string, widget: BlockNode, zone = "template"): BlockNode =>
  ({ id, type: "section", config: { nom: id, zone }, children: [{ id: `${id}_r`, type: "row", children: [{ id: `${id}_c`, type: "column", children: [widget] }] }] });
const BASE: any = {
  builderTree: [
    sectionDe("h", { id: "logo", type: "heading", config: { texte: "Logo", niveau: "h3", align: "left" } }, "header"),
    sectionDe("s1", { id: "titre", type: "heading", config: { texte: "Bienvenue", niveau: "h1", align: "center" } }),
    sectionDe("s2", { id: "riche", type: "richtext", config: { titre: "Notre histoire", texte: "Texte", ctaTexte: "", ctaLien: "" }, style: { spacing: { pt: "10px" } } }),
    sectionDe("f", { id: "bas", type: "text", config: { texte: "©", style: "corps", align: "left" } }, "footer"),
  ],
};

function run(nom: string, args: Record<string, any>, cfg: any = BASE) {
  const op = OPERATIONS.find((o) => o.nom === nom);
  assert.ok(op, `opération ${nom} absente`);
  const r: any = op.appliquer(clone(cfg), args, D);
  assert.deepEqual(validerConfig(r, cfg), [], "le moteur doit accepter le résultat");
  return r;
}
const echoue = (nom: string, args: Record<string, any>, code: string, cfg: any = BASE) =>
  assert.throws(() => run(nom, args, cfg), (e: unknown) => e instanceof ErreurBuilder && e.code === code);
const ids = (t: BlockNode[]): string[] => t.flatMap((n) => [n.id, ...ids(n.children ?? [])]);
const trouver = (t: BlockNode[], id: string): BlockNode | undefined => { for (const n of t) { if (n.id === id) return n; const r = trouver(n.children ?? [], id); if (r) return r; } };

// ─── Pages ─────────────────────────────────────────────────────────────────────
test("create_page : page libre en brouillon, grille liée à la collection, CTA WhatsApp", () => {
  const r = run("axso_builder_create_page", { nom: "Collection Ramadan", gabarit: "collection", collection: "ramadan", whatsapp: "+237 699 12 34 56" });
  const p = r.pagesPerso["collection-ramadan"];
  assert.equal(p.statut, "brouillon");
  assert.equal(p.visibilite, "publique");
  const produits = ids(p.builderTree).map((i) => trouver(p.builderTree, i)!).find((n) => n.type === "products")!;
  assert.deepEqual([produits.config!.regle, produits.config!.collection], ["collection", "ramadan"]);
  assert.match(JSON.stringify(p.builderTree), /wa\.me\/237699123456/);
  assert.match(JSON.stringify(p.builderTree), /XAF/);
  echoue("axso_builder_create_page", { nom: "X", gabarit: "collection", collection: "inconnue" }, "INVALID_INPUT");
  echoue("axso_builder_create_page", { nom: "X", gabarit: "collection" }, "INVALID_INPUT");
  echoue("axso_builder_create_page", { nom: "X", gabarit: "nimporte" }, "INVALID_INPUT");
  // Même nom : nouvelle adresse, jamais d'écrasement.
  assert.ok(run("axso_builder_create_page", { nom: "Collection Ramadan" }, r).pagesPerso["collection-ramadan-2"]);
});

test("update / duplicate / delete / reorder pages ; pages fixes protégées", () => {
  const avec = run("axso_builder_create_page", { nom: "Promo", gabarit: "promotion" });
  const maj = run("axso_builder_update_page", { page: "p/promo", nouveau_slug: "soldes", statut: "publiee", seo: { titre: "Soldes" } }, avec);
  assert.equal(maj.pagesPerso.promo, undefined);
  assert.deepEqual([maj.pagesPerso.soldes.statut, maj.pagesPerso.soldes.seo.titre], ["publiee", "Soldes"]);
  echoue("axso_builder_update_page", { page: "p/inconnue", statut: "publiee" }, "NOT_FOUND", avec);
  echoue("axso_builder_update_page", { page: "contact", nom: "x" }, "INVALID_INPUT", avec);
  echoue("axso_builder_update_page", { page: "promo", seo: { image: "javascript:alert(1)" } }, "INVALID_INPUT", avec);

  const dup = run("axso_builder_duplicate_page", { page: "promo" }, avec);
  const copie = dup.pagesPerso["promo-copie"];
  assert.equal(copie.statut, "brouillon");
  assert.equal(ids(copie.builderTree).filter((i) => ids(avec.pagesPerso.promo.builderTree).includes(i)).length, 0, "ids neufs");

  echoue("axso_builder_delete_page", { page: "accueil" }, "INVALID_INPUT", avec);
  echoue("axso_builder_delete_page", { page: "a-propos" }, "INVALID_INPUT", avec);
  assert.deepEqual(run("axso_builder_delete_page", { page: "p/promo" }, avec).pagesPerso, {});

  const ord = run("axso_builder_reorder_pages", { ordre: ["promo-copie"] }, dup);
  assert.deepEqual([ord.pagesPerso["promo-copie"].ordre, ord.pagesPerso.promo.ordre], [0, 1]);
  echoue("axso_builder_reorder_pages", { ordre: ["zzz"] }, "NOT_FOUND", dup);
});

// ─── Sections ─────────────────────────────────────────────────────────────────
test("add_section : composants validés, rang dans la zone, imbrication section → ligne → colonne", () => {
  const r = run("axso_builder_add_section", { position: 0, colonnes: 2, composants: [{ type: "heading", config: { texte: "Top" } }, { type: "products", config: { regle: "meilleures_ventes", nombre: 8 } }] });
  const s = r.builderTree[1]; // après l'en-tête, avant s1
  assert.equal(r.builderTree[0].id, "h");
  assert.equal(s.children[0].type, "row");
  assert.deepEqual(s.children[0].children.map((c: BlockNode) => c.children![0].type), ["heading", "products"]);
  echoue("axso_builder_add_section", { composants: [{ type: "section" }] }, "INVALID_INPUT");
  echoue("axso_builder_add_section", { composants: [{ type: "products", config: { regle: "collection", collection: "absente" } }] }, "INVALID_INPUT");
  echoue("axso_builder_add_section", { page: "p/absente" }, "NOT_FOUND");
});

test("update / duplicate / delete / move section", () => {
  const masq = run("axso_builder_update_section", { section_id: "s2", actif: false, nom: "Histoire" });
  assert.deepEqual([masq.builderTree[2].actif, masq.builderTree[2].config.nom], [false, "Histoire"]);
  echoue("axso_builder_update_section", { section_id: "zzz", actif: false }, "NOT_FOUND");
  echoue("axso_builder_update_section", { section_id: "s1_r", actif: false }, "INVALID_INPUT"); // une ligne n'est pas une section

  assert.equal(run("axso_builder_duplicate_section", { section_id: "s1" }).builderTree.length, 5);
  assert.deepEqual(run("axso_builder_delete_section", { section_id: "s1" }).builderTree.map((n: BlockNode) => n.id), ["h", "s2", "f"]);
  echoue("axso_builder_delete_section", { section_id: "titre" }, "INVALID_INPUT");

  assert.deepEqual(run("axso_builder_move_section", { section_id: "s2", position: 0 }).builderTree.map((n: BlockNode) => n.id), ["h", "s2", "s1", "f"]);
  const pied = run("axso_builder_move_section", { section_id: "s1", position: 0, zone: "footer" });
  assert.equal(pied.builderTree.find((n: BlockNode) => n.id === "s1").config.zone, "footer");
  echoue("axso_builder_move_section", { section_id: "zzz", position: 0 }, "NOT_FOUND");
});

test("update_design_element : texte d'un élément data-axs-el, jamais le HTML entier", () => {
  const design = { ...BASE, builderTree: [...BASE.builderTree, { id: "d1", type: "section", config: { nom: "Design" }, children: [{ id: "d1r", type: "row", children: [{ id: "d1c", type: "column", children: [{ id: "emb", type: "embed-html", config: { html: '<section><h1 data-axs-el="el_t">Ancien</h1><p>Sans id</p></section>' } }] }] }] }] };
  const r = run("axso_builder_update_design_element", { actions: [{ action: "texte", element: "el_t", valeur: "Nouveau <b>" }] }, design);
  const html = trouver(r.builderTree, "emb")!.config!.html;
  assert.match(html, /Nouveau &lt;b&gt;/);
  assert.match(html, /<p data-axs-el="el_[a-z0-9]+">Sans id/, "identifiants posés");
  echoue("axso_builder_update_design_element", { actions: [{ action: "texte", element: "el_absent", valeur: "x" }] }, "INVALID_INPUT", design);
  echoue("axso_builder_update_design_element", { actions: [{ action: "lien", element: "el_t", valeur: "javascript:alert(1)" }] }, "INVALID_INPUT", design);
});

// ─── Composants ───────────────────────────────────────────────────────────────
test("add / update / duplicate / delete / move component", () => {
  const r = run("axso_builder_add_component", { parent_id: "s1_c", type: "button", config: { texte: "Acheter", lien: "produits" }, position: 0 });
  assert.equal(trouver(r.builderTree, "s1_c")!.children![0].type, "button");
  // Déposé sur une section : ligne + colonne créées.
  const surSection = run("axso_builder_add_component", { parent_id: "s1", type: "text" });
  assert.equal(trouver(surSection.builderTree, "s1")!.children!.length, 2);
  echoue("axso_builder_add_component", { parent_id: "s1_r", type: "text" }, "INVALID_INPUT"); // une ligne ne contient que des colonnes
  echoue("axso_builder_add_component", { parent_id: "zzz", type: "text" }, "NOT_FOUND");
  echoue("axso_builder_add_component", { parent_id: "s1_c", type: "inventé" }, "INVALID_INPUT");

  assert.equal(trouver(run("axso_builder_update_component", { component_id: "titre", config: { texte: "Salut" } }).builderTree, "titre")!.config!.texte, "Salut");
  echoue("axso_builder_update_component", { component_id: "titre", config: { niveau: "h9" } }, "INVALID_INPUT");
  echoue("axso_builder_update_component", { component_id: "titre", config: { inconnu: 1 } }, "INVALID_INPUT");
  echoue("axso_builder_update_component", { component_id: "zzz", config: {} }, "NOT_FOUND");
  echoue("axso_builder_update_component", { component_id: "s1_c", config: {} }, "INVALID_INPUT"); // conteneur

  assert.equal(trouver(run("axso_builder_duplicate_component", { component_id: "titre" }).builderTree, "s1_c")!.children!.length, 2);
  assert.equal(trouver(run("axso_builder_delete_component", { component_id: "titre" }).builderTree, "titre"), undefined);
  echoue("axso_builder_delete_component", { component_id: "zzz" }, "NOT_FOUND");

  const mv = run("axso_builder_move_component", { component_id: "titre", parent_id: "s2_c", position: 0 });
  assert.deepEqual(trouver(mv.builderTree, "s2_c")!.children!.map((n) => n.id), ["titre", "riche"]);
  echoue("axso_builder_move_component", { component_id: "titre", parent_id: "s2" }, "INVALID_INPUT"); // pas dans une section
});

test("replace_component : même place, style gardé, contenu repris quand il a du sens", () => {
  const r = run("axso_builder_replace_component", { component_id: "riche", type: "heading" });
  const col = trouver(r.builderTree, "s2_c")!;
  assert.equal(col.children!.length, 1);
  const h = col.children![0];
  assert.deepEqual([h.type, h.config!.texte, h.style?.spacing?.pt], ["heading", "Notre histoire", "10px"]);
  echoue("axso_builder_replace_component", { component_id: "zzz", type: "heading" }, "NOT_FOUND");
});

test("styles : base et tablette/mobile, valeurs CSS sûres", () => {
  const r = run("axso_builder_update_style", { node_id: "riche", style: { spacing: { pb: "20px" }, visibility: { mobile: false } } });
  assert.deepEqual(trouver(r.builderTree, "riche")!.style!.spacing, { pt: "10px", pb: "20px" });
  const m = run("axso_builder_update_responsive_style", { node_id: "s1", appareil: "mobile", style: { typography: { taille: "14px" } } });
  assert.equal(trouver(m.builderTree, "s1")!.style!.responsive!.mobile!.typography!.taille, "14px");
  echoue("axso_builder_update_style", { node_id: "riche", style: { spacing: { pt: "1px}body{display:none" } } }, "INVALID_INPUT");
  echoue("axso_builder_update_style", { node_id: "riche", style: { inconnu: {} } }, "INVALID_INPUT");
  echoue("axso_builder_update_responsive_style", { node_id: "s1", appareil: "mobile", style: { visibility: { mobile: false } } }, "INVALID_INPUT");
  echoue("axso_builder_update_responsive_style", { node_id: "s1", appareil: "desktop", style: {} }, "INVALID_INPUT");
  echoue("axso_builder_update_style", { node_id: "zzz", style: {} }, "NOT_FOUND");
});

// ─── Contenu ──────────────────────────────────────────────────────────────────
test("update_content : composants et socle en une fois", () => {
  const r = run("axso_builder_update_content", { modifications: [
    { cible: "titre", champs: { texte: "Bonjour" } },
    { cible: "socle.hero", champs: { titre: "Nouveau héros", ctaTexte: "Go" } },
    { cible: "socle.faq", champs: { titre: "FAQ" } },
  ] });
  assert.equal(trouver(r.builderTree, "titre")!.config!.texte, "Bonjour");
  assert.deepEqual([r.sections.hero.titre, r.sections.hero.ctaTexte], ["Nouveau héros", "Go"]);
  assert.ok(r.sections.faq.items.length > 0, "la FAQ garde ses questions (section remplacée en entier à la résolution)");
  echoue("axso_builder_update_content", { modifications: [{ cible: "socle.hero", champs: { style: "split" } }] }, "INVALID_INPUT");
  echoue("axso_builder_update_content", { modifications: [{ cible: "socle.inconnu", champs: { titre: "x" } }] }, "INVALID_INPUT");
  echoue("axso_builder_update_content", { modifications: [{ cible: "zzz", champs: { texte: "x" } }] }, "NOT_FOUND");
  echoue("axso_builder_update_content", { modifications: [{ cible: "socle.hero", champs: { ctaLien: "javascript:alert(1)" } }] }, "INVALID_INPUT");
});

// ─── Liaisons ─────────────────────────────────────────────────────────────────
test("update_binding / manage_products_display", () => {
  const avec = run("axso_builder_manage_products_display", { regle: "meilleures_ventes", nombre: 8, position: 0 });
  const grille = avec.builderTree[1].children[0].children[0].children[0];
  assert.deepEqual([grille.type, grille.config.regle, grille.config.nombre], ["products", "meilleures_ventes", 8]);
  const lie = run("axso_builder_update_binding", { component_id: grille.id, regle: "collection", collection: "ramadan", colonnes_mobile: 1 }, avec);
  assert.deepEqual([trouver(lie.builderTree, grille.id)!.config!.collection, trouver(lie.builderTree, grille.id)!.config!.colonnesMobile], ["ramadan", 1]);
  echoue("axso_builder_update_binding", { component_id: grille.id, regle: "collection", collection: "absente" }, "INVALID_INPUT", avec);
  echoue("axso_builder_update_binding", { component_id: grille.id, regle: "recherche" }, "INVALID_INPUT", avec);
  echoue("axso_builder_update_binding", { component_id: "titre", regle: "nouveautes" }, "INVALID_INPUT", avec);
  echoue("axso_builder_update_binding", { component_id: grille.id, colonnes: 7 }, "INVALID_INPUT", avec);
  // Dans une colonne existante.
  assert.equal(trouver(run("axso_builder_manage_products_display", { regle: "nouveautes", parent_id: "s1_c" }).builderTree, "s1_c")!.children!.length, 2);
});

test("update_product_page : gabarit commun ou par produit, sections de base protégées", () => {
  const r = run("axso_builder_update_product_page", { actions: [{ action: "ajouter", type: "faq" }, { action: "masquer", section: "reviews" }] });
  assert.ok(r.productPage.sections.some((s: any) => s.type === "faq"));
  assert.equal(r.productPage.sections.find((s: any) => s.type === "reviews").actif, false);
  assert.ok(run("axso_builder_update_product_page", { produit_id: "p1", actions: [{ action: "mise_en_page", layout: "minimal" }] }).productPagesParProduit.p1);
  echoue("axso_builder_update_product_page", { produit_id: "zzz", actions: [{ action: "masquer", section: "reviews" }] }, "NOT_FOUND");
  echoue("axso_builder_update_product_page", { actions: [{ action: "supprimer", section: "gallery" }] }, "INVALID_INPUT");
});

test("validerConfigBloc : clés, types et valeurs du catalogue", () => {
  assert.deepEqual(validerConfigBloc("products", { nombre: "12", regle: "forte_marge", jours: 30 }), { nombre: 12, regle: "forte_marge", jours: 30 });
  assert.throws(() => validerConfigBloc("products", { nombre: 99 }), ErreurBuilder);
  assert.throws(() => validerConfigBloc("products", { regle: "au_hasard" }), ErreurBuilder);
  assert.throws(() => validerConfigBloc("features", { colonnes: 5 }), ErreurBuilder);
  assert.throws(() => validerConfigBloc("features", { items: [{ titre: { imbrique: 1 } }] }), ErreurBuilder);
  assert.throws(() => validerConfigBloc("text", { texte: "<script>alert(1)</script>" }), ErreurBuilder);
  assert.throws(() => validerConfigBloc("section", {}), ErreurBuilder);
  assert.deepEqual(validerConfigBloc("image", { lien: "produits" }), { lien: "produits" }); // champ optionnel (lien?)
  assert.deepEqual(validerConfigBloc("tabs", { onglets: [{ id: "t1", label: "A", blocs: [] }] }).onglets.length, 1);
});

test("requeteLiaison : forte marge, dormants, collection, ancien tri", () => {
  const now = new Date("2026-10-01T00:00:00Z");
  const marge = requeteLiaison({ regle: "forte_marge", nombre: 4 }, "t1", now);
  assert.deepEqual(marge.where, { tenantId: "t1", actif: true, visibleListage: true, cout: { not: null } });
  assert.deepEqual([marge.apres, marge.nombre, marge.take > 4], ["marge", 4, true]);

  const dormants = requeteLiaison({ regle: "dormants", jours: 30 }, "t1", now);
  assert.equal(dormants.ventesDepuis!.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.deepEqual(dormants.where.createdAt, { lt: dormants.ventesDepuis });

  const coll = requeteLiaison({ regle: "collection", collection: "ramadan", tri: "prix_asc" }, "t1", now);
  assert.deepEqual(coll.where.collections, { some: { tenantId: "t1", slug: "ramadan", actif: true } });
  assert.deepEqual(coll.orderBy, { prix: "asc" });

  assert.deepEqual(requeteLiaison({ tri: "ventes", nombre: 99 }, "t1", now).orderBy, { ventes: "desc" });
  assert.equal(requeteLiaison({ nombre: 99 }, "t1", now).take, 24);
  assert.deepEqual(requeteLiaison({ regle: "stock_bas", seuilStock: 3 }, "t1", now).where.stock, { gt: 0, lte: 3 });
});

test("selectionner : ordre des règles calculées", () => {
  const p = (id: string, prix: number, cout: number | null, ventes = 0) => ({ id, prix, cout, _count: { lignesCommande: ventes } });
  const lignes = [p("a", 100, 90, 0), p("b", 100, 20, 5), p("c", 100, 50, 1), p("d", 100, 150, 0)];
  assert.deepEqual(selectionner(lignes, { apres: "marge", nombre: 2 }).map((x) => x.id), ["b", "c"]);
  assert.deepEqual(selectionner(lignes, { apres: "dormants", nombre: 2 }).map((x) => x.id), ["a", "d"]);
  // Médiane des ventes = 0 → seuls a et d sont « peu vendus » ; d a une marge négative.
  assert.deepEqual(selectionner(lignes, { apres: "marge_peu_vendus", nombre: 5 }).map((x) => x.id), ["a"]);
});

test("planPourIntention : plan et collection citée", () => {
  const c = [{ slug: "ramadan", nom: "Ramadan" }, { slug: "rentree", nom: "Rentrée" }];
  assert.deepEqual(planPourIntention("page pour présenter notre collection Ramadan", c), { gabarit: "collection", collection: c[0] });
  assert.equal(planPourIntention("une page de soldes de fin d'année", c).gabarit, "promotion");
  assert.equal(planPourIntention("récolter des contacts pour un devis", c).gabarit, "leads");
  assert.equal(planPourIntention("lancement de notre nouveau parfum", c).gabarit, "lancement");
  assert.equal(planPourIntention("quelque chose de joli", c).gabarit, "presentation");
});
