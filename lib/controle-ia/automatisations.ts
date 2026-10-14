// AXSO CONTROL — moteur des automatisations créées par une IA : QUAND (événement du bus, ou
// horaire) + SI (conditions) + ALORS (étapes : outil, accord, attente, branche).
// Rien à voir avec AutomationWorkflow (app/api/automation) : ces relances marketing envoient
// un message fixe ; ici on enchaîne des outils.
// Sécurité : une étape n'appelle jamais un service. Elle passe par appelerOutil() avec le
// contexte de la connexion qui a créé l'automatisation — droits, plan, accord du marchand et
// journal s'appliquent comme si l'IA appelait l'outil elle-même. Connexion coupée = arrêt.
import type { AutomatisationIA, ExecutionAutomatisation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { palierAuMoins } from "@/lib/plans";
import { automatisationEnCours, estTypeEvenement, type TypeEvenement } from "./evenements";
import type { ResultatIA } from "./types";

export { SCOPE_AUTOMATISATION } from "./regles";
import { SCOPE_AUTOMATISATION } from "./regles";
export const PLAFONDS = { parBoutique: 20, etapes: 12, conditions: 8, parHeure: 6, essais: 3, attenteMaxMin: 7 * 24 * 60 };
const PAUSE_ESSAI_MS = 5 * 60_000, ACCORD_MAX_MS = 7 * 86_400_000, INTERROMPUE_MS = 15 * 60_000, GARDE_MS = 30 * 86_400_000;

// ─── Définition ──────────────────────────────────────────────────────────────
export const OPERATEURS = ["<", "<=", ">", ">=", "=", "!=", "contient", "existe"] as const;
export interface Condition { champ: string; op: (typeof OPERATEURS)[number]; valeur?: unknown }
export type Declencheur =
  | { type: "evenement"; evenement: TypeEvenement }
  | { type: "horaire"; frequence: "jour" | "semaine"; heure: string; jour?: number; fuseau: string };
export type Etape =
  // « accord » : même appel d'outil, mais toujours soumis au marchand avant d'être exécuté.
  | { type: "outil" | "accord"; outil: string; args: Record<string, unknown>; essais?: number }
  | { type: "attente"; minutes: number }
  // Conditions fausses : on saute à l'étape `sinon` (plus loin seulement : pas de boucle) ou on s'arrête.
  | { type: "branche"; conditions: Condition[]; sinon: "arreter" | number };
export interface Definition { nom: string; declencheur: Declencheur; conditions: Condition[]; etapes: Etape[] }

/** Ce que les étapes peuvent lire : l'événement déclencheur et le résultat des étapes déjà faites. */
export interface Contexte {
  evenement: Record<string, unknown>;
  etapes: Record<string, { succes: boolean; resultat: string; donnees?: unknown }>;
  /** Demande d'accord en cours : la ligne du journal ActionIA à surveiller, et depuis quand. */
  attente?: { actionId: string; depuis: string };
  essai?: number;
}

const estObjet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Valeur à un chemin pointé (« stock », « evenement.stock », « etapes.1.donnees.total »). Un chemin sans préfixe vise l'événement. */
export function lire(contexte: Pick<Contexte, "evenement" | "etapes">, chemin: string): unknown {
  const segments = chemin.split(".");
  if (segments[0] !== "evenement" && segments[0] !== "etapes") segments.unshift("evenement");
  let v: unknown = { evenement: contexte.evenement, etapes: contexte.etapes };
  for (const s of segments) {
    // Propriétés propres seulement : pas de __proto__ ni de constructor.
    if (v === null || typeof v !== "object" || !Object.hasOwn(v, s)) return undefined;
    v = (v as Record<string, unknown>)[s];
  }
  return v;
}

const MODELE = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** Remplace les « {{chemin}} » d'un argument. Seul dans la chaîne : la valeur garde son type ; au milieu d'un texte : elle est écrite. */
export function resoudre(valeur: unknown, contexte: Pick<Contexte, "evenement" | "etapes">): unknown {
  if (typeof valeur === "string") {
    const seul = valeur.match(/^\{\{\s*([\w.-]+)\s*\}\}$/);
    if (seul) return lire(contexte, seul[1]) ?? null;
    return valeur.replace(MODELE, (_, c) => { const v = lire(contexte, c); return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); });
  }
  if (Array.isArray(valeur)) return valeur.map((v) => resoudre(v, contexte));
  if (estObjet(valeur)) return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, resoudre(v, contexte)]));
  return valeur;
}

