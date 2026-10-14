// Module « commerce » — calculs purs (aucun accès base) : segments de clients, marge,
// tendance, indicateurs d'une campagne, verrou optimiste. Testé dans tests/controle-ia-commerce.test.ts.
// Règle commune : une valeur qu'on ne peut pas mesurer vaut null, jamais 0 ni une estimation.
import { createHash } from "crypto";

const JOUR = 86_400_000;
const pct = (n: number) => Math.round(n * 1000) / 10;

// ─── Segments de clients ─────────────────────────────────────────────────────
// Calculés sur les commandes PAYÉES (même définition que le chiffre d'affaires), pas sur
// Client.totalCommandes : ce compteur n'est tenu que par la caisse.
export const SEGMENTS = ["vip", "loyal", "new", "occasional", "at_risk", "lost", "prospect"] as const;
export type Segment = (typeof SEGMENTS)[number];
export const LIBELLES_SEGMENT: Record<Segment, string> = {
  vip: "VIP (10 % qui dépensent le plus)", loyal: "fidèles (3 achats et plus)", new: "nouveaux (1er achat il y a moins de 30 jours)",
  occasional: "occasionnels", at_risk: "à risque (aucun achat depuis 60 jours)", lost: "perdus (aucun achat depuis 180 jours)", prospect: "jamais acheté",
};

export interface Achats { commandes: number; depense: number; premiere: Date | null; derniere: Date | null }

/** Dépense à partir de laquelle un client est VIP : le 90e centile des acheteurs. 0 = trop peu d'acheteurs (moins de 10) pour en désigner. */
export function seuilVip(depenses: number[]): number {
  const acheteurs = depenses.filter((d) => d > 0).sort((a, b) => a - b);
  return acheteurs.length < 10 ? 0 : acheteurs[Math.floor(acheteurs.length * 0.9)];
}

/** L'inactivité passe avant la valeur : un VIP silencieux depuis 60 jours est d'abord « à risque », c'est lui qu'il faut relancer. */
export function segmenter(c: Achats, vip: number, maintenant: Date = new Date()): Segment {
  if (c.commandes <= 0 || !c.derniere) return "prospect";
  const silence = (maintenant.getTime() - c.derniere.getTime()) / JOUR;
  if (silence > 180) return "lost";
  if (silence > 60) return "at_risk";
  if (vip > 0 && c.depense >= vip) return "vip";
  if (c.premiere && (maintenant.getTime() - c.premiere.getTime()) / JOUR < 30) return "new";
  return c.commandes >= 3 ? "loyal" : "occasional";
}

// ─── Marge ───────────────────────────────────────────────────────────────────
export interface VentesMarge { ca: number; caCouvert: number; cout: number }

/**
 * Marge brute sur le coût d'achat. Elle n'est calculée que sur la part du chiffre d'affaires
 * dont le coût est connu (`couverture`, en %) : un produit sans coût saisi ne compte pas pour
 * une marge de 100 %.
 */
export function marge(v: VentesMarge): { marge: number | null; taux: number | null; couverture: number } {
  const couverture = v.ca > 0 ? Math.min(100, pct(v.caCouvert / v.ca)) : 0;
  if (!(v.caCouvert > 0)) return { marge: null, taux: null, couverture };
  const m = v.caCouvert - v.cout;
  return { marge: Math.round(m), taux: pct(m / v.caCouvert), couverture };
}

// ─── Tendance ────────────────────────────────────────────────────────────────
/** Évolution en % par rapport à la période précédente ; null si elle était vide (pas de « +100 % » inventé). */
export const variation = (actuel: number, precedent: number): number | null => (precedent > 0 ? pct((actuel - precedent) / precedent) : null);

// ─── Campagnes publicitaires ─────────────────────────────────────────────────
export interface MesuresCampagne { depense: number; impressions: number; clics: number; conversions: number; roas: number }

/**
 * Indicateurs d'une campagne à partir de ce que la régie a remonté. Sans dépense remontée,
 * rien n'est mesurable. Le ROAS n'est donné que s'il a été remonté (> 0) : Axso ne relie pas
 * les ventes aux campagnes, il ne peut pas le recalculer.
 */
export function indicateursCampagne(c: MesuresCampagne) {
  const mesure = c.depense > 0;
  return {
    ctr: c.impressions > 0 ? pct(c.clics / c.impressions) : null,
    cpc: mesure && c.clics > 0 ? Math.round((c.depense / c.clics) * 100) / 100 : null,
    cpa: mesure && c.conversions > 0 ? Math.round((c.depense / c.conversions) * 100) / 100 : null,
    roas: mesure && c.roas > 0 ? Math.round(c.roas * 100) / 100 : null,
  };
}

// ─── Verrou optimiste ────────────────────────────────────────────────────────
/** Vrai si la `version` lue par l'IA (date ISO) est encore celle de l'élément ; une version illisible est périmée. */
export const versionAJour = (version: unknown, updatedAt: Date): boolean => new Date(String(version)).getTime() === updatedAt.getTime();

/** Client n'a pas de colonne updatedAt : sa version est l'empreinte de ses champs modifiables. */
export function versionClient(c: { nom: string; email: string | null; telephone: string | null; adresse: string | null; ville: string | null; pays: string | null; segment: string | null }): string {
  return createHash("sha256").update(JSON.stringify([c.nom, c.email, c.telephone, c.adresse, c.ville, c.pays, c.segment])).digest("hex").slice(0, 16);
}
