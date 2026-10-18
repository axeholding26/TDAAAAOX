// Rapports du Command Center (lib/command-center/rapports.ts) : calendrier d'envoi,
// fenêtres, construction sur les données de démo, échappement HTML. Lancé par `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estDu, fenetreFrequence, construireRapport, rapportEnHtml, TYPES_RAPPORT } from "@/lib/command-center/rapports";
import { genererDemo } from "@/lib/command-center/demo";
import { Vue } from "@/lib/command-center/moteur";
import { fenetres, lireFiltres, JOUR } from "@/lib/command-center/contexte";
import { REGLAGES_DEFAUT } from "@/lib/command-center/reglages";
import { statsMarchands, radarChurn, radarExpansion, impactFonctions, alertes, variations, priorites } from "@/lib/command-center/insights";

test("calendrier : quotidien chaque jour, hebdo le lundi, mensuel le 1er (UTC)", () => {
  const lundi1er = Date.UTC(2026, 5, 1, 6); // lundi 1er juin 2026
  const mardi = Date.UTC(2026, 5, 2, 6);
  assert.ok(estDu("quotidien", mardi));
  assert.ok(estDu("hebdomadaire", lundi1er) && !estDu("hebdomadaire", mardi));
  assert.ok(estDu("mensuel", lundi1er) && !estDu("mensuel", mardi));
});

test("fenêtres : hier = jour civil précédent, mensuel = mois civil précédent", () => {
  const t = Date.UTC(2026, 0, 15, 9);
  const h = fenetreFrequence("quotidien", t);
  assert.equal(h.cur.debut, Date.UTC(2026, 0, 14));
  assert.equal(h.cur.fin - h.cur.debut, JOUR);
  const m = fenetreFrequence("mensuel", t);
  assert.equal(m.cur.debut, Date.UTC(2025, 11, 1));
  assert.equal(m.cur.fin, Date.UTC(2026, 0, 1));
  assert.equal(m.prev.debut, Date.UTC(2025, 10, 1));
});

test("chaque rapport se construit sur la démo et s'échappe en HTML", () => {
  const ds = genererDemo();
  const v = new Vue(ds, {});
  const f = fenetres(lireFiltres({}), ds.genereA);
  const r = REGLAGES_DEFAUT;
  const stats = statsMarchands(v), churn = radarChurn(v, stats, r.poids_sante), expansion = radarExpansion(v, stats), fonctions = impactFonctions(v, f);
  const al = alertes(v, f, r, churn, expansion, fonctions);
  const a = { stats, churn, expansion, fonctions, alertes: al, priorites: priorites(al, churn, expansion, variations(v, f)) };
  for (const type of TYPES_RAPPORT) {
    const rp = construireRapport(type, v, type === "quotidien" ? fenetreFrequence("quotidien", v.maintenant) : f, a, r);
    assert.ok(rp.sections.length > 0, type);
    for (const s of rp.sections) for (const t of s.tableaux ?? []) for (const l of t.lignes) assert.ok(l._id, `${type}/${t.id}`);
    const html = rapportEnHtml({ ...rp, titre: "<script>x</script>" }, "https://axso.test");
    assert.ok(!html.includes("<script>") && html.includes("&lt;script&gt;"));
  }
});