const numerique = (v: unknown) => (typeof v === "number" || (typeof v === "string" && v.trim() !== "")) && Number.isFinite(Number(v));

export function evaluerCondition(c: Condition, contexte: Pick<Contexte, "evenement" | "etapes">): boolean {
  const a = lire(contexte, c.champ), b = resoudre(c.valeur, contexte);
  if (c.op === "existe") return a != null && a !== "";
  if (c.op === "contient") return Array.isArray(a) ? a.some((x) => String(x) === String(b)) : typeof a === "string" && a.toLowerCase().includes(String(b ?? "").toLowerCase());
  const nombres = numerique(a) && numerique(b);
  if (c.op === "=" || c.op === "!=") return (nombres ? Number(a) === Number(b) : String(a ?? "") === String(b ?? "")) === (c.op === "=");
  // Une comparaison d'ordre sur autre chose que deux nombres est fausse (donnée absente = condition non remplie).
  if (!nombres) return false;
  const x = Number(a), y = Number(b);
  return c.op === "<" ? x < y : c.op === "<=" ? x <= y : c.op === ">" ? x > y : x >= y;
}

export const conditionsVraies = (conditions: Condition[], contexte: Pick<Contexte, "evenement" | "etapes">) => conditions.every((c) => evaluerCondition(c, contexte));

// ─── Horaire ─────────────────────────────────────────────────────────────────
export const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export function fuseauValide(fuseau: unknown): fuseau is string {
  try { return typeof fuseau === "string" && !!new Intl.DateTimeFormat("fr", { timeZone: fuseau }); } catch { return false; }
}

/** L'heure qu'il est dans le fuseau, écrite comme un instant UTC (pour calculer sur le calendrier local). */
function heureLocale(instant: Date, fuseau: string): Date {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: fuseau, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(instant).map((x) => [x.type, Number(x.value)]));
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}

/** Prochain passage strictement après `apres` : chaque jour, ou chaque semaine au jour dit, à l'heure locale de la boutique. */
export function prochaineExecution(d: Extract<Declencheur, { type: "horaire" }>, apres: Date): Date {
  const [h, m] = d.heure.split(":").map(Number);
  const ici = heureLocale(apres, d.fuseau);
  for (let j = 0; j <= 8; j++) {
    const local = new Date(Date.UTC(ici.getUTCFullYear(), ici.getUTCMonth(), ici.getUTCDate() + j, h, m));
    if (d.frequence === "semaine" && local.getUTCDay() !== d.jour) continue;
    // Heure locale → instant : on retire le décalage du fuseau, recalculé une fois (changement d'heure).
    let instant = new Date(local.getTime() - (heureLocale(local, d.fuseau).getTime() - local.getTime()));
    instant = new Date(local.getTime() - (heureLocale(instant, d.fuseau).getTime() - instant.getTime()));
    if (instant > apres) return instant;
  }
  return new Date(apres.getTime() + 86_400_000); // inatteignable avec une définition validée
}

/** Le déclencheur en clair, pour le marchand et pour l'IA. */
export const decrireDeclencheur = (d: Declencheur) =>
  d?.type === "evenement" ? `quand « ${d.evenement} »` : d?.type === "horaire" ? `${d.frequence === "jour" ? "chaque jour" : `chaque ${JOURS[d.jour ?? 0]}`} à ${d.heure} (${d.fuseau})` : "déclencheur inconnu";

// ─── Validation ──────────────────────────────────────────────────────────────
/** Ce que le catalogue dit d'un outil : inconnu, interdit dans une automatisation (outil d'orchestration), lecture ou écriture. */
export type NatureOutil = "inconnu" | "interdit" | "lecture" | "ecriture";
type Valide<T> = { ok: true; valeur: T } | { ok: false; erreur: string };
const non = (erreur: string) => ({ ok: false as const, erreur });

function validerConditions(brut: unknown, ou: string): Valide<Condition[]> {
  if (brut == null) return { ok: true, valeur: [] };
  if (!Array.isArray(brut) || brut.length > PLAFONDS.conditions) return non(`${ou} : « conditions » est une liste d'au plus ${PLAFONDS.conditions} comparaisons.`);
  const valeur: Condition[] = [];
  for (const c of brut) {
    if (!estObjet(c) || typeof c.champ !== "string" || !/^[\w.-]{1,120}$/.test(c.champ)) return non(`${ou} : chaque condition a un « champ » (ex. « stock », « etapes.1.donnees.total »).`);
    if (!OPERATEURS.includes(c.op as any)) return non(`${ou} : opérateur « ${String(c.op).slice(0, 20)} » inconnu. Opérateurs : ${OPERATEURS.join(" ")}.`);
    if (c.op !== "existe" && (c.valeur === undefined || (typeof c.valeur === "object" && c.valeur !== null))) return non(`${ou} : la condition sur « ${c.champ} » demande une « valeur » simple (nombre, texte ou « {{chemin}} »).`);
    valeur.push({ champ: c.champ, op: c.op as Condition["op"], ...(c.op !== "existe" && { valeur: c.valeur }) });
  }
  return { ok: true, valeur };
}

