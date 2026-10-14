// AXSO CONTROL — reçus : seuls les champs modifiés sont gardés ; une annulation n'écrase jamais
// une modification faite entre-temps ; le verrou `version` ne tolère aucun écart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { borner, ciblesDe, diff, irreversible, memeVersion, preparerAnnulation, typesCrees } from "@/lib/controle-ia/recus";

const T = "tenant_1";
const clone = <V>(v: V): V => JSON.parse(JSON.stringify(v));

test("diff : seulement les champs modifiés, lisibles", () => {
  const avant = { nom: "Robe", prix: 19900, prixCompare: null, tags: ["a"], actif: true };
  const d = diff(avant, { ...avant, prix: 22900, tags: ["a", "b"] });
  assert.deepEqual(d, { avant: { prix: 19900, tags: ["a"] }, apres: { prix: 22900, tags: ["a", "b"] } });
  assert.deepEqual(diff(avant, clone(avant)), { avant: {}, apres: {} });
});

test("diff : JSON imbriqué, clé ajoutée ou retirée, ordre des clés indifférent", () => {
  const avant = { themeConfig: { colors: { accent: "#111111", fond: "#ffffff" }, fonts: { titre: "Inter" }, vieux: 1 } };
  const apres = { themeConfig: { fonts: { titre: "Inter" }, colors: { fond: "#ffffff", accent: "#ff0000" }, radius: "lg" } };
  assert.deepEqual(diff(avant, apres), {
    avant: { "themeConfig.colors.accent": "#111111", "themeConfig.vieux": 1 },
    apres: { "themeConfig.colors.accent": "#ff0000", "themeConfig.radius": "lg" },
  });
});

test("diff : blocs d'une page comparés par id ; structure changée → tableau entier", () => {
  const arbre = [{ id: "s1", type: "hero", config: { titre: "Bonjour" } }, { id: "s2", type: "texte", config: { titre: "B" } }];
  const modifie = clone(arbre); modifie[1].config.titre = "C";
  assert.deepEqual(diff({ t: { builderTree: arbre } }, { t: { builderTree: modifie } }), {
    avant: { "t.builderTree[s2].config.titre": "B" }, apres: { "t.builderTree[s2].config.titre": "C" },
  });
  const d = diff({ arbre }, { arbre: [arbre[1], arbre[0]] });
  assert.deepEqual(Object.keys(d.avant), ["arbre"]);
});

test("diff : long texte → seul le passage modifié est gardé, et l'annulation rend le texte exact", () => {
  const html = `<section>${"<p>bloc 😀 de texte</p>".repeat(400)}</section>`;
  const apres = html.replace("bloc 😀", "bloc 😁");
  const d = diff({ c: { html } }, { c: { html: apres } });
  // l'emoji n'est pas coupé en deux (les deux partagent leur première moitié UTF-16)
  assert.deepEqual([d.avant["c.html"]["~extrait"], d.apres["c.html"]["~extrait"]], ["😀", "😁"]);
  const p = preparerAnnulation({ c: { html: apres } }, d.avant, d.apres);
  assert.deepEqual(p.conflits, []);
  assert.equal(p.data.c.html, html);
  // un seul caractère changé ailleurs dans le texte : conflit
  assert.deepEqual(preparerAnnulation({ c: { html: apres.replace("<section>", "<section >") } }, d.avant, d.apres).conflits, ["c.html"]);
});

test("diff : grosse valeur compressée, restaurée à l'identique ; reçu hors borne → valeur omise, non annulable", () => {
  const gros = Array.from({ length: 300 }, (_, i) => ({ n: i, texte: `ligne ${i} ${Math.sin(i)}` }));
  const d = diff({ arbre: gros }, { arbre: gros.slice(1) });
  assert.ok(d.avant.arbre["~gz"]);
  assert.deepEqual(preparerAnnulation({ arbre: gros.slice(1) }, d.avant, d.apres).data.arbre, gros);

  const alea = (n: number) => Array.from({ length: n }, () => Math.random().toString(36).slice(2)).join("");
  const enorme = diff({ arbre: [alea(20000)] }, { arbre: [alea(20000), "x"] });
  const recu = borner({ ressources: [{ type: "boutique", id: T }], avant: { [`boutique:${T}`]: enorme.avant }, apres: { [`boutique:${T}`]: enorme.apres } });
  assert.ok(JSON.stringify(recu).length < 1000);
  const p = preparerAnnulation({ arbre: [] }, recu.avant[`boutique:${T}`], recu.apres[`boutique:${T}`]);
  assert.deepEqual([p.laisses, p.restaures, p.conflits], [["arbre"], [], []]);
});

test("annulation : restaure si l'état vaut encore « après », en gardant ce que d'autres ont changé ailleurs", () => {
  const avant = { prix: 19900, prixCompare: 25000, themeConfig: { colors: { accent: "#111111" }, fonts: { titre: "Inter" } } };
  const apres = { prix: 22900, prixCompare: null, themeConfig: { colors: { accent: "#ff0000" }, fonts: { titre: "Inter" }, radius: "lg" } };
  const d = diff(avant, apres);
  // entre-temps le marchand a changé la police : champ non touché par l'action, il est conservé
  const actuel = clone(apres); actuel.themeConfig.fonts.titre = "Poppins";
  const p = preparerAnnulation(actuel, d.avant, d.apres);
  assert.deepEqual(p.conflits, []);
  assert.deepEqual(p.data, { prix: 19900, prixCompare: 25000, themeConfig: { colors: { accent: "#111111" }, fonts: { titre: "Poppins" } } });
});

