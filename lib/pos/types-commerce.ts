// Modèles par type de commerce (§72) — CLIENT-SAFE.
//
// Un type de commerce est un PRÉRÉGLAGE : il propose un mode, des drapeaux et
// quelques réglages, et met en avant les écrans utiles à ce métier. Il n'ajoute
// aucune fonction : RESTAURANT, PHARMACY et SERVICES ne donnent ni plan de
// salle, ni envoi en cuisine, ni gestion d'ordonnances (`limites` le dit, et
// l'écran des réglages l'affiche).
// Les champs de la fiche produit selon le commerce sont dans
// lib/pos/operations/fiche.ts (CHAMPS_PAR_COMMERCE).
import type { FlagPos, ModePos, ReglagesPosValeurs, TypeCommerce } from "./types";

export type ModeleCommerce = {
  libelle: string;
  description: string;
  mode: ModePos;
  /** Drapeaux conseillés (allumés par « Appliquer le préréglage » et par l'activation finale). */
  flags: FlagPos[];
  /** Réglages conseillés, section par section. */
  reglages: { [S in keyof ReglagesPosValeurs]?: Partial<ReglagesPosValeurs[S]> };
  /** Écrans mis en avant. */
  fonctions: { href: string; libelle: string }[];
  /** Ce que ce préréglage ne fait PAS. */
  limites?: string;
};

const F = {
  caisse: { href: "/dashboard/pos/caisse", libelle: "Caisse" },
  stock: { href: "/dashboard/pos/stock", libelle: "Stock" },
  inventaire: { href: "/dashboard/pos/inventaire", libelle: "Inventaires" },
  lots: { href: "/dashboard/pos/tracabilite", libelle: "Lots et dates d'expiration" },
  achats: { href: "/dashboard/pos/achats", libelle: "Achats et réassort" },
  promotions: { href: "/dashboard/pos/promotions", libelle: "Promotions" },
  fidelite: { href: "/dashboard/pos/fidelite", libelle: "Fidélité" },
  credit: { href: "/dashboard/pos/credit", libelle: "Crédit clients" },
  retours: { href: "/dashboard/pos/retours", libelle: "Retours et échanges" },
  transferts: { href: "/dashboard/pos/transferts", libelle: "Transferts entre magasins" },
  supervision: { href: "/dashboard/pos/supervision", libelle: "Supervision des caisses" },
  analytics: { href: "/dashboard/pos/analytics", libelle: "Analytics" },
} as const;

const BASE: FlagPos[] = ["caisse_v2", "scanner_v2"];

