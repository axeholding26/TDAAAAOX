// Types TypeScript centralisés pour Axso
import type {
  Tenant,
  Produit,
  Variante,
  Collection,
  Client,
  Commande,
  LigneCommande,
  Commission,
  Escrow,
  CodePromo,
  Avis,
  Wishlist,
  Analytics,
} from "@prisma/client";

// Re-exporter les types Prisma
export type {
  Tenant,
  Produit,
  Variante,
  Collection,
  Client,
  Commande,
  LigneCommande,
  Commission,
  Escrow,
  CodePromo,
  Avis,
  Wishlist,
  Analytics,
};

// Types enrichis avec relations
export type ProduitAvecVariantes = Produit & {
  variantes: Variante[];
  avis: Avis[];
  _count?: { avis: number; ventes: number };
};

export type CommandeAvecLignes = Commande & {
  lignes: LigneCommande[];
  client?: Client | null;
  commission?: Commission | null;
  escrow?: Escrow | null;
};

export type ClientAvecCommandes = Client & {
  commandes: Commande[];
  _count?: { commandes: number };
  segment?: "nouveau" | "regulier" | "vip";
};

// Item du panier (state local)
export interface ItemPanier {
  produitId: string;
  nom: string;
  prix: number;
  quantite: number;
  imageUrl?: string;
  variante?: string;
  stock: number;
  type?: "physique" | "digital" | "dropshipping";
  fichierUrl?: string;
  fichierNom?: string;
}

// Statuts commande
export type StatutCommande =
  | "en_attente"
  | "confirmee"
  | "en_preparation"
  | "expediee"
  | "livree"
  | "annulee"
  | "remboursee";

// Statuts paiement
export type StatutPaiement = "pending" | "completed" | "failed" | "refunded";

// Statuts livraison
export type StatutLivraison =
  | "non_expediee"
  | "en_cours"
  | "livree"
  | "retournee";

// Statuts escrow
export type StatutEscrow = "held" | "released" | "disputed";

// Métriques dashboard
export interface MetriquesDashboard {
  ventesJour: number;
  ventesMois: number;
  commandesEnAttente: number;
  visiteurs: number;
  tauxConversion: number;
  panierMoyen: number;
  tendanceVentes: number;
}

// Données graphique ventes
export interface DonneeVente {
  date: string;
  montant: number;
  commandes: number;
}

// Notification
export interface Notification {
  id: string;
  type: "commande" | "paiement" | "avis" | "stock" | "info";
  titre: string;
  message: string;
  lu: boolean;
  createdAt: Date;
  lienAction?: string;
}

// Plan tarifaire
export interface PlanTarifaire {
  id: string;
  nom: string;
  prix: number;
  devise: string;
  commission: number;
  fonctionnalites: string[];
  populaire?: boolean;
}
