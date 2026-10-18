// Live Academy — règles pures : fenêtre d'accès au lien de salle, rappels, places, certificat
// de bootcamp, permissions de la communauté, fournisseurs de visio, fuseaux horaires.
// La capacité ATOMIQUE (deux inscriptions simultanées) est vérifiée en base dans les tests réels.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fenetreAcces, rappelsDus, placesRestantes, eligibleCertificat, peutCommunaute, seances, dateDansFuseau, versLocal, lireRecurrence } from "@/lib/live/regles";
import { salle, lienValide, FOURNISSEURS, nouvelleSalleJitsi } from "@/lib/live/visio";

const H = 3_600_000, M = 60_000;
const debut = new Date("2026-11-02T17:00:00Z");
const ev = { id: "ev1", debut, dureeMin: 60, statut: "programme", ouvertureMin: 15, rappels: [1440, 60], recurrence: null as unknown, createdAt: new Date(debut.getTime() - 5 * 24 * H) };

test("fenêtre : lien caché au non-inscrit, avant l'ouverture, après la fin, si annulé", () => {
  assert.deepEqual(fenetreAcces(ev, false, debut), { ouvert: false, raison: "non_inscrit" });
  const tot = fenetreAcces(ev, true, new Date(debut.getTime() - 16 * M));
  assert.equal(tot.ouvert, false);
  assert.equal(!tot.ouvert && tot.raison, "trop_tot");
  assert.equal(fenetreAcces(ev, true, new Date(debut.getTime() - 15 * M)).ouvert, true);
  assert.equal(fenetreAcces(ev, true, new Date(debut.getTime() + 89 * M)).ouvert, true); // 60 min + 30 de grâce
  assert.equal(fenetreAcces(ev, true, new Date(debut.getTime() + 91 * M)).ouvert, false);
  assert.equal(fenetreAcces({ ...ev, statut: "annule" }, true, debut).ouvert, false);
  assert.equal(fenetreAcces({ ...ev, statut: "termine" }, true, debut).ouvert, false);
  // L'organisateur passe « en direct » en avance : la salle s'ouvre.
  assert.equal(fenetreAcces({ ...ev, statut: "en_direct" }, true, new Date(debut.getTime() - H)).ouvert, true);
});

test("classe récurrente : séances hebdomadaires, la fenêtre suit la séance courante", () => {
  const classe = { ...ev, recurrence: { frequence: "hebdomadaire", occurrences: 3 } };
  const s = seances(classe);
  assert.equal(s.length, 3);
  assert.equal(s[2].getTime() - s[0].getTime(), 14 * 24 * H);
  const f = fenetreAcces(classe, true, new Date(s[1].getTime() + 5 * M));
  assert.ok(f.ouvert && f.occurrence === 1);
  assert.equal(fenetreAcces(classe, true, new Date(s[0].getTime() + 3 * H)).ouvert, false); // entre deux séances
  assert.equal(lireRecurrence({ frequence: "mensuelle", occurrences: 3 }), null);
  assert.equal(lireRecurrence({ frequence: "quotidienne", occurrences: 999 })?.occurrences, 52);
});

test("rappels : dus à l'heure, un seul par séance, rattrapés en retard, jamais en double ni après le début", () => {
  assert.deepEqual(rappelsDus(ev, new Set(), new Date(debut.getTime() - 25 * H)), []);
  assert.deepEqual(rappelsDus(ev, new Set(), new Date(debut.getTime() - 23 * H)).map((r) => r.minutes), [1440]);
  // Cron en retard : seul le plus proche (H-1) part, pas J-1 puis H-1.
  assert.deepEqual(rappelsDus(ev, new Set(), new Date(debut.getTime() - 30 * M)).map((r) => r.minutes), [60]);
  assert.deepEqual(rappelsDus(ev, new Set(["ev1:0:60"]), new Date(debut.getTime() - 30 * M)), []);
  assert.deepEqual(rappelsDus(ev, new Set(["ev1:0:1440"]), new Date(debut.getTime() - 30 * M)).map((r) => r.cle), ["ev1:0:60"]);
  assert.deepEqual(rappelsDus(ev, new Set(), new Date(debut.getTime() + M)), []);
  assert.deepEqual(rappelsDus({ ...ev, statut: "annule" }, new Set(), new Date(debut.getTime() - 30 * M)), []);
  // Événement créé 2 h avant : le rappel J-1 n'a pas de sens, H-1 oui.
  const tardif = { ...ev, createdAt: new Date(debut.getTime() - 2 * H) };
  assert.deepEqual(rappelsDus(tardif, new Set(), new Date(debut.getTime() - 90 * M)), []);
  assert.deepEqual(rappelsDus(tardif, new Set(), new Date(debut.getTime() - 50 * M)).map((r) => r.minutes), [60]);
});

