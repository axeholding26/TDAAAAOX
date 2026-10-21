// Règles du wallet sans base de données (testables) : séquestre des ventes, minimum de retrait
// et prix d'abonnement dans la devise du wallet. Utilisées par lib/wallet.ts.
import { AVEC_CENTIMES } from "./changement-devise";
import { XAF_TO } from "./devise-convert";

export const SEQUESTRE_HEURES = 48;
export const finSequestre = (maintenant = new Date()) => new Date(maintenant.getTime() + SEQUESTRE_HEURES * 3600_000);

/** Montant XAF dans une autre devise, arrondi AU-DESSUS à l'unité de la devise (pas de décimales en FCFA). */
export function depuisXAFArrondiHaut(montantXAF: number, devise: string, taux: Record<string, number> = XAF_TO): number {
  if (devise === "XAF" || devise === "XOF") return Math.ceil(montantXAF);
  const pas = AVEC_CENTIMES.has(devise) ? 100 : 1;
  const rate = taux[devise] ?? XAF_TO[devise] ?? XAF_TO.USD;
  return Math.ceil(montantXAF * rate * pas - 1e-6) / pas;
}

/** Minimum de retrait : l'équivalent de 1 000 FCFA dans la devise du wallet. */
export const MINIMUM_RETRAIT_XAF = 1000;
export const minimumRetrait = (devise: string, taux?: Record<string, number>) => depuisXAFArrondiHaut(MINIMUM_RETRAIT_XAF, devise, taux);

/** Montant de retrait saisi, arrondi à l'unité de la devise. */
export const arrondiDevise = (montant: number, devise: string) => {
  const pas = AVEC_CENTIMES.has(devise) ? 100 : 1;
  return Math.round(montant * pas) / pas;
};

/**
 * Solde disponible = solde − ventes encore en séquestre (disponibleLe dans le futur).
 * `liberations` : montants en attente groupés par date de libération, la plus proche d'abord.
 */
export function etatSequestre(solde: number, credits: { montant: number; disponibleLe: Date | null }[], maintenant = new Date()) {
  const enCours = credits.filter((c) => c.disponibleLe && c.disponibleLe > maintenant).sort((a, b) => a.disponibleLe!.getTime() - b.disponibleLe!.getTime());
  const enAttente = Math.round(enCours.reduce((s, c) => s + c.montant, 0) * 100) / 100;
  return {
    disponible: Math.round((solde - enAttente) * 100) / 100,
    enAttente,
    liberations: enCours.map((c) => ({ montant: c.montant, le: c.disponibleLe! })),
  };
}
