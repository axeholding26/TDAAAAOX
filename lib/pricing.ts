// Prix affiché au client = prix vendeur majoré de la commission Axso.
// Le vendeur ne perd jamais d'argent : c'est le client qui paie la commission en plus,
// pas le vendeur qui la voit déduite de sa vente.
export function prixClient(prixVendeur: number, tauxCommission: number): number {
  return Math.round(prixVendeur * (1 + tauxCommission));
}
