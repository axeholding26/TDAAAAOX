// Règles pures du cœur pédagogique : correction des quiz, déblocage (prérequis + drip),
// éligibilité au certificat, identifiant de certificat. Sans base de données : testées
// dans tests/formation-regles.test.ts.
import crypto from "crypto";
import { z } from "zod";

// ─── Visibilité ──────────────────────────────────────────────────────────────

/** Visible par l'apprenant : actif (ancien interrupteur) ET publié. Défauts = comportement d'avant. */
export const estVisible = (x: { actif: boolean; statut?: string | null }) => x.actif && (x.statut ?? "publie") === "publie";

/** Clé de l'apprenant : l'e-mail de la commande, sinon la commande (deux acheteurs sans e-mail ne partagent rien). */
export const cleApprenant = (a: { clientEmail: string | null; commandeId: string }) => a.clientEmail?.trim() || `commande:${a.commandeId}`;

// ─── Quiz ────────────────────────────────────────────────────────────────────

export const questionSchema = z.object({
  id: z.string().min(1).max(40),
  type: z.enum(["qcm", "multiple", "vrai_faux", "courte"]),
  enonce: z.string().trim().min(1).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
  bonnes: z.array(z.number().int().min(0).max(9)).max(10).default([]), // indices corrects (qcm, multiple, vrai_faux)
  acceptees: z.array(z.string().trim().min(1).max(200)).max(20).default([]), // réponses acceptées (courte)
  points: z.number().int().min(1).max(100).default(1),
  explication: z.string().max(2000).optional(),
}).superRefine((q, ctx) => {
  if (q.type === "courte") {
    if (!q.acceptees.length) ctx.addIssue({ code: "custom", message: "Réponse courte : au moins une réponse acceptée" });
    return;
  }
  const n = q.type === "vrai_faux" ? 2 : q.options.length;
  if (q.type !== "vrai_faux" && n < 2) ctx.addIssue({ code: "custom", message: "Au moins deux choix" });
  if (!q.bonnes.length || q.bonnes.some((i) => i >= n)) ctx.addIssue({ code: "custom", message: "Indique la ou les bonnes réponses" });
  if (q.type !== "multiple" && q.bonnes.length !== 1) ctx.addIssue({ code: "custom", message: "Une seule bonne réponse pour ce type" });
});
export type Question = z.infer<typeof questionSchema>;

export const quizSchema = z.object({
  noteMin: z.number().int().min(0).max(100).default(70),
  tentativesMax: z.number().int().min(1).max(100).nullable().default(null),
  questions: z.array(questionSchema).min(1).max(100),
});

const OPTIONS_VF = ["Vrai", "Faux"];

/** Ce que reçoit le navigateur avant soumission : jamais `bonnes`, `acceptees` ni `explication`. */
export function questionsPubliques(questions: Question[]) {
  return questions.map((q) => ({
    id: q.id, type: q.type, enonce: q.enonce, points: q.points,
    options: q.type === "vrai_faux" ? OPTIONS_VF : q.type === "courte" ? [] : q.options,
  }));
}

const normaliser = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export type Reponses = Record<string, number | number[] | string | null | undefined>;

/** Correction serveur. Choix multiples : tout juste ou rien (pas de point pour une réponse partielle). */
export function corrigerQuiz(questions: Question[], reponses: Reponses, noteMin: number) {
  let obtenus = 0;
  let total = 0;
  const details = questions.map((q) => {
    total += q.points;
    const r = reponses[q.id];
    let juste = false;
    if (q.type === "courte") juste = typeof r === "string" && q.acceptees.some((a) => normaliser(a) === normaliser(r) && normaliser(r) !== "");
    else if (q.type === "multiple") {
      const choix = Array.isArray(r) ? [...new Set(r)].sort() : [];
      const attendu = [...new Set(q.bonnes)].sort();
      juste = choix.length === attendu.length && choix.every((v, i) => v === attendu[i]);
    } else juste = typeof r === "number" && r === q.bonnes[0];
    if (juste) obtenus += q.points;
    return { id: q.id, juste };
  });
  const score = total ? Math.round((obtenus / total) * 100) : 0;
  return { score, reussi: score >= noteMin, details };
}

/** Correction détaillée renvoyée après soumission ; les bonnes réponses seulement quand l'apprenant ne peut plus en tirer parti. */
export function correctionVisible(questions: Question[], details: { id: string; juste: boolean }[], montrerReponses: boolean) {
  return details.map((d) => {
    const q = questions.find((x) => x.id === d.id)!;
    return {
      id: d.id, juste: d.juste,
      ...(montrerReponses ? { bonnes: q.bonnes, acceptees: q.acceptees, explication: q.explication ?? null } : {}),
    };
  });
}

// ─── Déblocage : prérequis + drip ────────────────────────────────────────────

export type NoeudLecon = { id: string; titre: string; gratuite: boolean; prerequis: string[]; dripJours: number | null; dripDate: Date | null };
export type NoeudChapitre = { id: string; titre: string; prerequis: string[]; dripJours: number | null; dripDate: Date | null; lecons: NoeudLecon[] };
export type Verrou = { ouvert: true } | { ouvert: false; raison: "drip"; disponibleLe: Date } | { ouvert: false; raison: "prerequis"; manque: string[] };

const JOUR = 86_400_000;

/** Date d'ouverture : la plus tardive entre la date fixe et « X jours après l'inscription ». null = tout de suite. */
export function dateOuverture(x: { dripJours: number | null; dripDate: Date | null }, inscritLe: Date): Date | null {
  const dates = [x.dripDate, x.dripJours ? new Date(inscritLe.getTime() + x.dripJours * JOUR) : null].filter((d): d is Date => !!d);
  return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
}