test("annulation : un champ modifié depuis → conflit qui le nomme, rien à écrire", () => {
  const d = diff({ prix: 19900, nom: "A", cfg: { a: 1 } }, { prix: 22900, nom: "B", cfg: { a: 1, b: 2 } });
  const p = preparerAnnulation({ prix: 21000, nom: "B", cfg: { a: 1, b: 3 } }, d.avant, d.apres);
  assert.deepEqual(p.conflits.sort(), ["cfg.b", "prix"]);
  assert.deepEqual(p.data, {});
  // bloc supprimé depuis : on ne recrée rien
  const b = diff({ arbre: [{ id: "s1", t: "a" }] }, { arbre: [{ id: "s1", t: "b" }] });
  assert.deepEqual(preparerAnnulation({ arbre: [] }, b.avant, b.apres).conflits, ["arbre[s1].t"]);
});

test("annulation : un champ figé (stock) est montré mais jamais restauré", () => {
  const d = diff({ stock: 10, prix: 100 }, { stock: 7, prix: 120 });
  const p = preparerAnnulation({ stock: 5, prix: 120 }, d.avant, d.apres, ["stock"]);
  assert.deepEqual([p.conflits, p.laisses, p.data], [[], ["stock"], { prix: 100 }]);
});

test("outil → ressource : table, puis convention de nom de paramètre", () => {
  assert.deepEqual(ciblesDe(T, "mettre_a_jour_prix", { produitId: "p1", prix: 10 }), [{ type: "produit", id: "p1" }]);
  assert.deepEqual(ciblesDe(T, "modifier_fiche_produit", { actions: [] }), [{ type: "boutique", id: T }]);
  assert.deepEqual(ciblesDe(T, "modifier_couleurs", { accent: "#000000" }), [{ type: "boutique", id: T }]);
  // outils écrits par d'autres, inconnus de la table
  assert.deepEqual(ciblesDe(T, "update_product", { product_id: "p1" }), [{ type: "produit", id: "p1" }]);
  assert.deepEqual(ciblesDe(T, "archive_product", { id: "p1" }), [{ type: "produit", id: "p1" }]);
  assert.deepEqual(ciblesDe(T, "bulk_update_prices", { productIds: ["p1", "p2", "p1", 3] }), [{ type: "produit", id: "p1" }, { type: "produit", id: "p2" }]);
  assert.deepEqual(ciblesDe(T, "pause_campaign", { campaign_id: "c1" }), [{ type: "campagne", id: "c1" }]);
  assert.deepEqual(ciblesDe(T, "update_customer", { customer_id: "k1" }), [{ type: "client", id: "k1" }]);
  assert.deepEqual(ciblesDe(T, "adjust_inventory", { product_id: "p1", delta: -2 }), [{ type: "produit", id: "p1" }]);
  assert.deepEqual(ciblesDe(T, "update_theme", { colors: {} }), [{ type: "boutique", id: T }]);
  assert.deepEqual(ciblesDe(T, "update_page", { page: "about" }), [{ type: "boutique", id: T }]);
  // l'élément désigné par un id passe avant la boutique (verrou `version`)
  assert.equal(ciblesDe(T, "update_product_page", { product_id: "p1" })[0].type, "produit");
  // jamais d'autre boutique que celle de la connexion, rien pour un outil sans cible
  assert.deepEqual(ciblesDe(T, "update_theme", { tenantId: "autre", boutique_id: "autre" }), [{ type: "boutique", id: T }]);
  assert.deepEqual(ciblesDe(T, "find_suppliers", { query: "robes" }), []);
});

test("créations reconnues par le nom ; actions irréversibles par nature", () => {
  assert.deepEqual(typesCrees("ajouter_produit"), ["produit"]);
  assert.deepEqual(typesCrees("create_campaign"), ["campagne"]);
  assert.deepEqual(typesCrees("update_product"), []);
  for (const o of ["envoyer_campagne_email", "envoyer_email_client", "payer_commission_affilie", "router_commande_fournisseur", "generer_post_social", "send_campaign", "refund_order", "launch_campaign", "changer_statut_commande"]) {
    assert.equal(irreversible(o), true, o);
  }
  for (const o of ["mettre_a_jour_prix", "publier_boutique", "update_product", "modifier_theme", "update_campaign"]) assert.equal(irreversible(o), false, o);
});

test("version : même instant quel que soit le format, tolérance zéro", () => {
  const u = new Date("2026-10-13T08:30:15.123Z");
  assert.equal(memeVersion("2026-10-13T08:30:15.123Z", u), true);
  assert.equal(memeVersion("2026-10-13T09:30:15.123+01:00", u), true);
  assert.equal(memeVersion("2026-10-13T08:30:15.123", u), true); // sans fuseau : UTC
  assert.equal(memeVersion(u.getTime(), u), true);
  assert.equal(memeVersion(String(u.getTime()), u), true);
  assert.equal(memeVersion(u, u), true);
  assert.equal(memeVersion("2026-10-13T08:30:15.124Z", u), false);
  assert.equal(memeVersion("2026-10-13T08:30:15Z", u), false);
  assert.equal(memeVersion("2026-10-13T08:30:15.122Z", u), false);
  assert.equal(memeVersion("hier", u), null);
  assert.equal(memeVersion("", u), null);
});