test("places restantes et certificat conditionnel", () => {
  assert.equal(placesRestantes(null, 500), null);
  assert.equal(placesRestantes(10, 10), 0);
  assert.equal(placesRestantes(10, 12), 0);
  assert.equal(placesRestantes(10, 3), 7);
  const base = { seancesTotal: 4, presences: 3, missionsTotal: 2, missionsValidees: 2, seuilPresence: 75, seuilMissions: 100 };
  assert.equal(eligibleCertificat(base).eligible, true);
  assert.equal(eligibleCertificat({ ...base, presences: 2 }).eligible, false);
  assert.equal(eligibleCertificat({ ...base, missionsValidees: 1 }).eligible, false);
  assert.equal(eligibleCertificat({ ...base, seancesTotal: 0, missionsTotal: 0 }).eligible, true);
});

test("communauté : non-inscrit sans droit, apprenant/mentor/formateur selon leur rôle", () => {
  for (const a of ["lire", "ecrire", "reagir", "signaler"] as const) assert.equal(peutCommunaute(null, a), false);
  assert.equal(peutCommunaute("apprenant", "ecrire"), true);
  assert.equal(peutCommunaute("apprenant", "annonce"), false);
  assert.equal(peutCommunaute("apprenant", "moderer"), false);
  assert.equal(peutCommunaute("apprenant", "resoudre"), false);
  assert.equal(peutCommunaute("mentor", "resoudre"), true);
  assert.equal(peutCommunaute("mentor", "moderer"), false);
  assert.equal(peutCommunaute("formateur", "annonce"), true);
  assert.equal(peutCommunaute("formateur", "moderer"), true);
  assert.equal(peutCommunaute("formateur", "reserver"), false);
  // Espace fermé : lecture seule pour les inscrits, le formateur garde la main.
  assert.equal(peutCommunaute("apprenant", "ecrire", false), false);
  assert.equal(peutCommunaute("apprenant", "lire", false), true);
  assert.equal(peutCommunaute("formateur", "moderer", false), true);
});

test("visio : lien externe https seulement, Jitsi non devinable, fournisseurs non configurés jamais simulés", () => {
  assert.equal(lienValide("https://zoom.us/j/123"), true);
  assert.equal(lienValide("http://zoom.us/j/123"), false);
  assert.equal(lienValide("javascript:alert(1)"), false);
  assert.equal(lienValide("https://user:pass@zoom.us/j/1"), false);
  assert.deepEqual(salle({ fournisseur: "lien_externe", lienSalle: "https://meet.google.com/abc-defg-hij", salleId: null }), { url: "https://meet.google.com/abc-defg-hij", integrable: false, fournisseur: FOURNISSEURS.lien_externe.nom });
  assert.equal(salle({ fournisseur: "lien_externe", lienSalle: null, salleId: null }), null);
  const id = nouvelleSalleJitsi();
  assert.match(id, /^axso-[a-f0-9]{32}$/);
  delete process.env.JITSI_DOMAIN;
  const j = salle({ fournisseur: "jitsi", lienSalle: null, salleId: id }, "Awa");
  assert.ok(j && j.url.startsWith(`https://meet.jit.si/${id}`) && !j.integrable); // meet.jit.si : nouvel onglet
  for (const f of ["livekit", "daily", "zoom_api"] as const) {
    assert.equal(FOURNISSEURS[f].configure(), false);
    assert.ok(FOURNISSEURS[f].env.length > 0);
    assert.equal(salle({ fournisseur: f, lienSalle: "https://x.example", salleId: "s" }), null);
  }
});

test("fuseau : Afrique/Douala (UTC+1) par défaut, aller-retour exact", () => {
  assert.equal(dateDansFuseau("2026-11-02T18:00").toISOString(), "2026-11-02T17:00:00.000Z");
  assert.equal(dateDansFuseau("2026-11-02T18:00", "Africa/Abidjan").toISOString(), "2026-11-02T18:00:00.000Z");
  assert.equal(versLocal(new Date("2026-11-02T17:00:00Z")), "2026-11-02T18:00");
  assert.equal(versLocal(dateDansFuseau("2026-07-01T09:30", "Europe/Paris"), "Europe/Paris"), "2026-07-01T09:30");
});
