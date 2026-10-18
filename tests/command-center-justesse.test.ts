// Command Center : justesse des calculs corrigés (fuseau de Douala, score santé sans critère inventé, cohortes).
import { test } from "node:test";
import assert from "node:assert/strict";
import { debutJour, debutAnnee, debutSemaine, fenetres, lireFiltres, JOUR } from "@/lib/command-center/contexte";
import { Vue } from "@/lib/command-center/moteur";
import { santeMarchand, statsMarchands, cohortes } from "@/lib/command-center/insights";
import { REGLAGES_DEFAUT } from "@/lib/command-center/reglages";
import type { Dataset, Marchand } from "@/lib/command-center/types";

const H = 3_600_000;

test("jours, semaines et années à l'heure de Douala (UTC+1)", () => {
  // 23 h 30 UTC le 17 = 00 h 30 le 18 à Douala : on est déjà le 18.
  assert.equal(debutJour(Date.UTC(2026, 9, 17, 23, 30)), Date.UTC(2026, 9, 18) - H);
  assert.equal(debutJour(Date.UTC(2026, 9, 17, 22, 30)), Date.UTC(2026, 9, 17) - H);
  // 31/12 23 h 30 UTC = 1er janvier à Douala.
  assert.equal(debutAnnee(Date.UTC(2026, 11, 31, 23, 30)), Date.UTC(2027, 0, 1) - H);
  assert.equal(debutAnnee(Date.UTC(2026, 5, 1), -1), Date.UTC(2025, 0, 1) - H);
  // Semaine du lundi 12/10/2026 (le dimanche 18 à 23 h 30 UTC est déjà lundi 19 à Douala).
  assert.equal(debutSemaine(Date.UTC(2026, 9, 15, 12)), Date.UTC(2026, 9, 12) - H);
  assert.equal(new Date(debutSemaine(Date.UTC(2026, 9, 15, 12)) + H).getUTCDay(), 1);
  assert.equal(debutSemaine(Date.UTC(2026, 9, 18, 23, 30)), Date.UTC(2026, 9, 19) - H);
  // « Aujourd'hui » à 00 h 30 Douala ne contient que 30 minutes, pas la veille au soir.
  const f = fenetres(lireFiltres({ periode: "aujourdhui" }), Date.UTC(2026, 9, 17, 23, 30));
  assert.equal(f.cur.fin - f.cur.debut, 30 * 60_000);
  const y = fenetres(lireFiltres({ periode: "ytd" }), Date.UTC(2026, 5, 1));
  assert.equal(y.cur.debut, Date.UTC(2026, 0, 1) - H);
});

const T = Date.UTC(2026, 9, 17, 12);
const marchand = (id: string, creeLe = T - 200 * JOUR): Marchand => ({ id, nom: id, pays: "CM", plan: "palier0", industrie: "Mode", source: "inconnu", creeLe, derniereActivite: T, actif: true, etapes: { boutique: null, produit: null, commande: null, paiement: null }, nbProduits: 0, produitsStockFaible: 0 });
const base = (manques: string[], marchands: Marchand[]): Dataset => ({ source: "reel", genereA: T, manques, marchands, commandes: [], abonnements: [], ia: [], fonctions: [], visites: [], depenses: [], experiences: [], incidents: [], tickets: [] });

test("score santé : un critère non mesuré est exclu, jamais noté d'office", () => {
  const poids = REGLAGES_DEFAUT.poids_sante;
  // Tickets non suivis et pas d'historique de commandes : support et croissance exclus (avant : 100 % et 50 % inventés).
  const v = new Vue(base(["tickets"], [marchand("a")]));
  const s = statsMarchands(v).get("a")!;
  assert.equal(s.ticketsOuverts, null);
  const sante = santeMarchand(v.marchands[0], s, poids);
  assert.equal(sante.criteres.support, null);
  assert.equal(sante.criteres.croissance, null);
  // Activité du jour (100), rien d'autre ; paiements sans échec = 100. Poids mesurés : activite 20 + commandes 15 + gmv 15 + usage 15 + ia 10 + paiements 10 = 85.
  assert.equal(sante.score, Math.round(((20 + 10) / 85) * 100));
  // Avec un suivi des tickets (0 ticket ouvert), le support redevient mesuré.
  const v2 = new Vue(base([], [marchand("a")]));
  const s2 = statsMarchands(v2).get("a")!;
  assert.equal(s2.ticketsOuverts, 0);
  assert.equal(santeMarchand(v2.marchands[0], s2, poids).criteres.support, 1);
});

test("cohortes : semaines commençant le lundi (Douala)", () => {
  const lundi = Date.UTC(2026, 8, 7) - H; // lundi 7 septembre 2026, 00:00 à Douala
  const v = new Vue(base([], [marchand("a", lundi + 2 * H), marchand("b", lundi + 6 * JOUR)]));
  const c = cohortes(v).find((x) => x.debut === lundi);
  assert.ok(c, "une cohorte démarre le lundi");
  assert.equal(c!.taille, 2); // du lundi au dimanche : même cohorte
});
