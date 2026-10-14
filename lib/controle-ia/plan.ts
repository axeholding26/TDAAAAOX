// AXSO CONTROL — logique pure du plan d'un objectif (aucune base, aucun modèle : testable seule).
// Le modèle interne PROPOSE un plan ; ce fichier le valide, puis le déroule tel quel. Une fois
// validé, le plan est figé : les résultats d'étapes (fiches, avis, pages web : données non
// fiables) ne peuvent ni ajouter d'étape, ni changer d'outil, ni toucher aux paramètres, sauf
// par les références « {{etape_N.champ}} » écrites dans le plan avant l'exécution.
import type { ResultatIA } from "./types";

export const MAX_ETAPES = 20;
/** Longueur maximale d'une valeur reprise d'une étape précédente (un identifiant, un texte généré). */
const MAX_REFERENCE = 5000;

export interface OutilPlan { name: string; inputSchema: { properties?: Record<string, any>; required?: string[] } }
export type StatutEtape = "a_faire" | "en_cours" | "fait" | "attente_accord" | "echec" | "abandonne";
export interface Etape {
  id: string; titre: string; outil: string; args: Record<string, any>;
  /** Part du budget de l'objectif réservée à cette étape (0 = n'engage rien). */
  budget: number;
  statut: StatutEtape; resultat?: string; code?: string; actionId?: string; donnees?: Record<string, unknown>;
}
export interface PlanValide { etapes: Etape[]; rejets: string[]; erreur?: string }
export type Fin = "termine" | "attente_accord" | "echec" | "annule" | "pause";

// ─── Références entre étapes ─────────────────────────────────────────────────
// Une référence est la valeur ENTIÈRE d'un paramètre, jamais un morceau de texte : un contenu
// piégé ne peut pas s'insérer dans une phrase, et « {{prenom}} » d'un e-mail reste du texte.
const REF = /^\{\{(etape_\d+)\.([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\}\}$/;

function parcourir(v: unknown, f: (s: string) => unknown): unknown {
  if (typeof v === "string") return f(v);
  if (Array.isArray(v)) return v.map((x) => parcourir(x, f));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, parcourir(x, f)]));
  return v;
}

/** Étapes dont dépendent ces paramètres. */
export function dependances(args: Record<string, any>): string[] {
  const ids: string[] = [];
  parcourir(args, (s) => { const m = REF.exec(s); if (m) ids.push(m[1]); return s; });
  return ids;
}

function conforme(schema: any, v: unknown, referencesAdmises: boolean): boolean {
  if (referencesAdmises && typeof v === "string" && REF.test(v)) return true; // contrôlée à la résolution
  if (Array.isArray(schema?.enum) && !schema.enum.includes(v)) return false;
  switch (schema?.type) {
    case "string": return typeof v === "string";
    case "number": return typeof v === "number" && Number.isFinite(v);
    case "integer": return Number.isInteger(v);
    case "boolean": return typeof v === "boolean";
    case "array": return Array.isArray(v);
    case "object": return !!v && typeof v === "object" && !Array.isArray(v);
    default: return true;
  }
}

/**
 * Remplace les références par les `donnees` structurées des étapes faites. Sans évaluation de
 * code : un chemin de clés, une valeur simple (texte court, nombre, booléen), jamais relue
 * comme une nouvelle référence, et du type attendu par l'outil.
 */
export function resoudreArgs(args: Record<string, any>, etapes: Etape[], outil?: OutilPlan): { args: Record<string, any> } | { erreur: string } {
  let erreur = "";
  const resolus = parcourir(args, (s) => {
    const m = REF.exec(s);
    if (!m) return s;
    const source = etapes.find((e) => e.id === m[1]);
    let v: unknown = source?.statut === "fait" ? source.donnees : undefined;
    for (const cle of m[2].split(".")) v = v && typeof v === "object" && Object.prototype.hasOwnProperty.call(v, cle) ? (v as any)[cle] : undefined;
    if (typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v.length <= MAX_REFERENCE)) return v;
    erreur ||= `la référence ${s} ne correspond à aucune donnée simple renvoyée par ${m[1]}.`;
    return s;
  }) as Record<string, any>;
  if (erreur) return { erreur };
  for (const [cle, v] of Object.entries(resolus)) {
    if (!conforme(outil?.inputSchema.properties?.[cle], v, false)) return { erreur: `le paramètre « ${cle} » obtenu par référence n'a pas le type attendu.` };
  }
  return { args: resolus };
}

