import { AVEC_CENTIMES } from "./changement-devise";

// POLITIQUE DE PRIX (depuis le 20/10/2026) — le client paie la majoration en plus, le vendeur
// garde toujours son prix :
// - physique ou dropshipping payé EN LIGNE : +10 % (7 % Axso + 3 % NotchPay) ;
// - produit numérique : +13 % (10 % Axso + 3 % NotchPay) ;
// - physique payé À LA LIVRAISON, en espèces au marchand : rien n'est ajouté ni prélevé.
// `taux` = Tenant.commissionRate (0,10 par défaut) ; le numérique y ajoute SUPPLEMENT_NUMERIQUE.
// Texte public : page /legal/politique-prix.
export const SUPPLEMENT_NUMERIQUE = 0.03;
export const TYPES_NUMERIQUES = new Set(["digital", "fichier", "formation", "licence", "bundle", "evenement", "bootcamp"]);

/** Majoration d'un produit payé en ligne, selon son type. */
export const tauxProduit = (taux: number, typeProduit: string) => (TYPES_NUMERIQUES.has(typeProduit) ? taux + SUPPLEMENT_NUMERIQUE : taux);

/** Prix payé par le client. "physique" = prix affiché, payé à la livraison ; "en_ligne" = physique payé en ligne. */
export function prixClient(prixVendeur: number, tauxCommission: number, typeProduit: string): number {
  if (typeProduit === "physique") return prixVendeur;
  return Math.round(prixVendeur * (1 + tauxProduit(tauxCommission, typeProduit)));
}

/**
 * Majoration moyenne d'une commande payée en ligne (prix des lignes = prix client) : celle qui,
 * appliquée au total par partVendeur, rend au vendeur exactement la somme de ses prix, même si la
 * commande mêle numérique (+13 %) et physique (+10 %). Ligne sans type connu : taux de base.
 */
export function tauxCommande(lignes: { prix: number; quantite: number; type?: string | null }[], taux: number): number {
  const client = lignes.reduce((s, l) => s + l.prix * l.quantite, 0);
  const vendeur = lignes.reduce((s, l) => s + (l.prix * l.quantite) / (1 + tauxProduit(taux, l.type ?? "")), 0);
  return client > 0 && vendeur > 0 ? client / vendeur - 1 : taux;
}

type Promo = { type: string; valeur: number; minCommande?: number | null; maxUtilisations?: number | null; utilisations?: number; dateExpiration?: Date | null; produitIds?: string[] };

// Remise d'un code promo sur un sous-total — 0 si le code n'est plus valable.
// Même calcul pour l'estimation du panier et pour la commande (serveur = vérité).
// Code réservé à certains produits (`produitIds`) : il ne réduit que leurs lignes, et rien sans `lignes`.
export function reductionPromo(promo: Promo | null | undefined, sousTotal: number, lignes?: { produitId: string; prix: number; quantite: number }[]): number {
  if (!promo) return 0;
  if (promo.produitIds?.length) {
    sousTotal = (lignes ?? []).filter((l) => promo.produitIds!.includes(l.produitId)).reduce((s, l) => s + l.prix * l.quantite, 0);
    if (!sousTotal) return 0;
  }
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
// `lignes` (prix client unitaires) : le prix client étant arrondi par unité, diviser le total décalait
// le vendeur de ±1 ; ligne par ligne, arrondi(prix client ÷ (1 + taux)) redonne exactement son prix
// (l'erreur d'arrondi reste sous ½). Une remise réduit cette part au prorata.
export function partVendeur(brut: number, horsCommission: number, tauxCommission: number, devise: string, lignes?: { prix: number; quantite: number }[]) {
  const hors = Math.min(Math.max(0, horsCommission), brut);
  const pas = AVEC_CENTIMES.has(devise) ? 100 : 1;
  const client = lignes?.reduce((s, l) => s + l.prix * l.quantite, 0) ?? 0;
  const vendeur = lignes?.reduce((s, l) => s + (Math.round(l.prix / (1 + tauxCommission) * pas) / pas) * l.quantite, 0) ?? 0;
  const produits = client > 0 ? vendeur * Math.min(1, (brut - hors) / client) : (brut - hors) / (1 + tauxCommission);
  const montantNet = Math.round((produits + hors) * pas) / pas;
  return { montantNet, montantCommission: Math.round((brut - montantNet) * pas) / pas };
}
