import { AVEC_CENTIMES } from "./changement-devise";

// Prix affiché au client = prix vendeur majoré de la commission Axso, prélevée
// sur les paiements en ligne. Le vendeur ne perd jamais d'argent : c'est le client
// qui paie la commission en plus. Un produit physique se paie à la livraison, en
// espèces au marchand : Axso n'y touche pas, donc aucune commission (modèle Shopify).
export function prixClient(prixVendeur: number, tauxCommission: number, typeProduit: string): number {
  if (typeProduit === "physique") return prixVendeur;
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

// Filtre de l'incrément conditionnel d'un code promo : l'update ne touche rien
// si le plafond est déjà atteint (deux commandes simultanées ne le dépassent pas).
export function filtreUsagePromo(promo: { id: string; maxUtilisations?: number | null }) {
  return promo.maxUtilisations ? { id: promo.id, utilisations: { lt: promo.maxUtilisations } } : { id: promo.id };
}

// Paiement en ligne reçu → part du vendeur et commission Axso. Seuls les produits ont été
// majorés de la commission ; la livraison (`horsCommission`) revient en entier au vendeur.
// FCFA et autres monnaies sans centimes : arrondi à l'unité.
export function partVendeur(brut: number, horsCommission: number, tauxCommission: number, devise: string) {
  const hors = Math.min(Math.max(0, horsCommission), brut);
  const pas = AVEC_CENTIMES.has(devise) ? 100 : 1;
  const montantNet = Math.round(((brut - hors) / (1 + tauxCommission) + hors) * pas) / pas;
  return { montantNet, montantCommission: Math.round((brut - montantNet) * pas) / pas };
}
