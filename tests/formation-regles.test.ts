// Cœur pédagogique — règles pures : correction des quiz, déblocage (prérequis + drip),
// éligibilité à l'attestation, identifiant de certificat, état d'un apprenant.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculerDeblocage, cleApprenant, correctionVisible, corrigerQuiz, eligibiliteCertificat, estVisible, etatApprenant,
  genererCodeCertificat, normaliserCodeCertificat, questionsPubliques, quizSchema, type NoeudChapitre, type Question,
} from "@/lib/formation/regles";

const Q: Question[] = [
  { id: "a", type: "qcm", enonce: "2+2 ?", options: ["3", "4"], bonnes: [1], acceptees: [], points: 1 },
  { id: "b", type: "multiple", enonce: "Pairs ?", options: ["1", "2", "4"], bonnes: [1, 2], acceptees: [], points: 2 },
  { id: "c", type: "vrai_faux", enonce: "Le ciel est vert", options: [], bonnes: [1], acceptees: [], points: 1 },
  { id: "d", type: "courte", enonce: "Capitale du Sénégal", options: [], bonnes: [], acceptees: ["Dakar"], points: 1, explication: "Dakar." },
];

test("quiz : correction serveur, choix multiples tout-ou-rien, réponse courte sans casse ni accents", () => {
  const juste = corrigerQuiz(Q, { a: 1, b: [2, 1], c: 1, d: "  dakar " }, 70);
  assert.deepEqual([juste.score, juste.reussi], [100, true]);
  const partiel = corrigerQuiz(Q, { a: 1, b: [1], c: 1, d: "Dakar" }, 70);
  assert.equal(partiel.score, 60, "b partiel = 0 point sur 2 → 3/5");
  assert.equal(partiel.reussi, false);
  assert.equal(corrigerQuiz(Q, { a: 1, b: [1, 2, 0], c: 1, d: "Dakar" }, 70).details.find((d) => d.id === "b")!.juste, false, "une case de trop = faux");
  assert.equal(corrigerQuiz(Q, {}, 0).score, 0);
  assert.equal(corrigerQuiz(Q, { d: "" }, 50).details.find((d) => d.id === "d")!.juste, false);
  assert.equal(corrigerQuiz(Q, { a: "1" as any }, 50).details[0].juste, false, "type inattendu refusé");
  assert.equal(corrigerQuiz([{ ...Q[3], acceptees: ["Côte d'Ivoire"] }], { d: "cote d ivoire" }, 100).reussi, true);
});

test("quiz : les bonnes réponses ne partent jamais avant soumission", () => {
  const pub = JSON.stringify(questionsPubliques(Q));
  for (const cle of ["bonnes", "acceptees", "explication", "Dakar."]) assert.ok(!pub.includes(cle), cle);
  assert.deepEqual(questionsPubliques(Q)[2].options, ["Vrai", "Faux"]);
  const { details } = corrigerQuiz(Q, {}, 70);
  assert.ok(!JSON.stringify(correctionVisible(Q, details, false)).includes("bonnes"));
  assert.deepEqual(correctionVisible(Q, details, true)[0].bonnes, [1]);
});

test("quiz : validation de l'éditeur", () => {
  assert.equal(quizSchema.safeParse({ questions: Q }).success, true);
  assert.equal(quizSchema.safeParse({ questions: [] }).success, false);
  assert.equal(quizSchema.safeParse({ questions: [{ ...Q[0], bonnes: [] }] }).success, false, "sans bonne réponse");
  assert.equal(quizSchema.safeParse({ questions: [{ ...Q[0], bonnes: [5] }] }).success, false, "indice hors choix");
  assert.equal(quizSchema.safeParse({ questions: [{ ...Q[0], bonnes: [0, 1] }] }).success, false, "deux bonnes pour un choix unique");
  assert.equal(quizSchema.safeParse({ questions: [{ ...Q[3], acceptees: [] }] }).success, false);
});

const J = 86_400_000;
const inscrit = new Date("2026-10-01T00:00:00Z");
const l = (id: string, x: Partial<NoeudChapitre["lecons"][number]> = {}) => ({ id, titre: id.toUpperCase(), gratuite: false, prerequis: [], dripJours: null, dripDate: null, ...x });
const ch = (id: string, lecons: ReturnType<typeof l>[], x: Partial<NoeudChapitre> = {}): NoeudChapitre => ({ id, titre: `Module ${id}`, prerequis: [], dripJours: null, dripDate: null, lecons, ...x });

test("déblocage : prérequis de leçon et de module, aperçu gratuit toujours ouvert", () => {
  const cours = [ch("m1", [l("a"), l("b", { prerequis: ["a"] })]), ch("m2", [l("c"), l("g", { gratuite: true, prerequis: ["a"] })], { prerequis: ["m1"] })];
  let v = calculerDeblocage(cours, { inscritLe: inscrit, completes: new Set(), maintenant: inscrit });
  assert.equal(v.get("a")!.ouvert, true);
  assert.deepEqual(v.get("b"), { ouvert: false, raison: "prerequis", manque: ["A"] });
  assert.deepEqual(v.get("c"), { ouvert: false, raison: "prerequis", manque: ["Module m1"] });
  assert.equal(v.get("g")!.ouvert, true, "aperçu gratuit");
  v = calculerDeblocage(cours, { inscritLe: inscrit, completes: new Set(["a", "b"]), maintenant: inscrit });
  assert.equal(v.get("b")!.ouvert && v.get("c")!.ouvert, true);
  // Prérequis disparu (brouillon/supprimé, donc absent de l'entrée) : ignoré, jamais bloquant.
  v = calculerDeblocage([ch("m", [l("x", { prerequis: ["fantome"] })], { prerequis: ["m-fantome"] })], { inscritLe: inscrit, completes: new Set(), maintenant: inscrit });
  assert.equal(v.get("x")!.ouvert, true);
});