function validerDeclencheur(d: unknown, fuseauDefaut: string): Valide<Declencheur> {
  if (!estObjet(d)) return non("« declencheur » manquant.");
  if (d.type === "evenement") {
    return estTypeEvenement(d.evenement) ? { ok: true, valeur: { type: "evenement", evenement: d.evenement } } : non("déclencheur : « evenement » inconnu.");
  }
  if (d.type !== "horaire") return non("déclencheur : « type » vaut « evenement » ou « horaire ».");
  if (d.frequence !== "jour" && d.frequence !== "semaine") return non("déclencheur horaire : « frequence » vaut « jour » ou « semaine ».");
  if (typeof d.heure !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.heure)) return non("déclencheur horaire : « heure » au format HH:MM (ex. 08:00).");
  const jour = typeof d.jour === "string" ? JOURS.indexOf(d.jour.toLowerCase()) : -1;
  if (d.frequence === "semaine" && jour < 0) return non(`déclencheur horaire : « jour » parmi ${JOURS.join(", ")}.`);
  const fuseau = d.fuseau ?? fuseauDefaut;
  if (!fuseauValide(fuseau)) return non("déclencheur horaire : « fuseau » inconnu (nom IANA, ex. Africa/Douala).");
  return { ok: true, valeur: { type: "horaire", frequence: d.frequence, heure: d.heure, ...(d.frequence === "semaine" && { jour }), fuseau } };
}

/** Valide et nettoie une définition envoyée par une IA. `nature` : ce que le catalogue dit de chaque outil cité. */
export function validerDefinition(brut: unknown, nature: (outil: string) => NatureOutil, fuseauDefaut = "Africa/Douala"): Valide<Definition> {
  if (!estObjet(brut)) return non("définition illisible.");
  const nom = typeof brut.nom === "string" ? brut.nom.trim().slice(0, 80) : "";
  if (!nom) return non("« nom » manquant.");
  const declencheur = validerDeclencheur(brut.declencheur, fuseauDefaut);
  if (!declencheur.ok) return declencheur;
  const conditions = validerConditions(brut.conditions, "conditions de déclenchement");
  if (!conditions.ok) return conditions;
  if (!Array.isArray(brut.etapes) || !brut.etapes.length || brut.etapes.length > PLAFONDS.etapes) return non(`« etapes » : de 1 à ${PLAFONDS.etapes} étapes.`);

  const etapes: Etape[] = [];
  for (const [i, e] of brut.etapes.entries()) {
    const ou = `étape ${i + 1}`;
    if (!estObjet(e)) return non(`${ou} illisible.`);
    if (e.type === "outil" || e.type === "accord") {
      if (typeof e.outil !== "string" || !e.outil) return non(`${ou} : « outil » manquant.`);
      const n = nature(e.outil);
      if (n === "inconnu") return non(`${ou} : l'outil « ${e.outil.slice(0, 60)} » n'existe pas.`);
      // Pas d'automatisation qui en crée, en lance ou en modifie une autre (ni objectif, ni webhook).
      if (n === "interdit") return non(`${ou} : « ${e.outil} » est un outil d'automatisation ou d'orchestration, il ne peut pas être une étape.`);
      if (e.type === "accord" && n === "lecture") return non(`${ou} : « ${e.outil} » ne modifie rien, il n'y a pas d'accord à demander. Mets une étape « outil ».`);
      if (e.args != null && !estObjet(e.args)) return non(`${ou} : « args » est un objet.`);
      if (JSON.stringify(e.args ?? {}).length > 4000) return non(`${ou} : « args » trop volumineux.`);
      const essais = e.essais == null ? 1 : Number(e.essais);
      if (!Number.isInteger(essais) || essais < 1 || essais > PLAFONDS.essais) return non(`${ou} : « essais » de 1 à ${PLAFONDS.essais}.`);
      etapes.push({ type: e.type, outil: e.outil, args: (e.args ?? {}) as Record<string, unknown>, ...(essais > 1 && { essais }) });
    } else if (e.type === "attente") {
      const minutes = Number(e.minutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > PLAFONDS.attenteMaxMin) return non(`${ou} : « minutes » de 1 à ${PLAFONDS.attenteMaxMin} (7 jours).`);
      etapes.push({ type: "attente", minutes });
    } else if (e.type === "branche") {
      const c = validerConditions(e.conditions, ou);
      if (!c.ok) return c;
      if (!c.valeur.length) return non(`${ou} : une branche a au moins une condition.`);
      // « sinon » est un numéro d'étape (à partir de 1), forcément plus loin : une automatisation ne boucle pas.
      const sinon = e.sinon ?? "arreter";
      if (sinon !== "arreter" && !(Number.isInteger(sinon) && (sinon as number) > i + 1 && (sinon as number) <= brut.etapes.length)) return non(`${ou} : « sinon » vaut « arreter » ou le numéro d'une étape située après celle-ci.`);
      etapes.push({ type: "branche", conditions: c.valeur, sinon: sinon === "arreter" ? "arreter" : (sinon as number) - 1 });
    } else return non(`${ou} : « type » vaut outil, accord, attente ou branche.`);
  }
  if (!etapes.some((e) => e.type === "outil" || e.type === "accord")) return non("une automatisation appelle au moins un outil.");
  return { ok: true, valeur: { nom, declencheur: declencheur.valeur, conditions: conditions.valeur, etapes } };
}

