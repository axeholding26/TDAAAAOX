// AI Course Studio + tuteur IA — règles pures et génération avec LLM simulé (aucun appel réseau).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAFOND_DEFAUT, controlerReferences, decouper, delaiReprise, estimer, etapeCourante, leconsAutorisees, peutPasser,
  rechercher, transition, verifierBudget, MARQUE_SOURCE,
} from "@/lib/academie/regles";
import { genererCurriculum, genererLecon, leconEnHtml, lireJson, normaliserVente, type Brief } from "@/lib/academie/generation";
import { exigerAccord, type FonctionTexte } from "@/lib/academie/fournisseurs";

test("statuts : transitions permises et refusées", () => {
  assert.equal(transition("brouillon", "en_generation"), "en_generation");
  assert.ok(peutPasser("en_generation", "a_verifier"));
  assert.ok(peutPasser("a_verifier", "valide"));
  assert.ok(peutPasser("valide", "publie"));
  assert.ok(peutPasser("publie", "a_verifier"), "modifier une leçon publiée la renvoie en vérification");
  assert.ok(peutPasser("archive", "brouillon"));
  assert.ok(!peutPasser("brouillon", "publie"), "jamais publier sans validation");
  assert.ok(!peutPasser("en_generation", "valide"), "une génération passe par la vérification");
  assert.ok(!peutPasser("archive", "publie"));
  assert.throws(() => transition("brouillon", "valide"));
  assert.throws(() => transition("inconnu", "valide"));
});

test("étape du studio déduite des éléments", () => {
  assert.equal(etapeCourante([]), 1);
  const cur = [{ type: "positionnement", statut: "a_verifier" }, { type: "module", statut: "a_verifier" }];
  assert.equal(etapeCourante([...cur, { type: "lecon", statut: "brouillon" }]), 2);
  const v = cur.map((e) => ({ ...e, statut: "valide" }));
  assert.equal(etapeCourante([...v, { type: "lecon", statut: "en_generation" }, { type: "lecon", statut: "a_verifier" }]), 3);
  assert.equal(etapeCourante([...v, { type: "lecon", statut: "a_verifier" }, { type: "lecon", statut: "valide" }]), 4);
  assert.equal(etapeCourante([...v, { type: "lecon", statut: "valide" }, { type: "lecon", statut: "archive" }]), 5);
  assert.equal(etapeCourante([...v, { type: "lecon", statut: "publie" }], true), 6);
});

test("coût estimé avant lancement et plafond par boutique", () => {
  const un = estimer("studio_lecon");
  assert.ok(un > 0 && un < 50, `une leçon coûte quelques FCFA (${un})`);
  assert.equal(estimer("studio_lecon", 10), Math.round(un * 10 * 100) / 100);
  assert.ok(estimer("studio_curriculum", 1, 40_000) > estimer("studio_curriculum"), "les sources collées augmentent le coût");
  assert.equal(estimer("studio_curriculum", 1, 10_000_000), estimer("studio_curriculum", 1, 40_000), "sources tronquées");
  assert.throws(() => estimer("video"));

  assert.equal(verifierBudget({ depense: 0, estime: 10, plafond: null }).plafond, PLAFOND_DEFAUT, "défaut prudent");
  assert.ok(verifierBudget({ depense: 1990, estime: 10, plafond: 2000 }).ok);
  const refus = verifierBudget({ depense: 1995, estime: 10, plafond: 2000 });
  assert.ok(!refus.ok);
  assert.equal(refus.reste, 5);
  assert.match(refus.message!, /Plafond IA/);
  assert.ok(!verifierBudget({ depense: 0, estime: 1, plafond: 0 }).ok, "plafond 0 = IA coupée");
  assert.deepEqual([1, 2, 3, 4, 10].map((n) => delaiReprise(n) / 60_000), [1, 2, 4, 8, 30]);
});

test("génération payante (image, voix, vidéo) : accord explicite obligatoire", () => {
  assert.throws(() => exigerAccord("video", undefined));
  assert.throws(() => exigerAccord("audio", false));
  assert.doesNotThrow(() => exigerAccord("video", true));
  assert.doesNotThrow(() => exigerAccord("texte", undefined));
});

