// Prompts et lecture des réponses de l'AI Course Studio. Sans base : le modèle est injecté
// (FonctionTexte), donc testable avec un LLM simulé (tests/academie.test.ts).
import { z } from "zod";
import { questionSchema, type Question } from "@/lib/formation/regles";
import { CONSIGNE_VERITE, GABARITS, MAX_SOURCES, MARQUE_SOURCE } from "./regles";
import type { FonctionTexte } from "./fournisseurs";

export const briefSchema = z.object({
  theme: z.string().trim().min(3).max(200),
  public: z.string().trim().max(300).default(""),
  niveau: z.enum(["debutant", "intermediaire", "avance"]).default("debutant"),
  objectifs: z.string().trim().max(1500).default(""),
  dureeHeures: z.number().min(0.5).max(200).default(3),
  langue: z.string().trim().min(2).max(30).default("français"),
  ton: z.string().trim().max(100).default("chaleureux et concret"),
  prix: z.number().min(0).max(100_000_000).optional(),
  devise: z.string().trim().max(5).optional(),
  // Texte collé par le marchand. Pas d'extraction PDF/Word : aucune bibliothèque du projet ne lit leur texte.
  sources: z.string().max(MAX_SOURCES).default(""),
  formationExistanteId: z.string().max(40).optional(), // programme existant à améliorer
});
export type Brief = z.infer<typeof briefSchema>;

const NIVEAUX: Record<string, string> = { debutant: "débutant", intermediaire: "intermédiaire", avance: "avancé" };

/** Lit le JSON d'une réponse de modèle (tolère les balises ```json). */
export function lireJson(texte: string): any {
  const t = texte.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(t); } catch {
    const debut = t.indexOf("{"), fin = t.lastIndexOf("}");
    if (debut >= 0 && fin > debut) return JSON.parse(t.slice(debut, fin + 1));
    throw new Error("Réponse du modèle illisible (JSON attendu).");
  }
}

const s = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const liste = (v: unknown, max = 12, long = 500) => (Array.isArray(v) ? v.map((x) => s(x, long)).filter(Boolean).slice(0, max) : []);

function contexteBrief(b: Brief, programme = "") {
  return [
    `THÈME : ${b.theme}`,
    `PUBLIC : ${b.public || "non précisé"}`,
    `NIVEAU : ${NIVEAUX[b.niveau]}`,
    `OBJECTIFS : ${b.objectifs || "non précisés"}`,
    `DURÉE TOTALE VISÉE : ${b.dureeHeures} h`,
    `LANGUE : ${b.langue} — TON : ${b.ton}`,
    b.prix != null ? `PRIX ENVISAGÉ : ${b.prix} ${b.devise ?? ""}` : "",
    programme ? `PROGRAMME EXISTANT À AMÉLIORER :\n${programme.slice(0, 8000)}` : "",
    b.sources ? `SOURCES DU FORMATEUR (seules références autorisées) :\n${b.sources.slice(0, MAX_SOURCES)}` : "SOURCES DU FORMATEUR : aucune.",
  ].filter(Boolean).join("\n");
}

// ─── 1. Positionnement + curriculum ─────────────────────────────────────────

export interface Curriculum {
  titre: string;
  positionnement: { promesse: string; public_cible: string; prerequis: string[]; resultats: string[]; differenciation: string };
  modules: { titre: string; objectif: string; lecons: { titre: string; objectif: string; duree_min: number }[] }[];
}

export function normaliserCurriculum(j: any): Curriculum {
  const modules = (Array.isArray(j?.modules) ? j.modules : []).slice(0, 12).map((m: any) => ({
    titre: s(m?.titre, 200),
    objectif: s(m?.objectif, 600),
    lecons: (Array.isArray(m?.lecons) ? m.lecons : []).slice(0, 10).map((l: any) => ({
      titre: s(l?.titre, 200), objectif: s(l?.objectif, 600), duree_min: Math.max(3, Math.min(180, Math.round(Number(l?.duree_min) || 15))),
    })).filter((l: any) => l.titre),
  })).filter((m: any) => m.titre && m.lecons.length);
  if (!modules.length) throw new Error("Le modèle n'a proposé aucun module exploitable.");
  const p = j?.positionnement ?? {};
  return {
    titre: s(j?.titre, 200) || modules[0].titre,
    positionnement: { promesse: s(p.promesse, 600), public_cible: s(p.public_cible, 600), prerequis: liste(p.prerequis), resultats: liste(p.resultats), differenciation: s(p.differenciation, 800) },
    modules,
  };
}