// ─── Garde-fous ──────────────────────────────────────────────────────────────
/**
 * Raison de ne pas lancer, ou null. Un événement provoqué par une étape d'automatisation n'en
 * déclenche aucune (ni elle-même, ni une autre : pas de boucle, pas de cascade) ; et une
 * automatisation ne part qu'un nombre limité de fois par heure, quoi qu'il arrive.
 */
export function refusDeLancer(p: { provoquePar?: string | null; lancementsHeure: number }): string | null {
  if (p.provoquePar) return "événement provoqué par une automatisation";
  if (p.lancementsHeure >= PLAFONDS.parHeure) return `plafond de ${PLAFONDS.parHeure} déclenchements par heure atteint`;
  return null;
}

// ─── Exécution ───────────────────────────────────────────────────────────────
const REESSAYABLES = new Set<string | undefined>([undefined, "UNAVAILABLE", "RATE_LIMITED", "INTERNAL"]);

/** Ce qu'on garde du résultat d'une étape pour les suivantes (texte court, données si elles restent petites). */
function compacter(r: ResultatIA) {
  const donnees = JSON.stringify(r.donnees ?? null);
  return { succes: r.succes, resultat: r.resultat.slice(0, 2000), ...(donnees.length <= 20_000 && { donnees: JSON.parse(donnees) }) };
}