/**
 * État de chaque leçon visible. Les chapitres/leçons passés en entrée sont déjà filtrés (visibles) :
 * un prérequis qui n'est plus visible (brouillon, archivé, supprimé) est ignoré, sinon l'apprenant serait bloqué à vie.
 * Une leçon d'aperçu gratuit reste toujours ouverte.
 */
export function calculerDeblocage(chapitres: NoeudChapitre[], p: { inscritLe: Date; completes: Set<string>; maintenant?: Date }): Map<string, Verrou> {
  const now = p.maintenant ?? new Date();
  const lecons = new Map(chapitres.flatMap((c) => c.lecons.map((l) => [l.id, l] as const)));
  const parChapitre = new Map(chapitres.map((c) => [c.id, c]));
  const etat = new Map<string, Verrou>();
  for (const ch of chapitres) {
    for (const l of ch.lecons) {
      if (l.gratuite) { etat.set(l.id, { ouvert: true }); continue; }
      const ouvertures = [dateOuverture(ch, p.inscritLe), dateOuverture(l, p.inscritLe)].filter((d): d is Date => !!d);
      const ouvre = ouvertures.length ? new Date(Math.max(...ouvertures.map((d) => d.getTime()))) : null;
      if (ouvre && ouvre > now) { etat.set(l.id, { ouvert: false, raison: "drip", disponibleLe: ouvre }); continue; }
      const manque: string[] = [];
      for (const cid of ch.prerequis) {
        const c = parChapitre.get(cid);
        if (c && c.id !== ch.id && c.lecons.some((x) => !p.completes.has(x.id))) manque.push(c.titre);
      }
      for (const lid of l.prerequis) {
        const x = lecons.get(lid);
        if (x && x.id !== l.id && !p.completes.has(x.id)) manque.push(x.titre);
      }
      etat.set(l.id, manque.length ? { ouvert: false, raison: "prerequis", manque } : { ouvert: true });
    }
  }
  return etat;
}

// ─── Certificat ──────────────────────────────────────────────────────────────

export type Criteres = { certifLeconsPct: number; certifQuizRequis: boolean; certifDevoirsRequis: boolean };

/**
 * Éligibilité. Définitions : une leçon « terminée » = marquée par l'apprenant (ou quiz réussi / devoir rendu) ;
 * un quiz « réussi » = au moins une tentative ≥ note minimale ; un devoir « validé » = validé par le formateur.
 */
export function eligibiliteCertificat(c: Criteres, s: {
  lecons: string[]; completes: Set<string>; quiz: string[]; quizReussis: Set<string>; devoirs: string[]; devoirsValides: Set<string>;
}): { eligible: boolean; manque: string[] } {
  const manque: string[] = [];
  if (!s.lecons.length) return { eligible: false, manque: ["La formation n'a aucune leçon"] };
  const faites = s.lecons.filter((id) => s.completes.has(id)).length;
  const pct = Math.round((faites / s.lecons.length) * 100);
  const exige = Math.min(100, Math.max(0, c.certifLeconsPct));
  if (pct < exige) manque.push(`Leçons terminées : ${pct} % sur ${exige} % exigés`);
  const quizRestants = s.quiz.filter((id) => !s.quizReussis.has(id)).length;
  if (c.certifQuizRequis && quizRestants) manque.push(`${quizRestants} quiz à réussir`);
  const devoirsRestants = s.devoirs.filter((id) => !s.devoirsValides.has(id)).length;
  if (c.certifDevoirsRequis && devoirsRestants) manque.push(`${devoirsRestants} devoir(s) à faire valider`);
  return { eligible: !manque.length, manque };
}

// Base32 de Crockford (sans I, L, O, U) : lisible, sans confusion 0/O ou 1/I.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Identifiant de certificat : 80 bits aléatoires (16 caractères), ex. AXC-7K2M-9QXD-4RTA-H8VW. */
export function genererCodeCertificat(): string {
  const octets = crypto.randomBytes(10);
  let bits = 0, val = 0, out = "";
  for (const o of octets) {
    val = (val << 8) | o; bits += 8;
    while (bits >= 5) { out += ALPHABET[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  return `AXC-${out.match(/.{4}/g)!.join("-")}`;
}

/** Normalise une saisie (minuscules, espaces, O→0, I/L→1) ; null si le format est invalide. */
export function normaliserCodeCertificat(saisie: string): string | null {
  const brut = saisie.toUpperCase().replace(/[\s-]/g, "").replace(/^AXC/, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (!/^[0-9A-HJKMNP-TV-Z]{16}$/.test(brut)) return null;
  return `AXC-${brut.match(/.{4}/g)!.join("-")}`;
}

// ─── Statistiques formateur ──────────────────────────────────────────────────
// Définitions (affichées telles quelles dans le tableau de bord) :
// - inscrit : accès payé, non remboursé ;
// - démarré (progression) : au moins une leçon terminée ;
// - terminé (complétion) : 100 % des leçons publiées terminées ;
// - réussite quiz : part des couples (apprenant, quiz) tentés où une tentative atteint la note minimale ;
// - abandon : pas terminé ET aucune activité depuis 30 jours (inscription comprise).
export const JOURS_ABANDON = 30;

export function etatApprenant(a: { pct: number; derniereActivite: Date }, maintenant = new Date()): "termine" | "abandon" | "en_cours" | "non_demarre" {
  if (a.pct >= 100) return "termine";
  if (maintenant.getTime() - a.derniereActivite.getTime() > JOURS_ABANDON * JOUR) return "abandon";
  return a.pct > 0 ? "en_cours" : "non_demarre";
}