export async function genererCurriculum(b: Brief, texte: FonctionTexte, programme = ""): Promise<Curriculum & { modele?: string }> {
  const r = await texte([
    { role: "system", content: `Tu es un ingénieur pédagogique senior. Tu conçois des formations en ligne vendables, progressives et concrètes pour un public d'Afrique francophone et de la diaspora.\n${CONSIGNE_VERITE}\nRéponds UNIQUEMENT en JSON.` },
    { role: "user", content: `${contexteBrief(b, programme)}

Propose le positionnement et le curriculum. Format JSON exact :
{"titre":"…","positionnement":{"promesse":"…","public_cible":"…","prerequis":["…"],"resultats":["ce que l'apprenant saura faire"],"differenciation":"…"},
"modules":[{"titre":"…","objectif":"…","lecons":[{"titre":"…","objectif":"…","duree_min":15}]}]}
Entre 3 et 8 modules, 2 à 6 leçons par module, durées cohérentes avec la durée totale visée.` },
  ], { maxTokens: GABARITS.studio_curriculum.sortie, json: true });
  return { ...normaliserCurriculum(lireJson(r.texte)), modele: r.modele };
}

// ─── 3. Une leçon ────────────────────────────────────────────────────────────

export interface ContenuLecon {
  objectif: string; duree_min: number;
  plan: string[]; script: string;
  exercices: { consigne: string; corrige: string }[];
  etude_de_cas: { situation: string; questions: string[]; pistes: string } | null;
  quiz: Question[];
  fiche_recap: string[];
  ressources: { titre: string; description: string }[];
}

export function normaliserLecon(j: any, base: { objectif?: string; duree_min?: number } = {}): ContenuLecon {
  const quiz: Question[] = [];
  for (const [i, q] of (Array.isArray(j?.quiz) ? j.quiz : []).slice(0, 10).entries()) {
    const r = questionSchema.safeParse({ ...q, id: `q${i + 1}`, points: 1 });
    if (r.success) quiz.push(r.data); // une question mal formée (bonne réponse absente…) est écartée
  }
  const cas = j?.etude_de_cas;
  const script = s(j?.script, 30_000);
  if (!script) throw new Error("Le modèle n'a pas rédigé le contenu de la leçon.");
  return {
    objectif: s(j?.objectif, 600) || base.objectif || "",
    duree_min: base.duree_min ?? 15,
    plan: liste(j?.plan, 15, 300),
    script,
    exercices: (Array.isArray(j?.exercices) ? j.exercices : []).slice(0, 6).map((e: any) => ({ consigne: s(e?.consigne), corrige: s(e?.corrige, 3000) })).filter((e: any) => e.consigne),
    etude_de_cas: cas && s(cas.situation) ? { situation: s(cas.situation, 3000), questions: liste(cas.questions, 6), pistes: s(cas.pistes, 3000) } : null,
    quiz,
    fiche_recap: liste(j?.fiche_recap, 12, 400),
    ressources: (Array.isArray(j?.ressources) ? j.ressources : []).slice(0, 6).map((x: any) => ({ titre: s(x?.titre, 200), description: s(x?.description, 500) })).filter((x: any) => x.titre),
  };
}

export async function genererLecon(
  b: Brief, c: { titreCours: string; module: string; titre: string; objectif: string; duree_min: number; plan: string[] }, texte: FonctionTexte,
): Promise<ContenuLecon & { modele?: string }> {
  const r = await texte([
    { role: "system", content: `Tu es un formateur expert qui rédige des leçons claires, pratiques et adaptées au contexte africain (exemples locaux, mobile money, WhatsApp…).\n${CONSIGNE_VERITE}\nRéponds UNIQUEMENT en JSON.` },
    { role: "user", content: `${contexteBrief(b)}

FORMATION : ${c.titreCours}
MODULE : ${c.module}
PROGRAMME COMPLET (pour la cohérence, ne rédige que la leçon demandée) :
${c.plan.join("\n")}

LEÇON À RÉDIGER : « ${c.titre} » — objectif : ${c.objectif} — durée ≈ ${c.duree_min} min.

Format JSON exact :
{"objectif":"…","plan":["…"],"script":"texte complet de la leçon (ou script vidéo), paragraphes séparés par \\n\\n",
"exercices":[{"consigne":"…","corrige":"…"}],
"etude_de_cas":{"situation":"cas fictif présenté comme tel","questions":["…"],"pistes":"…"},
"quiz":[{"type":"qcm","enonce":"…","options":["A","B","C"],"bonnes":[0],"explication":"…"},{"type":"vrai_faux","enonce":"…","bonnes":[1],"explication":"…"}],
"fiche_recap":["point clé"],
"ressources":[{"titre":"modèle ou outil à créer soi-même","description":"…"}]}
Quiz : 3 à 5 questions ; types possibles qcm (une bonne réponse), multiple, vrai_faux (0 = Vrai, 1 = Faux), courte (avec "acceptees":["…"]). Ressources : jamais de lien ni d'ouvrage cité, seulement des outils/modèles décrits. Une étude de cas est toujours un cas FICTIF annoncé comme tel. Si une source manque, écris ${MARQUE_SOURCE}.` },
  ], { maxTokens: GABARITS.studio_lecon.sortie, json: true });
  return { ...normaliserLecon(lireJson(r.texte), c), modele: r.modele };
}