/** Avance une exécution déjà marquée « en_cours » jusqu'à sa fin, une attente ou une demande d'accord. */
async function avancer(a: AutomatisationIA, x: ExecutionAutomatisation) {
  const etapes = a.etapes as unknown as Etape[];
  const c = x.contexte as unknown as Contexte;
  const journal = [...(x.journal as unknown[])];
  let i = x.etape;
  const noter = (statut: string, detail: string, e?: Etape) =>
    journal.push({ etape: i + 1, type: e?.type, ...(e && "outil" in e && { outil: e.outil }), statut, detail: detail.slice(0, 300), le: new Date().toISOString() });
  const poser = (statut: string, reprendreLe: Date | null = null) =>
    prisma.executionAutomatisation.update({ where: { id: x.id }, data: { statut, etape: i, contexte: c as any, journal: journal as any, reprendreLe } });
  const finir = async (statut: "termine" | "echec", bilan: string) => {
    await poser(statut);
    await prisma.automatisationIA.updateMany({ where: { id: a.id }, data: { dernierResultat: bilan.slice(0, 500) } });
  };

  // Import dynamique : serveur.ts importe les modules, dont celui qui importe ce fichier.
  const { appelerOutil, contexteDeConnexion } = await import("./serveur");
  // Droits et plan relus à chaque passage : ce sont ceux d'aujourd'hui, pas ceux du jour de la création.
  const ia = await contexteDeConnexion(a.connexionId, a.tenantId);
  if (!ia) {
    await prisma.automatisationIA.updateMany({ where: { id: a.id }, data: { actif: false, prochaineExecution: null } });
    return finir("echec", "Arrêtée : la connexion de l'IA qui l'a créée a été coupée.");
  }
  if (!ia.scopes.includes(SCOPE_AUTOMATISATION) || !palierAuMoins(ia.plan, "palier2")) return finir("echec", "Non exécutée : le plan ou les droits de la connexion ne permettent plus les automatisations.");

  // Reprise après une demande d'accord : c'est le journal des actions qui dit ce que le marchand a décidé.
  if (c.attente) {
    const action = await prisma.actionIA.findFirst({ where: { id: c.attente.actionId, tenantId: a.tenantId }, select: { statut: true, sortie: true } });
    if (action?.statut === "accord_demande") {
      if (Date.now() - new Date(c.attente.depuis).getTime() < ACCORD_MAX_MS) return void await poser("en_attente");
      noter("echec", "accord non donné après 7 jours", etapes[i]);
      return finir("echec", `Étape ${i + 1} : l'accord du marchand n'est pas venu, arrêt.`);
    }
    if (action?.statut !== "execute") {
      noter(action?.statut === "refuse" ? "refuse" : "echec", action?.sortie ?? "action introuvable", etapes[i]);
      return finir(action?.statut === "refuse" ? "termine" : "echec", `Étape ${i + 1} : ${action?.statut === "refuse" ? "refusée par le marchand" : "en échec après accord"}, arrêt.`);
    }
    c.etapes[i] = { succes: true, resultat: (action.sortie ?? "").slice(0, 2000) };
    noter("ok", action.sortie ?? "", etapes[i]);
    delete c.attente;
    i++;
  }

  while (i < etapes.length) {
    const e = etapes[i];
    if (e.type === "attente") {
      noter("attente", `${e.minutes} min`, e);
      i++;
      return void await poser("en_attente", new Date(Date.now() + e.minutes * 60_000));
    }
    if (e.type === "branche") {
      const vrai = conditionsVraies(e.conditions, c);
      noter(vrai ? "ok" : "saut", vrai ? "conditions remplies" : e.sinon === "arreter" ? "conditions non remplies : arrêt" : `conditions non remplies : étape ${e.sinon + 1}`, e);
      if (!vrai && e.sinon === "arreter") return finir("termine", `Arrêt à l'étape ${i + 1} : conditions non remplies.`);
      i = vrai ? i + 1 : (e.sinon as number);
      continue;
    }
    // Le circuit complet, comme pour un appel de l'IA. « accord » : mode assistant, où toute modification attend le marchand.
    const ctx = { ...ia, interne: true, ...(e.type === "accord" && { mode: "assistant" as const }) };
    const args = resoudre(e.args, c) as Record<string, unknown>;
    const r = await automatisationEnCours.run(a.id, () => appelerOutil(ctx, e.outil, args));
    if (r.code === "APPROVAL_REQUIRED" && r.actionId) {
      c.attente = { actionId: r.actionId, depuis: new Date().toISOString() };
      noter("accord_demande", "en attente de l'accord du marchand", e);
      return void await poser("en_attente");
    }
    if (!r.succes) {
      const essai = c.essai ?? 1;
      noter("echec", r.resultat, e);
      if (REESSAYABLES.has(r.code) && essai < (e.essais ?? 1)) {
        c.essai = essai + 1;
        return void await poser("en_attente", new Date(Date.now() + PAUSE_ESSAI_MS));
      }
      return finir("echec", `Échec à l'étape ${i + 1} (${e.outil}) : ${r.resultat}`);
    }
    c.etapes[i] = compacter(r);
    delete c.essai;
    noter("ok", r.resultat, e);
    i++;
  }
  return finir("termine", `Terminée : ${etapes.length} étape(s).`);
}