// ─── Validation ──────────────────────────────────────────────────────────────
// ponytail: un paramètre « budget… », « montant » ou « amount » est lu comme la dépense de l'étape
// (un budget par jour n'est pas multiplié par la durée) ; passer par OutilIA.montant si
// outilsDisponibles l'expose un jour.
const ARGENT = /budget|^(montant|amount)$/i;

/**
 * Valide le plan proposé par le modèle contre les outils RÉELLEMENT ouverts à la connexion.
 * Une étape invalide est retirée (et celles qui en dépendent) ; un plan trop long, vide ou
 * au-dessus du budget est refusé. Les étapes gardent le numéro donné par le modèle.
 */
export function validerPlan(brut: unknown, outils: OutilPlan[], opts: { interdit?: (nom: string) => boolean; budget?: number } = {}): PlanValide {
  const refuse = (erreur: string): PlanValide => ({ etapes: [], rejets: [], erreur });
  const liste = Array.isArray(brut) ? brut : (brut as any)?.etapes;
  if (!Array.isArray(liste) || !liste.length) return refuse("le plan ne contient aucune étape.");
  if (liste.length > MAX_ETAPES) return refuse(`le plan compte ${liste.length} étapes (maximum ${MAX_ETAPES}).`);

  const parNom = new Map(outils.map((o) => [o.name, o]));
  const etapes: Etape[] = [], rejets: string[] = [];
  liste.forEach((b: any, i: number) => {
    const id = `etape_${i + 1}`, nom = String(b?.outil ?? ""), o = parNom.get(nom);
    const budget = Number(b?.budget) > 0 ? Number(b.budget) : 0;
    const args: Record<string, any> = {};
    const motif = (() => {
      if (opts.interdit?.(nom)) return "un plan ne peut pas lancer un outil d'orchestration";
      if (!o) return "outil inconnu ou non ouvert à cette connexion";
      const recus = b.args ?? {};
      if (typeof recus !== "object" || Array.isArray(recus)) return "paramètres illisibles";
      // Seuls les paramètres déclarés par l'outil passent ; la clé d'idempotence est posée par le moteur.
      const props = o.inputSchema.properties ?? {};
      for (const cle of Object.keys(props)) if (cle !== "idempotency_key" && recus[cle] !== undefined && recus[cle] !== null) args[cle] = recus[cle];
      const manquant = (o.inputSchema.required ?? []).find((cle) => args[cle] === undefined || args[cle] === "");
      if (manquant) return `paramètre requis manquant : ${manquant}`;
      const faux = Object.keys(args).find((cle) => !conforme(props[cle], args[cle], true));
      if (faux) return `paramètre « ${faux} » du mauvais type`;
      const orpheline = dependances(args).find((ref) => !etapes.some((e) => e.id === ref));
      if (orpheline) return `référence à ${orpheline}, qui n'est pas une étape précédente retenue`;
      if (opts.budget !== undefined) {
        for (const [cle, v] of Object.entries(args)) {
          if (!ARGENT.test(cle)) continue;
          if (typeof v !== "number") return `montant « ${cle} » non vérifiable`;
          if (v > budget) return `engage ${v} alors que l'étape n'a que ${budget} de budget`;
        }
      }
      return null;
    })();
    if (motif) rejets.push(`${id} (${nom || "sans outil"}) : ${motif}`);
    else etapes.push({ id, titre: String(b.titre ?? nom).slice(0, 200), outil: nom, args, budget, statut: "a_faire" });
  });

  if (!etapes.length) return { etapes: [], rejets, erreur: "aucune étape du plan n'est exécutable avec les outils ouverts à cette connexion." };
  const total = etapes.reduce((s, e) => s + e.budget, 0);
  if (opts.budget !== undefined && total > opts.budget) return { etapes: [], rejets, erreur: `le plan engage ${total} pour un budget de ${opts.budget}.` };
  return { etapes, rejets };
}

// ─── Exécution ───────────────────────────────────────────────────────────────
const geler = (v: unknown): void => { if (v && typeof v === "object") { Object.values(v).forEach(geler); Object.freeze(v); } };