test("contrôle qualité : références et certifications inventées signalées", () => {
  const texte = {
    script: `Selon une étude de l'Université de Lagos, 73 % des entrepreneurs échouent la première année.
      Voir https://exemple-invente.org/rapport et (Dupont, 2019). Cette formation est certifiée Qualiopi et donne un diplôme reconnu par l'État.
      Le marketing WhatsApp est efficace. ${MARQUE_SOURCE}`,
  };
  const a = controlerReferences(texte);
  const types = new Set(a.map((x) => x.type));
  for (const t of ["reference", "statistique", "lien", "certification", "source_manquante"]) assert.ok(types.has(t as any), `type ${t} signalé`);
  assert.ok(a.some((x) => /Dupont, 2019/.test(x.extrait)));
  assert.ok(a.some((x) => /Qualiopi/.test(x.extrait)));
  assert.ok(!a.some((x) => /WhatsApp est efficace/.test(x.extrait)), "une affirmation générale n'est pas signalée");

  assert.deepEqual(controlerReferences({ script: "Un texte simple, sans chiffre ni source." }), []);
  // Une référence fournie par le formateur dans ses sources n'est pas signalée.
  const fournie = controlerReferences({ script: "Voir https://ma-source.cm/guide pour aller plus loin." }, "Mes sources : https://ma-source.cm/guide");
  assert.equal(fournie.filter((x) => x.type === "lien").length, 0);
  assert.equal(controlerReferences("<p>Selon une étude récente, ça marche.</p>").length, 1, "HTML lu comme texte");
});

const lecons = [
  { id: "l1", titre: "Fixer son prix", chapitre: "Vendre", type: "texte", contenu: "<p>Le prix se calcule à partir du coût de revient et de la marge.</p>" },
  { id: "l2", titre: "Livraison", chapitre: "Logistique", type: "texte", contenu: "<p>Le prix de la livraison dépend de la zone.</p>" },
  { id: "l3", titre: "Leçon verrouillée", chapitre: "Avancé", type: "texte", contenu: "<p>SECRET prix premium réservé aux inscrits avancés.</p>" },
  { id: "q1", titre: "Quiz prix", chapitre: "Vendre", type: "quiz", contenu: "<p>Réponse : la B. prix</p>" },
];

test("tuteur : contexte limité aux leçons ouvertes, jamais un quiz", () => {
  const ouvertes = new Set(["l1", "l2", "q1"]); // l3 verrouillée, q1 = quiz
  const autorisees = leconsAutorisees(lecons, ouvertes);
  assert.deepEqual(autorisees.map((l) => l.id), ["l1", "l2"]);
  const passages = decouper(autorisees);
  const trouves = rechercher("Comment fixer mon prix ?", passages);
  assert.ok(trouves.length >= 1);
  assert.equal(trouves[0].leconId, "l1", "la leçon la plus pertinente d'abord");
  const tout = trouves.map((p) => p.texte).join(" ");
  assert.ok(!tout.includes("SECRET"), "rien d'une leçon verrouillée");
  assert.ok(!tout.includes("Réponse : la B"), "rien d'un quiz");
  assert.deepEqual(rechercher("photosynthèse chlorophylle", passages), [], "hors sujet : aucun passage, donc pas d'appel au modèle");
  const egaux = decouper([{ ...lecons[0], titre: "A" }, { ...lecons[1], titre: "B" }]);
  assert.equal(rechercher("prix", egaux, 4, "l2")[0].leconId, "l2", "leçon courante favorisée à score égal");
  assert.deepEqual(leconsAutorisees(lecons, new Set()), []);
});

test("découpage des leçons en passages bornés", () => {
  const long = { id: "x", titre: "Long", chapitre: "C", type: "texte", contenu: Array.from({ length: 20 }, (_, i) => `<p>Paragraphe ${i} ${"mot ".repeat(40)}</p>`).join("\n") };
  const p = decouper([long], 700);
  assert.ok(p.length > 3);
  assert.ok(p.every((x) => x.texte.length <= 700 + 220 && x.leconId === "x"));
});

