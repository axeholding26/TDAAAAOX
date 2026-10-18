// Contexte de navigation (source, période, comparaison, segments), porté par l'URL :
// chaque lien interne le recopie, donc un drill-down Cameroun → Pro → Gros GMV
// garde ses filtres d'une page à l'autre. Module pur (client + serveur).
import type { PlanId, Source } from "./types";

export type Periode = "aujourdhui" | "hier" | "7j" | "30j" | "90j" | "ytd" | "annee_prec" | "perso";
export const PERIODES: { id: Periode; nom: string }[] = [
  { id: "aujourdhui", nom: "Aujourd'hui" }, { id: "hier", nom: "Hier" }, { id: "7j", nom: "7 jours" }, { id: "30j", nom: "30 jours" },
  { id: "90j", nom: "90 jours" }, { id: "ytd", nom: "Depuis le 1er janvier" }, { id: "annee_prec", nom: "Année précédente" }, { id: "perso", nom: "Personnalisée" },
];

export interface Filtres {
  source: Source;
  periode: Periode;
  du?: string; // AAAA-MM-JJ (période personnalisée)
  au?: string;
  comparer: "prec" | "annee";
  pays?: string;
  plan?: PlanId;
  taille?: "petit" | "moyen" | "grand"; // GMV des 90 derniers jours
  industrie?: string;
  acq?: string; // source d'acquisition
  anciennete?: "nouveau" | "etabli"; // < 30 jours / plus
  activite?: "actif" | "dormant"; // activité sur 14 jours
}

export const CLES_FILTRES = ["source", "periode", "du", "au", "comparer", "pays", "plan", "taille", "industrie", "acq", "anciennete", "activite"] as const;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Params = Record<string, string | string[] | undefined> | URLSearchParams;
const lire = (p: Params, k: string) => {
  const v = p instanceof URLSearchParams ? p.get(k) ?? undefined : p[k];
  return Array.isArray(v) ? v[0] : v || undefined;
};

/** Valide chaque paramètre contre une liste fermée : rien d'arbitraire n'entre dans le moteur. */
export function lireFiltres(p: Params, sourceParDefaut: Source = "reel"): Filtres {
  const un = <T extends string>(k: string, ok: readonly T[]) => { const v = lire(p, k); return ok.includes(v as T) ? (v as T) : undefined; };
  const periode = un("periode", PERIODES.map((x) => x.id)) ?? "30j";
  const du = lire(p, "du"), au = lire(p, "au");
  const libre = (k: string) => { const v = lire(p, k); return v && /^[\p{L}\p{N} &'_-]{1,40}$/u.test(v) ? v : undefined; };
  return {
    source: un("source", ["reel", "demo"] as const) ?? sourceParDefaut,
    periode: periode === "perso" && !(du && au && DATE.test(du) && DATE.test(au)) ? "30j" : periode,
    du: du && DATE.test(du) ? du : undefined,
    au: au && DATE.test(au) ? au : undefined,
    comparer: un("comparer", ["prec", "annee"] as const) ?? "prec",
    pays: (() => { const v = lire(p, "pays"); return v && /^[A-Z]{2}$/.test(v) ? v : undefined; })(),
    plan: un("plan", ["palier0", "palier1", "palier2"] as const),
    taille: un("taille", ["petit", "moyen", "grand"] as const),
    industrie: libre("industrie"),
    acq: libre("acq"),
    anciennete: un("anciennete", ["nouveau", "etabli"] as const),
    activite: un("activite", ["actif", "dormant"] as const),
  };
}

/** Query string du contexte (valeurs par défaut omises), avec surcharges éventuelles. */
export function qs(f: Partial<Filtres>, surcharges: Partial<Record<keyof Filtres, string | undefined | null>> = {}): string {
  const out = new URLSearchParams();
  const m = { ...f, ...surcharges } as Record<string, string | undefined | null>;
  for (const k of CLES_FILTRES) {
    const v = m[k];
    if (!v) continue;
    if ((k === "periode" && v === "30j") || (k === "comparer" && v === "prec") || (k === "source" && v === "reel")) continue;
    if ((k === "du" || k === "au") && m.periode !== "perso") continue;
    out.set(k, v);
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export const lien = (chemin: string, f: Partial<Filtres>, surcharges: Partial<Record<keyof Filtres, string | undefined | null>> = {}) => {
  const [base, ancre] = chemin.split("#");
  const q = qs(f, surcharges);
  if (!base.includes("?")) return base + q + (ancre ? `#${ancre}` : "");
  return base + (q ? "&" + q.slice(1) : "") + (ancre ? `#${ancre}` : "");
};

export const JOUR = 86_400_000;

export interface Fenetre { debut: number; fin: number }
export interface Fenetres { cur: Fenetre; prev: Fenetre; libelle: string; libelleComp: string }

/** Fenêtre courante et fenêtre de comparaison. Jours calendaires en UTC (Afrique centrale/ouest : UTC+0/+1). */
export function fenetres(f: Filtres, maintenant: number): Fenetres {
  const aujourdhui = Math.floor(maintenant / JOUR) * JOUR;
  const an = new Date(maintenant).getUTCFullYear();
  let cur: Fenetre;
  switch (f.periode) {
    case "aujourdhui": cur = { debut: aujourdhui, fin: maintenant }; break;
    case "hier": cur = { debut: aujourdhui - JOUR, fin: aujourdhui }; break;
    case "7j": cur = { debut: maintenant - 7 * JOUR, fin: maintenant }; break;
    case "90j": cur = { debut: maintenant - 90 * JOUR, fin: maintenant }; break;
    case "ytd": cur = { debut: Date.UTC(an, 0, 1), fin: maintenant }; break;
    case "annee_prec": cur = { debut: Date.UTC(an - 1, 0, 1), fin: Date.UTC(an, 0, 1) }; break;
    case "perso": {
      const d = Date.parse(`${f.du}T00:00:00Z`), a = Date.parse(`${f.au}T00:00:00Z`) + JOUR;
      cur = d < a ? { debut: d, fin: Math.min(a, maintenant) } : { debut: maintenant - 30 * JOUR, fin: maintenant };
      break;
    }
    default: cur = { debut: maintenant - 30 * JOUR, fin: maintenant };
  }
  const duree = cur.fin - cur.debut;
  const prev = f.comparer === "annee" ? { debut: cur.debut - 365 * JOUR, fin: cur.fin - 365 * JOUR } : { debut: cur.debut - duree, fin: cur.debut };
  const nom = PERIODES.find((p) => p.id === f.periode)?.nom ?? "";
  return {
    cur, prev,
    libelle: f.periode === "perso" ? `${f.du} → ${f.au}` : nom,
    libelleComp: f.comparer === "annee" ? "vs année précédente" : f.periode === "aujourdhui" ? "vs hier" : "vs période précédente",
  };
}
