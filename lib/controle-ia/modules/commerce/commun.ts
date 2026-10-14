// Module « commerce » — aides communes : forme d'un outil, refus typés, lecture des paramètres.
// Un paramètre invalide lève Refus : commerce.ts le rend au modèle avec son code, sans pile.
import type { ModuleKey } from "@/lib/permissions";
import type { CodeErreur, CtxOutil, OutilIA, ResultatIA } from "../../types";

export type Args = Record<string, any>;
export interface Outil extends OutilIA { run: (a: Args, ctx: CtxOutil) => Promise<ResultatIA> }

export class Refus extends Error {
  constructor(public code: CodeErreur, message: string) { super(message); }
}
export const refuser = (code: CodeErreur, message: string): never => { throw new Refus(code, message); };
const invalide = (message: string) => refuser("INVALID_INPUT", message);

export const objet = (properties: Record<string, any> = {}, required: string[] = []) => ({ type: "object" as const, properties, required });

/** Paramètre documenté sur les écritures produit / commande / client ; vérifié avant l'exécution par lib/controle-ia/recus.ts (conflitVersion). */
export const VERSION = { type: "string", description: "Optionnel : la `version` renvoyée par la lecture (get_product, get_order, get_customer). Si l'élément a changé depuis, l'appel est refusé (CONFLICT) : relis puis réessaie." };

export const ok = (resultat: string, donnees?: Record<string, unknown>): ResultatIA => ({ succes: true, resultat, donnees });
/** Lecture : une phrase, puis les données compactes (le modèle lit le texte, le client MCP reçoit aussi `donnees`). */
export const lu = (titre: string, donnees: Record<string, unknown>): ResultatIA => ({ succes: true, resultat: `${titre}\n${JSON.stringify(donnees)}`, donnees });

const absent = (v: unknown) => v === undefined || v === null || v === "";

/** Texte nettoyé et borné ; `undefined` s'il est absent et facultatif. */
export function texte(a: Args, nom: string, o: { max?: number; requis?: boolean } = {}): string | undefined {
  const v = a[nom];
  if (absent(v)) return o.requis ? invalide(`« ${nom} » est obligatoire.`) : undefined;
  if (typeof v !== "string" && typeof v !== "number") return invalide(`« ${nom} » doit être un texte.`);
  const t = String(v).trim();
  if (!t && o.requis) return invalide(`« ${nom} » est obligatoire.`);
  if (t.length > (o.max ?? 200)) return invalide(`« ${nom} » dépasse ${o.max ?? 200} caractères.`);
  return t;
}
export const requis = (a: Args, nom: string, max?: number) => texte(a, nom, { max, requis: true })!;

export function nombre(a: Args, nom: string, o: { min?: number; max?: number; entier?: boolean; requis?: boolean } = {}): number | undefined {
  const v = a[nom];
  if (absent(v)) return o.requis ? invalide(`« ${nom} » est obligatoire.`) : undefined;
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  const min = o.min ?? 0, max = o.max ?? 1e9;
  if (!Number.isFinite(n) || (o.entier && !Number.isInteger(n)) || n < min || n > max) {
    return invalide(`« ${nom} » doit être un nombre${o.entier ? " entier" : ""} entre ${min} et ${max}.`);
  }
  return n;
}
/** Limite d'une liste : jamais plus que `max`. */
export const limite = (a: Args, defaut: number, max: number) => nombre(a, "limit", { min: 1, max, entier: true }) ?? defaut;
export const decalage = (a: Args) => nombre(a, "offset", { min: 0, max: 100_000, entier: true }) ?? 0;

export function parmi<T extends string>(a: Args, nom: string, valeurs: readonly T[], defaut?: T): T {
  const v = a[nom];
  if (absent(v) && defaut !== undefined) return defaut;
  if (!valeurs.includes(v)) return invalide(`« ${nom} » doit valoir : ${valeurs.join(", ")}.`);
  return v;
}

export function booleen(a: Args, nom: string): boolean | undefined {
  const v = a[nom];
  if (absent(v)) return undefined;
  if (typeof v !== "boolean") return invalide(`« ${nom} » doit être true ou false.`);
  return v;
}

export function liste(a: Args, nom: string, max: number): any[] | undefined {
  const v = a[nom];
  if (absent(v)) return undefined;
  if (!Array.isArray(v) || v.length > max) return invalide(`« ${nom} » doit être une liste de ${max} éléments au plus.`);
  return v;
}

/** Liste de textes courts (tags, identifiants). */
export function textes(a: Args, nom: string, max: number, longueur = 80): string[] | undefined {
  return liste(a, nom, max)?.map((v, i) => requis({ [`${nom}[${i}]`]: v }, `${nom}[${i}]`, longueur));
}

/** Adresses de médias : https uniquement (ou chemin du site), jamais de `javascript:` ni de `data:`. */
export function urls(a: Args, nom: string, max: number): string[] | undefined {
  return textes(a, nom, max, 600)?.map((u) => (/^(https:\/\/|\/)[^\s]+$/i.test(u) ? u : invalide(`« ${nom} » : « ${u.slice(0, 60)} » n'est pas une adresse https.`)));
}
export const url = (a: Args, nom: string) => (absent(a[nom]) ? undefined : urls({ [nom]: [a[nom]] }, nom, 1)![0]);

/** Droit de lecture de l'IA sur un module (sources de la recherche, sections d'un rapport, coûts). */
export const peutLire = (ctx: CtxOutil, module: ModuleKey) => ctx.grille[module] !== "aucun";

export const JOUR = 86_400_000;
export const depuisJours = (jours: number) => new Date(Date.now() - jours * JOUR);
export const arrondi = (n: number) => Math.round(n * 100) / 100;
