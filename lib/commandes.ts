// Source unique de vérité pour les transitions de statut d'une commande.
// Utilisé par app/api/commandes/[id]/statut/route.ts et app/api/retours/route.ts
// pour éviter que Commande.statut et Commande.livraisonStatut divergent.

export const TRANSITIONS_VALIDES: Record<string, string[]> = {
  en_attente:        ["confirmee", "annulee"],
  confirmee:         ["en_preparation", "expediee", "annulee"],
  en_preparation:    ["expediee", "annulee"],
  expediee:          ["livree", "tentative_echouee", "annulee"],
  // Replanification : le livreur retente, ou le marchand annule après échecs répétés
  tentative_echouee: ["expediee", "livree", "annulee"],
  livree:             [],
  annulee:            [],
};

// Commande.statut -> Commande.livraisonStatut, écrit dans la même transaction
// que Commande.statut pour que les deux champs ne divergent jamais.
export const LIVRAISON_STATUT_MAP: Record<string, string> = {
  en_attente:        "non_expediee",
  confirmee:         "non_expediee",
  en_preparation:    "en_preparation",
  expediee:          "expediee",
  tentative_echouee: "tentative_echouee",
  livree:            "livree",
};

export function livraisonStatutPour(statut: string): string | undefined {
  return LIVRAISON_STATUT_MAP[statut];
}