export const MODELES_COMMERCE: Record<TypeCommerce, ModeleCommerce> = {
  RETAIL: {
    libelle: "Boutique", description: "Commerce de détail généraliste : scan, panier, paiement.",
    mode: "simple", flags: BASE, reglages: {}, fonctions: [F.caisse, F.stock, F.retours],
  },
  SUPERMARKET: {
    libelle: "Supermarché", description: "Beaucoup de références, plusieurs caisses, promotions, produits au poids et dates d'expiration.",
    mode: "pro", flags: [...BASE, "multi_scanner", "smart_promotions", "advanced_inventory"],
    reglages: { caisse: { sessionObligatoire: true } },
    fonctions: [F.caisse, F.supervision, F.promotions, F.lots, F.inventaire, F.achats],
  },
  WHOLESALE: {
    libelle: "Grossiste", description: "Vente en quantité, prix par palier, clients en compte.",
    mode: "pro", flags: [...BASE, "smart_promotions", "advanced_inventory"],
    reglages: { credit: { actif: true }, caisse: { sessionObligatoire: true } },
    fonctions: [F.caisse, F.credit, F.promotions, F.achats, F.transferts],
  },
  FASHION: {
    libelle: "Mode", description: "Tailles et couleurs, échanges fréquents, fidélité.",
    mode: "pro", flags: [...BASE, "smart_promotions"],
    reglages: { fidelite: { active: true }, retours: { delaiJours: 14 } },
    fonctions: [F.caisse, F.retours, F.fidelite, F.promotions, F.stock],
  },
  ELECTRONICS: {
    libelle: "Électronique", description: "Numéros de série et IMEI, garanties, retours suivis.",
    mode: "pro", flags: [...BASE, "advanced_inventory"],
    reglages: { retours: { delaiJours: 7, sansRecu: false } },
    fonctions: [F.caisse, F.stock, F.retours, F.achats],
  },
  PHARMACY: {
    libelle: "Pharmacie", description: "Lots, dates d'expiration, vente du lot qui expire le premier.",
    mode: "pro", flags: [...BASE, "advanced_inventory"],
    reglages: { stock: { venteSansStock: false }, caisse: { sessionObligatoire: true } },
    fonctions: [F.caisse, F.lots, F.inventaire, F.achats],
    limites: "Préréglage seulement : pas de gestion d'ordonnances, de tiers payant ni de registre des stupéfiants.",
  },
  RESTAURANT: {
    libelle: "Restaurant", description: "Encaissement rapide au comptoir, paiements mixtes.",
    mode: "simple", flags: BASE, reglages: { stock: { venteSansStock: true } },
    fonctions: [F.caisse, F.analytics],
    limites: "Préréglage seulement : pas de plan de salle, de prise de commande à table ni d'envoi en cuisine.",
  },
  GROCERY: {
    libelle: "Épicerie", description: "Petite alimentation : produits au poids, dates d'expiration, crédit de quartier.",
    mode: "simple", flags: [...BASE, "advanced_inventory"],
    reglages: { credit: { actif: true } },
    fonctions: [F.caisse, F.lots, F.credit, F.stock],
  },
  HARDWARE: {
    libelle: "Quincaillerie", description: "Beaucoup de références, ventes à des professionnels, clients en compte.",
    mode: "pro", flags: [...BASE, "advanced_inventory"],
    reglages: { credit: { actif: true } },
    fonctions: [F.caisse, F.stock, F.credit, F.achats, F.inventaire],
  },
  SERVICES: {
    libelle: "Services", description: "Prestations vendues à la caisse, sans stock à suivre.",
    mode: "simple", flags: ["caisse_v2"], reglages: { stock: { venteSansStock: true } },
    fonctions: [F.caisse, F.fidelite, F.analytics],
    limites: "Préréglage seulement : pas d'agenda, de prise de rendez-vous ni de suivi de prestations.",
  },
};

/** Explication de chaque drapeau de fonctionnalité, pour l'écran des réglages. */
export const EXPLICATION_FLAGS: Record<FlagPos, { libelle: string; explication: string }> = {
  caisse_v2: { libelle: "Nouvel écran de caisse", explication: "Remplace l'ancienne caisse par le nouvel écran, y compris pour les caissiers qui n'ont accès qu'à la caisse. Éteint : le menu « Caisse » ouvre l'ancienne caisse." },
  scanner_v2: { libelle: "Téléphone-scanner", explication: "Permet d'appairer un téléphone à une caisse par QR code : ce qu'il scanne arrive aussitôt sur le poste." },
  multi_scanner: { libelle: "Plusieurs scanners par caisse", explication: "Autorise plusieurs téléphones actifs sur la même caisse. Éteint : un seul à la fois." },
  offline_pos: { libelle: "Vente hors ligne", explication: "Garde les ventes sur le poste pendant une coupure et les envoie au retour du réseau." },
  axia_pos: { libelle: "AXIA dans la caisse", explication: "Donne à AXIA les chiffres du magasin et lui laisse préparer des actions, que vous validez toujours vous-même." },
  smart_promotions: { libelle: "Moteur de promotions", explication: "Applique automatiquement les promotions (2+1, lots, seuils de panier, prix membre…) au panier." },
  advanced_inventory: { libelle: "Stock avancé", explication: "Permet de démarrer des inventaires et de créer des transferts entre magasins. Éteint : ceux en cours se terminent, on ne peut plus en créer. Lots, numéros de série et corrections de stock restent toujours disponibles." },
};