/**
 * Déroule le plan, dans l'ordre, par le seul `appeler` reçu (ctx.appeler : droits, politique,
 * accord, journal). N'écrit dans une étape que son état et son résultat ; outil et paramètres
 * sont gelés. `sauver` enregistre l'avancement et peut arrêter (plan annulé, durée dépassée).
 */
export async function derouler(
  etapes: Etape[], outils: OutilPlan[],
  appeler: (etape: Etape, args: Record<string, any>) => Promise<ResultatIA>,
  sauver: (index: number, avant: boolean) => Promise<"continuer" | "annule" | "pause"> = async () => "continuer",
): Promise<Fin> {
  etapes.forEach((e) => geler(e.args));
  for (const [i, e] of etapes.entries()) {
    if (e.statut === "fait" || e.statut === "abandonne") continue;
    if (e.statut === "attente_accord") return "attente_accord";
    if (e.statut === "echec") return "echec";
    if (dependances(e.args).some((ref) => etapes.find((x) => x.id === ref)?.statut === "abandonne")) {
      e.statut = "abandonne"; e.resultat = "Non exécutée : elle dépend d'une étape refusée par le marchand.";
      continue;
    }
    const r = resoudreArgs(e.args, etapes, outils.find((o) => o.name === e.outil));
    if ("erreur" in r) { e.statut = "echec"; e.code = "INVALID_INPUT"; e.resultat = `Non exécutée : ${r.erreur}`; await sauver(i, false); return "echec"; }

    e.statut = "en_cours";
    const signal = await sauver(i, true);
    if (signal !== "continuer") { e.statut = "a_faire"; return signal; }

    const res = await appeler(e, r.args);
    e.actionId = res.actionId;
    e.resultat = String(res.resultat ?? "").slice(0, 1500);
    // Appel déjà traité (reprise après coupure) : le journal dit ce qu'il est devenu.
    const rejoue = res.donnees?.replayed ? String(res.donnees.status) : null;
    if (res.code === "APPROVAL_REQUIRED" || rejoue === "accord_demande") e.statut = "attente_accord";
    else if (!res.succes || (rejoue && rejoue !== "execute")) {
      e.statut = "echec"; e.code = res.code ?? "INTERNAL";
      if (res.succes) e.resultat = "État incertain : l'appel a été interrompu. Vérifie avec un outil de lecture avant de refaire un plan.";
    } else {
      e.statut = "fait";
      // ponytail: données d'étape gardées jusqu'à 8 000 caractères ; au-delà, une référence vers elles échoue proprement.
      if (res.donnees && JSON.stringify(res.donnees).length <= 8000) e.donnees = res.donnees;
    }
    if ((await sauver(i, false)) === "annule") return "annule";
    if (e.statut !== "fait") return e.statut === "attente_accord" ? "attente_accord" : "echec";
  }
  return "termine";
}

// ─── Rapport ─────────────────────────────────────────────────────────────────
const FINS: Record<Fin, string> = {
  termine: "Toutes les étapes du plan ont été traitées.",
  attente_accord: "Arrêté : une étape attend l'accord du marchand (Axso → Contrôle IA). Une fois sa décision prise, relance axso_execute_goal avec le même plan_id.",
  echec: "Arrêté sur une étape en échec : les étapes suivantes n'ont PAS été exécutées.",
  annule: "Plan annulé : les étapes restantes n'ont pas été exécutées.",
  pause: "En pause (durée maximale d'une tâche atteinte) : relance axso_execute_goal avec le même plan_id pour continuer.",
};
const LIBELLES: Record<StatutEtape, string> = { a_faire: "non exécutée", en_cours: "en cours", fait: "faite", attente_accord: "attend l'accord du marchand — PAS faite", echec: "échec", abandonne: "abandonnée" };

/** Rapport factuel, écrit par du code : il ne dit que ce qui a été réellement exécuté. */
export function rapportPlan(objectif: string, etapes: Etape[], fin: Fin): string {
  const lignes = etapes.map((e, i) => `${i + 1}. [${LIBELLES[e.statut]}] ${e.titre} (${e.outil})${e.resultat ? ` — ${e.resultat.replace(/\s+/g, " ").slice(0, 300)}` : ""}`);
  const faites = etapes.filter((e) => e.statut === "fait").length;
  return [`Objectif : ${objectif}`, FINS[fin], `${faites} étape(s) faite(s) sur ${etapes.length}.`, ...lignes].join("\n");
}
