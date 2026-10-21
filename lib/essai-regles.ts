// Règles de l'essai de 7 jours du plan Illimité, sans base de données (testables,
// utilisables côté navigateur). Un seul essai par COMPTE : toutes les boutiques
// de ses propriétaires comptent (lib/abonnement.ts::boutiquesDuMemeCompte).
import type { Palier } from "./plans";

export const DUREE_ESSAI_JOURS = 7;
const JOUR = 24 * 3600 * 1000;

type BoutiqueEssai = { essaiStatut?: string | null; essaiFinLe?: Date | null };

export interface EtatEssai {
  phase: "disponible" | "en_cours" | "termine";
  finLe: Date | null;
  proposer: boolean; // fenêtre « 7 jours offerts » à montrer
  montrerFin: boolean; // fenêtre « essai terminé, choisis un plan » à montrer
}

/** Fin de l'essai du compte (la plus tardive), null s'il n'a jamais été démarré. */
export function finEssai(boutiques: BoutiqueEssai[]): Date | null {
  const fins = boutiques.map((b) => b.essaiFinLe?.getTime()).filter((t): t is number => t != null);
  return fins.length ? new Date(Math.max(...fins)) : null;
}

export function calculerEssai(boutiques: BoutiqueEssai[], planPaye: Palier, maintenant = new Date()): EtatEssai {
  const finLe = finEssai(boutiques);
  const phase = !finLe ? "disponible" : finLe > maintenant ? "en_cours" : "termine";
  const statut = (s: string) => boutiques.some((b) => b.essaiStatut === s);
  return {
    phase,
    finLe,
    // Proposé tant qu'il n'a ni répondu « non » (il peut encore le démarrer depuis Abonnement) ni payé.
    proposer: phase === "disponible" && planPaye === "palier0" && !statut("refuse"),
    montrerFin: phase === "termine" && planPaye === "palier0" && !statut("fin_vue"),
  };
}

export const finEssaiDepuis = (maintenant = new Date()) => new Date(maintenant.getTime() + DUREE_ESSAI_JOURS * JOUR);

/** Temps restant lisible : « 6 j 23 h », « 5 h 12 min », « 3 min ». */
export function tempsRestant(finLe: Date, maintenant = new Date()): string {
  const min = Math.max(0, Math.floor((finLe.getTime() - maintenant.getTime()) / 60000));
  const j = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  return j ? `${j} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

/** Rappel à envoyer maintenant (j2 : moins de 48 h restantes ; fin : essai terminé), null sinon. */
export function rappelDu(finLe: Date, dejaEnvoye: string | null | undefined, maintenant = new Date()): "j2" | "fin" | null {
  const reste = finLe.getTime() - maintenant.getTime();
  if (reste <= 0) return dejaEnvoye === "fin" ? null : "fin";
  if (reste <= 2 * JOUR && !dejaEnvoye) return "j2";
  return null;
}