// ─── Génération avec LLM simulé ──────────────────────────────────────────────

const brief: Brief = { theme: "Vendre sur WhatsApp", public: "commerçants", niveau: "debutant", objectifs: "", dureeHeures: 2, langue: "français", ton: "concret", sources: "" };

test("curriculum : prompt sans invention, réponse normalisée", async () => {
  let systeme = "";
  const mock: FonctionTexte = async (messages, o) => {
    systeme = messages[0].content;
    assert.equal(o.json, true);
    return { texte: "```json\n" + JSON.stringify({
      titre: "WhatsApp Vente", positionnement: { promesse: "Vendre plus", prerequis: ["un téléphone"], resultats: ["créer un catalogue"] },
      modules: [{ titre: "Bases", objectif: "o", lecons: [{ titre: "Profil pro", objectif: "o", duree_min: 9999 }, { titre: "" }] }, { titre: "Vide", lecons: [] }],
    }) + "\n```", modele: "mock" };
  };
  const c = await genererCurriculum(brief, mock);
  assert.match(systeme, /N'invente AUCUNE référence/);
  assert.match(systeme, /certification/);
  assert.equal(c.modules.length, 1, "module sans leçon écarté");
  assert.equal(c.modules[0].lecons.length, 1, "leçon sans titre écartée");
  assert.equal(c.modules[0].lecons[0].duree_min, 180, "durée bornée");
  await assert.rejects(genererCurriculum(brief, async () => ({ texte: '{"modules":[]}' })), /aucun module/);
  await assert.rejects(genererCurriculum(brief, async () => ({ texte: "pas du json" })), /illisible/);
});

test("leçon : quiz au format du cœur pédagogique, questions invalides écartées, HTML échappé", async () => {
  const mock: FonctionTexte = async () => ({ texte: JSON.stringify({
    plan: ["Intro"], script: "Bonjour <script>alert(1)</script>\n\nSuite.",
    exercices: [{ consigne: "Crée ton profil", corrige: "Nom + logo" }],
    etude_de_cas: { situation: "Awa (cas fictif) vend des pagnes.", questions: ["Que faire ?"], pistes: "Catalogue" },
    quiz: [
      { type: "qcm", enonce: "Q1", options: ["A", "B"], bonnes: [1], explication: "B" },
      { type: "qcm", enonce: "Q2 sans bonne réponse", options: ["A", "B"], bonnes: [] },
      { type: "vrai_faux", enonce: "Q3", bonnes: [0] },
    ],
    fiche_recap: ["Point"], ressources: [{ titre: "Modèle de message", description: "à copier" }],
  }) });
  const l = await genererLecon(brief, { titreCours: "C", module: "M", titre: "T", objectif: "obj", duree_min: 20, plan: [] }, mock);
  assert.deepEqual(l.quiz.map((q) => q.id), ["q1", "q3"]);
  assert.equal(l.duree_min, 20);
  const html = leconEnHtml(l);
  assert.ok(!html.includes("<script>"), "contenu du modèle échappé");
  assert.match(html, /<details><summary>Voir le corrigé/);
  assert.ok(!html.includes("Q1"), "le quiz n'est pas dans le HTML (leçon quiz corrigée côté serveur)");
  await assert.rejects(genererLecon(brief, { titreCours: "C", module: "M", titre: "T", objectif: "", duree_min: 5, plan: [] }, async () => ({ texte: "{}" })), /pas rédigé/);
});

test("page de vente : incomplète refusée, e-mails filtrés", () => {
  assert.throws(() => normaliserVente({ page: { titre: "x" } }));
  const v = normaliserVente({ page: { titre: "T", description: "D", faq: [{ question: "q" }] }, emails: [{ objet: "o", corps: "c" }, { objet: "" }] });
  assert.equal(v.page.faq.length, 0);
  assert.equal(v.emails.length, 1);
  assert.deepEqual(lireJson('blabla {"a":1} fin'), { a: 1 });
});