// ─── 6. Page de vente + e-mails de lancement (brouillons) ───────────────────

export interface Vente {
  page: { titre: string; sous_titre: string; description: string; benefices: string[]; pour_qui: string[]; faq: { question: string; reponse: string }[]; meta_title: string; meta_desc: string };
  emails: { objet: string; corps: string }[];
}

export function normaliserVente(j: any): Vente {
  const p = j?.page ?? {};
  const page = {
    titre: s(p.titre, 200), sous_titre: s(p.sous_titre, 300), description: s(p.description, 6000),
    benefices: liste(p.benefices, 10, 300), pour_qui: liste(p.pour_qui, 8, 300),
    faq: (Array.isArray(p.faq) ? p.faq : []).slice(0, 8).map((f: any) => ({ question: s(f?.question, 300), reponse: s(f?.reponse, 1500) })).filter((f: any) => f.question && f.reponse),
    meta_title: s(p.meta_title, 70), meta_desc: s(p.meta_desc, 160),
  };
  if (!page.titre || !page.description) throw new Error("Page de vente incomplète.");
  const emails = (Array.isArray(j?.emails) ? j.emails : []).slice(0, 5).map((e: any) => ({ objet: s(e?.objet, 200), corps: s(e?.corps, 5000) })).filter((e: any) => e.objet && e.corps);
  return { page, emails };
}

export async function genererVente(b: Brief, resume: string, texte: FonctionTexte): Promise<Vente & { modele?: string }> {
  const r = await texte([
    { role: "system", content: `Tu es un copywriter éthique spécialisé dans la vente de formations en ligne en Afrique francophone.\n${CONSIGNE_VERITE}\n- Aucun faux témoignage, aucun nombre d'élèves, aucune promesse de gain.\nRéponds UNIQUEMENT en JSON.` },
    { role: "user", content: `${contexteBrief(b)}

PROGRAMME VALIDÉ :
${resume.slice(0, 8000)}

Rédige la page de vente et 3 e-mails de lancement (annonce, contenu/valeur, dernier rappel). Format JSON exact :
{"page":{"titre":"…","sous_titre":"…","description":"texte de vente, paragraphes séparés par \\n\\n","benefices":["…"],"pour_qui":["…"],"faq":[{"question":"…","reponse":"…"}],"meta_title":"≤ 60 caractères","meta_desc":"≤ 155 caractères"},
"emails":[{"objet":"…","corps":"…"}]}
FAQ : seulement accès, format, rythme, prérequis — n'invente aucune politique de remboursement ou garantie. L'accès à la formation est à vie après paiement.` },
  ], { maxTokens: GABARITS.studio_vente.sortie, json: true });
  return { ...normaliserVente(lireJson(r.texte)), modele: r.modele };
}

// ─── Rendu HTML d'une leçon publiée ──────────────────────────────────────────

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const paras = (t: string) => t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const ul = (xs: string[]) => (xs.length ? `<ul>${xs.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "");

/** Contenu HTML de la leçon (le quiz devient une leçon « quiz » à part, corrigée côté serveur). */
export function leconEnHtml(c: ContenuLecon): string {
  return [
    c.objectif ? `<p><strong>Objectif :</strong> ${esc(c.objectif)}</p>` : "",
    c.plan.length ? `<h3>Plan</h3>${ul(c.plan)}` : "",
    paras(c.script),
    c.exercices.length ? `<h3>Exercices</h3>${c.exercices.map((e, i) => `<p><strong>Exercice ${i + 1}.</strong> ${esc(e.consigne)}</p>${e.corrige ? `<details><summary>Voir le corrigé</summary>${paras(e.corrige)}</details>` : ""}`).join("")}` : "",
    c.etude_de_cas ? `<h3>Étude de cas</h3>${paras(c.etude_de_cas.situation)}${ul(c.etude_de_cas.questions)}${c.etude_de_cas.pistes ? `<details><summary>Pistes de réponse</summary>${paras(c.etude_de_cas.pistes)}</details>` : ""}` : "",
    c.fiche_recap.length ? `<h3>Fiche récap</h3>${ul(c.fiche_recap)}` : "",
    c.ressources.length ? `<h3>Ressources</h3><ul>${c.ressources.map((r) => `<li><strong>${esc(r.titre)}</strong>${r.description ? ` — ${esc(r.description)}` : ""}</li>`).join("")}</ul>` : "",
  ].filter(Boolean).join("\n");
}

export function venteEnHtml(v: Vente["page"]): string {
  return [
    v.sous_titre ? `<p><strong>${esc(v.sous_titre)}</strong></p>` : "",
    paras(v.description),
    v.benefices.length ? `<h3>Ce que tu vas obtenir</h3>${ul(v.benefices)}` : "",
    v.pour_qui.length ? `<h3>Pour qui ?</h3>${ul(v.pour_qui)}` : "",
  ].filter(Boolean).join("\n");
}