test("déblocage : drip X jours après l'inscription ou date fixe (la plus tardive gagne)", () => {
  const cours = [ch("m", [l("a", { dripJours: 7 }), l("b", { dripDate: new Date("2026-12-01") })], { dripJours: 3 })];
  let v = calculerDeblocage(cours, { inscritLe: inscrit, completes: new Set(), maintenant: new Date(inscrit.getTime() + 5 * J) });
  assert.deepEqual(v.get("a"), { ouvert: false, raison: "drip", disponibleLe: new Date(inscrit.getTime() + 7 * J) });
  assert.equal((v.get("b") as any).raison, "drip");
  v = calculerDeblocage(cours, { inscritLe: inscrit, completes: new Set(), maintenant: new Date(inscrit.getTime() + 8 * J) });
  assert.equal(v.get("a")!.ouvert, true);
  v = calculerDeblocage(cours, { inscritLe: inscrit, completes: new Set(), maintenant: new Date(inscrit.getTime() + 2 * J) });
  assert.equal((v.get("a") as any).disponibleLe.getTime(), inscrit.getTime() + 7 * J, "module à J+3, leçon à J+7 → J+7");
});

test("attestation : critères configurables", () => {
  const base = { lecons: ["a", "b", "q", "d"], completes: new Set(["a", "b", "q", "d"]), quiz: ["q"], quizReussis: new Set(["q"]), devoirs: ["d"], devoirsValides: new Set(["d"]) };
  const tout = { certifLeconsPct: 100, certifQuizRequis: true, certifDevoirsRequis: true };
  assert.equal(eligibiliteCertificat(tout, base).eligible, true);
  assert.equal(eligibiliteCertificat(tout, { ...base, quizReussis: new Set() }).eligible, false, "progression ≠ réussite");
  assert.equal(eligibiliteCertificat(tout, { ...base, devoirsValides: new Set() }).manque[0], "1 devoir(s) à faire valider");
  assert.equal(eligibiliteCertificat({ ...tout, certifDevoirsRequis: false }, { ...base, devoirsValides: new Set() }).eligible, true);
  assert.equal(eligibiliteCertificat({ ...tout, certifLeconsPct: 75 }, { ...base, completes: new Set(["a", "q", "d"]) }).eligible, true);
  assert.equal(eligibiliteCertificat({ ...tout, certifLeconsPct: 80 }, { ...base, completes: new Set(["a", "q", "d"]) }).eligible, false);
  assert.equal(eligibiliteCertificat(tout, { ...base, lecons: [] }).eligible, false, "formation vide");
});

test("certificat : identifiant aléatoire non devinable et vérification tolérante à la saisie", () => {
  const codes = new Set(Array.from({ length: 2000 }, genererCodeCertificat));
  assert.equal(codes.size, 2000);
  const code = [...codes][0];
  assert.match(code, /^AXC-[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
  assert.equal(normaliserCodeCertificat(code), code);
  assert.equal(normaliserCodeCertificat(code.toLowerCase().replace(/-/g, " ")), code);
  assert.equal(normaliserCodeCertificat("AXC-0000-1111-2222-333O"), "AXC-0000-1111-2222-3330", "O lu comme 0");
  for (const faux of ["", "AXC-123", "AXC-UUUU-0000-0000-0000", "'; drop table", "AXC-0000-0000-0000-00000"]) assert.equal(normaliserCodeCertificat(faux), null, faux);
});

test("visibilité, clé apprenant et état", () => {
  assert.equal(estVisible({ actif: true, statut: "publie" }), true);
  assert.equal(estVisible({ actif: true }), true, "anciennes données sans statut");
  assert.equal(estVisible({ actif: false, statut: "publie" }), false);
  assert.equal(estVisible({ actif: true, statut: "brouillon" }), false);
  assert.equal(estVisible({ actif: true, statut: "archive" }), false);
  assert.equal(cleApprenant({ clientEmail: " a@b.c ", commandeId: "x" }), "a@b.c");
  assert.equal(cleApprenant({ clientEmail: "", commandeId: "x" }), "commande:x", "deux acheteurs sans e-mail ne partagent rien");
  const now = new Date("2026-10-18");
  assert.equal(etatApprenant({ pct: 100, derniereActivite: new Date(0) }, now), "termine");
  assert.equal(etatApprenant({ pct: 40, derniereActivite: new Date("2026-09-01") }, now), "abandon");
  assert.equal(etatApprenant({ pct: 40, derniereActivite: new Date("2026-10-10") }, now), "en_cours");
  assert.equal(etatApprenant({ pct: 0, derniereActivite: new Date("2026-10-10") }, now), "non_demarre");
});
