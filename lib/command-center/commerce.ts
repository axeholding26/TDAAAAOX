// Calculs propres aux pages Commerce, Paiements et Opérations (module pur, sans Prisma).
// Les métriques « officielles » restent dans moteur.ts ; ici seulement ce qui n'y est pas.
import type { Commande } from "./types";
import type { Format, Mesure } from "./moteur";
import { JOUR, type Fenetre } from "./contexte";

export const NOM_METHODE: Record<string, string> = {
  mobile_money: "Mobile Money", wave: "Wave", carte: "Carte bancaire", cod: "Paiement à la livraison",
  especes: "Espèces", orange_money: "Orange Money", mtn_momo: "MTN MoMo", virement: "Virement",
};
export const nomMethode = (m: string) => NOM_METHODE[m] ?? m.replace(/_/g, " ");

/** Mesure pour un indicateur hors catalogue (même statut / variation que `mesurer`). */
export function mesureLibre(o: { id: string; nom: string; format: Format; sens?: 1 | -1; valeur: number | null; precedente?: number | null; serie?: (number | null)[]; page: string; description: string; formule: string }): Mesure {
  const sens = o.sens ?? 1, a = o.valeur, b = o.precedente ?? null;
  const variation = a == null || b == null ? null : o.format === "pct" ? a - b : b === 0 ? (a === 0 ? 0 : null) : (a - b) / Math.abs(b);
  const seuil = o.format === "pct" ? 0.005 : 0.01;
  const statut = variation == null ? "inconnu" : Math.abs(variation) < seuil ? "neutre" : variation * sens > 0 ? "bon" : "mauvais";
  return { id: o.id, nom: o.nom, format: o.format, sens, valeur: a, precedente: b, variation, statut, serie: o.serie ?? [], page: o.page, description: o.description, formule: o.formule };
}

/** Découpe une fenêtre en n tranches. */
export function tranches(w: Fenetre, n = 12): Fenetre[] {
  const pas = (w.fin - w.debut) / n;
  return Array.from({ length: n }, (_, i) => ({ debut: w.debut + pas * i, fin: w.debut + pas * (i + 1) }));
}

/** Étiquette d'axe : l'heure si la fenêtre fait moins de 2 jours, sinon la date. */
export function etiquette(t: number, w: Fenetre): string {
  return w.fin - w.debut < 2 * JOUR
    ? new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
    : new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Clients ayant passé ≥ 2 commandes payées ÷ clients identifiés ayant payé (sur la fenêtre). */
export function tauxRachat(cmds: Commande[]): number | null {
  const n = new Map<string, number>();
  for (const c of cmds) if (c.statut === "payee" && c.clientId) n.set(`${c.marchandId}|${c.clientId}`, (n.get(`${c.marchandId}|${c.clientId}`) ?? 0) + 1);
  if (n.size < 5) return null;
  let r = 0;
  for (const x of n.values()) if (x >= 2) r++;
  return r / n.size;
}

export interface StatsPaiement { n: number; reussis: number; echoues: number; attente: number; rembourses: number; annules: number; volume: number; succes: number | null }

/** Statistiques de paiement d'un lot de commandes. Réussi = payé ou remboursé (l'argent a bien été encaissé). */
export function statsPaiement(cmds: Commande[]): StatsPaiement {
  const s: StatsPaiement = { n: cmds.length, reussis: 0, echoues: 0, attente: 0, rembourses: 0, annules: 0, volume: 0, succes: null };
  for (const c of cmds) {
    if (c.statut === "payee" || c.statut === "remboursee") { s.reussis++; s.volume += c.montant; }
    if (c.statut === "remboursee") s.rembourses++;
    else if (c.statut === "echouee") s.echoues++;
    else if (c.statut === "en_attente") s.attente++;
    else if (c.statut === "annulee") s.annules++;
  }
  s.succes = s.reussis + s.echoues > 0 ? s.reussis / (s.reussis + s.echoues) : null;
  return s;
}

export function grouper<T>(a: T[], cle: (x: T) => string | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of a) { const k = cle(x); if (k == null) continue; let l = m.get(k); if (!l) m.set(k, (l = [])); l.push(x); }
  return m;
}

// ─── Operational Health ─────────────────────────────────────────────────────

export interface ComposanteOps { id: string; nom: string; poids: number; valeur: number | null; format: Format; score: number | null; regle: string }

/** Note linéaire : `bon` → 100, `mauvais` → 0 (fonctionne dans les deux sens). */
export const noteLineaire = (x: number, bon: number, mauvais: number) => Math.round(Math.max(0, Math.min(1, (x - mauvais) / (bon - mauvais))) * 100);

/** Score /100 : moyenne pondérée des composantes mesurables (poids renormalisés si une donnée manque). */
export function scoreOps(composantes: ComposanteOps[]): number | null {
  const ok = composantes.filter((c) => c.score != null);
  const poids = ok.reduce((s, c) => s + c.poids, 0);
  return poids > 0 ? Math.round(ok.reduce((s, c) => s + c.score! * c.poids, 0) / poids) : null;
}
