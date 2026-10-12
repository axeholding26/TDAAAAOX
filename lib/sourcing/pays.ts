// Configuration par pays d'AXSO Sourcing — module pur (aucune dépendance
// serveur), importable côté client comme côté serveur.
//
// Afrique centrale d'abord (CM, GA, CG, CD), puis le reste : ajouter un pays =
// ajouter une entrée ici, rien d'autre à modifier.
//
// IMPORTANT — rien ici n'est un tarif officiel :
// - `estimations` (droits et taxes, frais de transitaire…) sont des valeurs de
//   départ GÉNÉRIQUES, identiques pour tous les pays, que le marchand remplace
//   par les chiffres de son transitaire (Sourcing → Réglages). Toujours
//   affichées avec ETIQUETTE_ESTIMATION.
// - `moyensPaiement` liste les moyens de paiement courants du pays, à titre
//   indicatif : ce qui est réellement encaissable dépend des adapters branchés
//   (voir lib/sourcing/paiements.ts — aujourd'hui NotchPay et le paiement à la livraison).

import { PAYS_DEVISES } from "../devise-convert";

export type CodePays = "CM" | "CI" | "SN" | "GA" | "CG" | "CD" | "BJ" | "TG" | "NG" | "GH" | "KE";

/** Devises dans lesquelles un fournisseur peut afficher ses prix. */
export const DEVISES_FOURNISSEUR = ["USD", "EUR", "CNY", "XAF", "XOF", "NGN", "GHS", "KES"] as const;

export const ETIQUETTE_ESTIMATION = "Estimation à confirmer avec votre transitaire";

export type MoyenPaiement =
  | "cod" | "mtn_momo" | "orange_money" | "wave" | "airtel_money" | "moov_money"
  | "mpesa" | "free_money" | "tmoney" | "telecel_cash" | "carte" | "virement";

export const LIBELLES_PAIEMENT: Record<MoyenPaiement, string> = {
  cod: "Paiement à la livraison",
  mtn_momo: "MTN Mobile Money",
  orange_money: "Orange Money",
  wave: "Wave",
  airtel_money: "Airtel Money",
  moov_money: "Moov Money",
  mpesa: "M-Pesa",
  free_money: "Free Money",
  tmoney: "T-Money",
  telecel_cash: "Telecel Cash",
  carte: "Carte bancaire",
  virement: "Virement bancaire",
};

export interface EstimationsPays {
  /** Droits + taxes à l'import, en part de la valeur CAF (produit + transport + assurance). */
  tauxDroits: number;
  /** Part des commandes payées à la livraison refusées, tant que la boutique n'a pas d'historique. */
  tauxRefus: number;
  /** Part des commandes livrées puis retournées. */
  tauxRetour: number;
  /** Frais des paiements en ligne, en part du prix de vente. */
  tauxFraisPaiement: number;
}

export interface ConfigPays {
  code: CodePays;
  nom: string;
  /** Devise de vente — celle que lib/devise-convert.ts attribue déjà aux boutiques du pays. */
  devise: string;
  langue: "fr" | "en";
  moyensPaiement: MoyenPaiement[];
  /** Ville d'arrivée habituelle des marchandises importées (modifiable dans les réglages). */
  pointEntree: string;
  /** Grandes zones de livraison proposées par défaut. */
  zones: string[];
  estimations: EstimationsPays;
}

// Mêmes valeurs de départ partout : ce sont des hypothèses de calcul, pas des barèmes.
// Frais de paiement à 0 : sur Axso le paiement à la livraison est sans commission et, en
// ligne, la commission s'ajoute au prix payé par le client (lib/pricing.ts) — le marchand
// ne la supporte pas. À renseigner seulement s'il encaisse par un autre canal.
const ESTIMATIONS_DEFAUT: EstimationsPays = { tauxDroits: 0.3, tauxRefus: 0.2, tauxRetour: 0.03, tauxFraisPaiement: 0 };

const pays = (code: CodePays, nom: string, langue: "fr" | "en", pointEntree: string, zones: string[], moyens: MoyenPaiement[]): ConfigPays =>
  ({ code, nom, devise: PAYS_DEVISES[code], langue, pointEntree, zones, moyensPaiement: ["cod", ...moyens], estimations: ESTIMATIONS_DEFAUT });

export const CONFIG_PAYS: Record<CodePays, ConfigPays> = {
  CM: pays("CM", "Cameroun", "fr", "Douala", ["Douala", "Yaoundé", "Bafoussam", "Garoua", "Autres villes"], ["mtn_momo", "orange_money"]),
  GA: pays("GA", "Gabon", "fr", "Libreville", ["Libreville", "Port-Gentil", "Franceville", "Autres villes"], ["airtel_money", "moov_money"]),
  CG: pays("CG", "Congo", "fr", "Pointe-Noire", ["Brazzaville", "Pointe-Noire", "Autres villes"], ["mtn_momo", "airtel_money"]),
  CD: pays("CD", "RD Congo", "fr", "Kinshasa", ["Kinshasa", "Lubumbashi", "Goma", "Autres villes"], ["mpesa", "orange_money", "airtel_money"]),
  CI: pays("CI", "Côte d'Ivoire", "fr", "Abidjan", ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Autres villes"], ["orange_money", "mtn_momo", "moov_money", "wave"]),
  SN: pays("SN", "Sénégal", "fr", "Dakar", ["Dakar", "Thiès", "Saint-Louis", "Touba", "Autres villes"], ["orange_money", "wave", "free_money"]),
  BJ: pays("BJ", "Bénin", "fr", "Cotonou", ["Cotonou", "Porto-Novo", "Parakou", "Autres villes"], ["mtn_momo", "moov_money"]),
  TG: pays("TG", "Togo", "fr", "Lomé", ["Lomé", "Sokodé", "Kara", "Autres villes"], ["tmoney", "moov_money"]),
  NG: pays("NG", "Nigeria", "en", "Lagos", ["Lagos", "Abuja", "Port Harcourt", "Kano", "Other cities"], ["carte", "virement", "mtn_momo"]),
  GH: pays("GH", "Ghana", "en", "Accra", ["Accra", "Kumasi", "Takoradi", "Tamale", "Other cities"], ["mtn_momo", "telecel_cash", "carte"]),
  KE: pays("KE", "Kenya", "en", "Nairobi", ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Other cities"], ["mpesa", "airtel_money", "carte"]),
};

export const CODES_PAYS = Object.keys(CONFIG_PAYS) as CodePays[];

export const estCodePays = (code: unknown): code is CodePays => typeof code === "string" && code in CONFIG_PAYS;

/** Configuration d'un pays ; Cameroun (marché de lancement) pour un code hors liste. */
export function configPays(code: string | null | undefined): ConfigPays {
  const c = code?.toUpperCase();
  return estCodePays(c) ? CONFIG_PAYS[c] : CONFIG_PAYS.CM;
}
