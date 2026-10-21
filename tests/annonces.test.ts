// Annonces de la bannière « Ma boutique » : sélection par dates/ciblage et validation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { annoncesVisibles, schemaAnnonce } from "@/lib/annonces";

const base = { active: true, debut: null, fin: null, pays: [] as string[], plans: [] as string[] };
const maintenant = new Date("2026-10-21T12:00:00Z");
const ids = (l: { id: string }[]) => l.map((a) => a.id);

test("active, dates et ciblage pays/palier (vide = tout le monde)", () => {
  const annonces = [
    { ...base, id: "tous" },
    { ...base, id: "off", active: false },
    { ...base, id: "futur", debut: new Date("2026-10-22T00:00:00Z") },
    { ...base, id: "fini", fin: new Date("2026-10-21T11:00:00Z") },
    { ...base, id: "encours", debut: new Date("2026-10-01T00:00:00Z"), fin: new Date("2026-11-01T00:00:00Z") },
    { ...base, id: "sn", pays: ["SN"] },
    { ...base, id: "cm", pays: ["CM", "CI"] },
    { ...base, id: "pro", plans: ["palier1"] },
    { ...base, id: "gratuit", plans: ["palier0"] },
  ];
  assert.deepEqual(ids(annoncesVisibles(annonces, { pays: "CM", planType: "gratuit" }, maintenant)), ["tous", "encours", "cm", "gratuit"]);
  assert.deepEqual(ids(annoncesVisibles(annonces, { pays: "SN", planType: "palier1" }, maintenant)), ["tous", "encours", "sn", "pro"]);
});

const valide = { marque: "KREADS", titre: "Titre", texte: "Texte", cta: "Voir", lien: "https://kreads-two.vercel.app/", logo: "", fond: "linear-gradient(120deg,#111111 0%,#2A1E0A 100%)", accent: "#F5A623", ordre: 0, active: true, debut: "", fin: null, pays: [], plans: [] };

test("validation : liens, couleurs, textes, dates", () => {
  const ok = schemaAnnonce.safeParse(valide);
  assert.ok(ok.success);
  assert.equal(ok.data.logo, null);
  assert.equal(ok.data.debut, null);
  assert.ok(schemaAnnonce.safeParse({ ...valide, lien: "/dashboard/axia", fond: "#052E16" }).success);
  for (const mauvais of [
    { lien: "http://exemple.com" }, { lien: "javascript:alert(1)" }, { lien: "//evil.com" },
    { fond: "url(https://x.y/a.png)" }, { fond: "linear-gradient(120deg,#111 0%,red 100%)" }, { accent: "linear-gradient(120deg,#111 0%,#222 100%)" },
    { titre: "x".repeat(91) }, { cta: " " }, { plans: ["premium"] }, { pays: ["cm"] },
    { debut: "2026-11-01T00:00:00.000Z", fin: "2026-10-01T00:00:00.000Z" },
  ]) assert.equal(schemaAnnonce.safeParse({ ...valide, ...mauvais }).success, false, JSON.stringify(mauvais));
});
