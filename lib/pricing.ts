// Prix affiché au client = prix vendeur majoré de la commission Axso.
// Le vendeur ne perd jamais d'argent : c'est le client qui paie la commission en plus,
// pas le vendeur qui la voit déduite de sa vente.
export function prixClient(prixVendeur: number, tauxCommission: number): number {
  return Math.round(prixVendeur * (1 + tauxCommission));
}

type Promo = { type: string; valeur: number; minCommande?: number | null; maxUtilisations?: number | null; utilisations?: number; dateExpiration?: Date | null };

// Remise d'un code promo sur un sous-total — 0 si le code n'est plus valable.
// Même calcul pour l'estimation du panier et pour la commande (serveur = vérité).
export function reductionPromo(promo: Promo | null | undefined, sousTotal: number): number {
  if (!promo) return 0;
  if (promo.maxUtilisations && (promo.utilisations ?? 0) >= promo.maxUtilisations) return 0;
  if (promo.dateExpiration && new Date() > promo.dateExpiration) return 0;
  if (promo.minCommande && sousTotal < promo.minCommande) return 0;
  return Math.min(sousTotal, Math.round(promo.type === "pourcentage" ? sousTotal * promo.valeur / 100 : promo.valeur));
}