/** Lance une automatisation pour un événement (ou un passage horaire), si ses garde-fous le permettent. */
async function lancer(a: AutomatisationIA, evenement: Record<string, unknown>) {
  const lancementsHeure = await prisma.executionAutomatisation.count({ where: { automatisationId: a.id, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  const refus = refusDeLancer({ lancementsHeure });
  if (refus) {
    await prisma.automatisationIA.updateMany({ where: { id: a.id }, data: { dernierResultat: `Non lancée : ${refus}.` } });
    return false;
  }
  const x = await prisma.executionAutomatisation.create({ data: { automatisationId: a.id, tenantId: a.tenantId, contexte: { evenement, etapes: {} } as any } });
  await prisma.automatisationIA.updateMany({ where: { id: a.id }, data: { executions: { increment: 1 }, derniereExecution: new Date() } });
  // ponytail: exécutée dans la requête qui a publié l'événement (bornée par son maxDuration) ; une exécution coupée
  // est marquée en échec par le cron. Passer par une file si les chaînes d'outils deviennent longues.
  await avancer(a, x);
  return true;
}

const avertir = (ou: string, e: unknown) => console.warn("[automatisations]", ou, String((e as Error)?.message).slice(0, 200));

/** Appelé par le bus : lance les automatisations de la boutique abonnées à cet événement. */
export async function declencherParEvenement(tenantId: string, type: TypeEvenement, donnees: Record<string, unknown>, provoquePar: string | null) {
  if (refusDeLancer({ provoquePar, lancementsHeure: 0 })) return;
  const evenement = { ...donnees, type };
  // Filtré ici plutôt qu'en SQL : une boutique a au plus PLAFONDS.parBoutique automatisations.
  const abonnees = (await prisma.automatisationIA.findMany({ where: { tenantId, actif: true } })).filter((a) => {
    const d = a.declencheur as unknown as Declencheur;
    return d?.type === "evenement" && d.evenement === type && conditionsVraies(a.conditions as unknown as Condition[], { evenement, etapes: {} });
  });
  for (const a of abonnees) await lancer(a, evenement).catch((e) => avertir(a.id, e));
}

/**
 * Passage du cron : automatisations horaires dues, exécutions en attente (délai écoulé, nouvel
 * essai, accord donné ou refusé), exécutions interrompues, purge. S'arrête avant `budgetMs`.
 */
export async function passeDuCron(budgetMs = 45_000) {
  const debut = Date.now(), maintenant = new Date();
  const reste = () => Date.now() - debut < budgetMs;
  const bilan = { lancees: 0, reprises: 0, interrompues: 0 };

  // Coupée en plein milieu (durée maximale de la requête) : on ne rejoue pas une étape qui a peut-être déjà agi.
  bilan.interrompues = (await prisma.executionAutomatisation.updateMany({ where: { statut: "en_cours", updatedAt: { lt: new Date(debut - INTERROMPUE_MS) } }, data: { statut: "echec" } })).count;

  const dues = await prisma.automatisationIA.findMany({ where: { actif: true, prochaineExecution: { lte: maintenant } }, orderBy: { prochaineExecution: "asc" }, take: 50 });
  for (const a of dues) {
    if (!reste()) break;
    const d = a.declencheur as unknown as Declencheur;
    // Prochain passage posé AVANT de lancer, sous condition : deux crons simultanés ne lancent pas deux fois.
    // Un passage manqué (cron en retard) n'est fait qu'une fois, pas rattrapé jour par jour.
    const pris = await prisma.automatisationIA.updateMany({ where: { id: a.id, actif: true, prochaineExecution: a.prochaineExecution }, data: { prochaineExecution: d?.type === "horaire" ? prochaineExecution(d, maintenant) : null } });
    if (!pris.count || d?.type !== "horaire") continue;
    if (await lancer(a, { type: "horaire", date: maintenant.toISOString() }).catch((e) => (avertir(a.id, e), false))) bilan.lancees++;
  }

  const attentes = await prisma.executionAutomatisation.findMany({ where: { statut: "en_attente", OR: [{ reprendreLe: null }, { reprendreLe: { lte: maintenant } }] }, orderBy: { updatedAt: "asc" }, take: 100 });
  for (const x of attentes) {
    if (!reste()) break;
    const pris = await prisma.executionAutomatisation.updateMany({ where: { id: x.id, statut: "en_attente" }, data: { statut: "en_cours" } });
    if (!pris.count) continue;
    const a = await prisma.automatisationIA.findFirst({ where: { id: x.automatisationId, tenantId: x.tenantId } });
    // Mise en pause ou supprimée entre-temps : la suite de la chaîne ne part pas.
    if (!a?.actif) { await prisma.executionAutomatisation.updateMany({ where: { id: x.id }, data: { statut: "echec" } }); continue; }
    await avancer(a, x).then(() => bilan.reprises++, (e) => avertir(a.id, e));
  }

  const vieux = new Date(debut - GARDE_MS);
  await Promise.all([
    prisma.evenementIA.deleteMany({ where: { createdAt: { lt: vieux } } }),
    prisma.executionAutomatisation.deleteMany({ where: { statut: { in: ["termine", "echec"] }, updatedAt: { lt: vieux } } }),
  ]).catch((e) => avertir("purge", e));
  return { ok: true, ...bilan };
}
