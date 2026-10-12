// Types et constantes partagés de la caisse AXSO POS 2.0 — CLIENT-SAFE
// (aucun import de Prisma ni de code serveur : ce fichier est lu par l'écran de
// caisse comme par les routes). Les fonctions qui touchent la base vivent dans
// les fichiers voisins (acces.ts, vente.ts, stock.ts…).
//
// CONVENTIONS DE CALCUL (valables partout dans lib/pos) :
// - Montants : nombres dans la devise de la boutique, arrondis à l'unité pour
//   les devises sans centimes (XAF, XOF…), à 2 décimales sinon (tarification.ts).
// - Taux de TVA : FRACTION (0.1925 = 19,25 %), comme Tenant.tauxTVA.
// - Produit au poids (uniteVente = "kg") : les quantités et le stock sont en
//   GRAMMES entiers, le prix catalogue est au KILO.

// ─── Droits ───────────────────────────────────────────────────────────────────

/** Actions soumises à un droit. La grille par rôle est dans droits.ts. */
export const ACTIONS_POS = [
  // vente
  "vendre", "encaisser", "remise", "remise_hors_plafond", "prix_personnalise", "produit_offert",
  "vente_credit", "suspendre_panier", "annuler_vente", "retour", "rembourser",
  // caisse
  "ouvrir_caisse", "fermer_caisse", "mouvement_caisse", "voir_caisse",
  // scan et stock
  "scanner", "voir_stock", "ajuster_stock", "inventaire_compter", "inventaire_valider",
  "transfert_creer", "transfert_approuver", "transfert_recevoir",
  // achats
  "achat_creer", "achat_valider", "reception", "voir_couts", "creer_produit",
  // clients
  "gerer_clients", "gerer_credit", "gerer_promotions", "gerer_fidelite",
  // pilotage et administration
  "rapprochement", "voir_analytics", "voir_audit", "gerer_appareils", "gerer_magasins", "gerer_reglages", "import_export",
] as const;
export type ActionPos = (typeof ACTIONS_POS)[number];
export type DroitsPos = Record<ActionPos, boolean>;

// ─── Réglages et drapeaux ─────────────────────────────────────────────────────

/** Drapeaux de fonctionnalité, par boutique (ReglagesPos.flags). Tous éteints par défaut. */
export const FLAGS_POS = [
  "caisse_v2",          // le nouvel écran de caisse remplace POSPanel (page « Caisse » et kiosque)
  "scanner_v2",         // téléphone appairé + flux temps réel
  "multi_scanner",      // plusieurs scanners par caisse
  "offline_pos",        // vente hors ligne et file de synchronisation
  "axia_pos",           // outils AXIA de la caisse
  "smart_promotions",   // moteur de promotions
  "advanced_inventory", // création d'inventaires et de transferts (lib/pos/flags.ts → exigerStockAvance)
] as const;
export type FlagPos = (typeof FLAGS_POS)[number];

export const TYPES_COMMERCE = ["RETAIL", "SUPERMARKET", "WHOLESALE", "FASHION", "ELECTRONICS", "PHARMACY", "RESTAURANT", "GROCERY", "HARDWARE", "SERVICES"] as const;
export type TypeCommerce = (typeof TYPES_COMMERCE)[number];
export type ModePos = "simple" | "pro";

export const MODES_PAIEMENT_IDS = ["especes", "mobile_money", "carte", "virement", "qr", "portefeuille", "credit", "bon", "avoir"] as const;
export type ModePaiement = (typeof MODES_PAIEMENT_IDS)[number];

/** Contenu de ReglagesPos.reglages, valeurs par défaut comprises (REGLAGES_DEFAUT). */
export type ReglagesPosValeurs = {
  /** prixTTC : les prix du catalogue contiennent déjà la TVA (usage courant). false = TVA ajoutée au total. */
  taxes: { prixTTC: boolean };
  /** plafondPct : remise maximale (en % du montant) sans le droit « remise_hors_plafond ». */
  remises: { plafondPct: number };
  /** sessionObligatoire : null = oui en mode pro, non en mode simple. */
  caisse: { sessionObligatoire: boolean | null; fondsInitialDefaut: number };
  /** modes : moyens d'encaissement proposés à l'écran de caisse. */
  paiements: { modes: ModePaiement[] };
  /** montantParPoint : montant d'achat qui donne 1 point ; valeurPoint : valeur d'un point à l'utilisation. */
  fidelite: { active: boolean; montantParPoint: number; valeurPoint: number; seuils: { silver: number; gold: number; vip: number } };
  /** graceJours : jours de retard tolérés avant que le crédit d'un client soit bloqué automatiquement (0 = dès le premier jour). */
  credit: { actif: boolean; plafondDefaut: number; echeanceJours: number; graceJours: number };
  recu: { entete: string; piedDePage: string; afficherTVA: boolean; format: "80mm" | "58mm" | "A4" };
  retours: { delaiJours: number; sansRecu: boolean };
  /** venteSansStock : laisse vendre un article dont le stock saisi est insuffisant (stock négatif signalé). */
  /** seuilExpirationJours : un lot est signalé « expire bientôt » à ce nombre de jours de sa date d'expiration. */
  stock: { venteSansStock: boolean; seuilExpirationJours: number };
  /** enregistresUniquement : la caisse refuse un numéro de série qui n'a pas été enregistré (réception ou stock) au lieu de le créer à la vente. */
  series: { enregistresUniquement: boolean };
  /** Seuils des alertes principales : produit dormant (jours sans vente), marge faible (%), remboursements inhabituels (% des ventes). */
  alertes: { dormantJours: number; margeFaiblePct: number; remboursementsPct: number };
  /** prefixesPoids : préfixes des codes EAN-13 de balance « 2X + 5 chiffres article + 5 chiffres poids en grammes ». */
  balance: { prefixesPoids: string[] };
};

export const REGLAGES_DEFAUT: ReglagesPosValeurs = {
  taxes: { prixTTC: true },
  remises: { plafondPct: 10 },
  caisse: { sessionObligatoire: null, fondsInitialDefaut: 0 },
  // « avoir » est toujours proposé (voir fusionnerReglages) : un avoir émis doit pouvoir être dépensé.
  paiements: { modes: ["especes", "mobile_money", "carte", "credit", "avoir"] },
  fidelite: { active: false, montantParPoint: 1000, valeurPoint: 0, seuils: { silver: 500, gold: 2000, vip: 5000 } },
  credit: { actif: false, plafondDefaut: 0, echeanceJours: 30, graceJours: 0 },
  recu: { entete: "", piedDePage: "Merci de votre visite", afficherTVA: true, format: "80mm" },
  retours: { delaiJours: 14, sansRecu: false },
  stock: { venteSansStock: false, seuilExpirationJours: 30 },
  series: { enregistresUniquement: false },
  alertes: { dormantJours: 60, margeFaiblePct: 10, remboursementsPct: 10 },
  // « 20 » est réservé aux codes internes générés par lib/barcode.ts.
  balance: { prefixesPoids: ["21", "22", "23", "24", "25", "26", "27", "28", "29"] },
};

export type ReglagesPosComplets = {
  typeCommerce: TypeCommerce;
  mode: ModePos;
  flags: Record<FlagPos, boolean>;
  reglages: ReglagesPosValeurs;
  onboarding: Record<string, boolean>;
};

// ─── Contexte d'une requête ───────────────────────────────────────────────────

/** Qui agit, où : rendu par accesPos() et passé à toute fonction métier. */
export type ContextePos = {
  tenantId: string;
  userId: string;
  userNom: string;
  magasinId: string;
  caisseId: string;
  /** Magasins auxquels le membre est limité (MembreEquipe.magasinIds) ; vide ou absent = tous. Voir exigerMagasin / exigerLieu. */
  magasinIds?: string[];
  /** Session ouverte sur cette caisse, s'il y en a une. */
  sessionCaisseId?: string;
  /** Renseigné quand la requête vient d'un appareil appairé (jeton) et non d'une session marchande. */
  appareilId?: string;
  droits: DroitsPos;
  ip?: string | null;
};

// ─── Catalogue ────────────────────────────────────────────────────────────────

export type UniteVente = "piece" | "kg";

export type VarianteArticle = {
  id: string; nom: string; valeur: string; prix: number; cout: number | null;
  stock: number; stockMagasin: number | null; sku: string | null; codeBarres: string | null; image: string | null;
};

/** Article vendable (produit, ou produit + variante précise) tel que la caisse le manipule. */
export type ArticleResolu = {
  produitId: string;
  /** null = le produit lui-même. Si `variantes` n'est pas vide et `varianteId` est null, la caisse doit faire choisir. */
  varianteId: string | null;
  nom: string;
  /** « Taille: XL » — même format que LigneCommande.variante. */
  variante: string | null;
  /** Prix de vente : à la pièce, ou au KILO si uniteVente = "kg". */
  prix: number;
  cout: number | null;
  /** Fraction propre au produit ; null = taux de la boutique. */
  tauxTVA: number | null;
  uniteVente: UniteVente;
  image: string | null;
  sku: string | null;
  codeBarres: string | null;
  categorie: string | null;
  marque: string | null;
  /** Stock total de l'article, tous lieux confondus (grammes si kg). */
  stock: number;
  /** Stock dans l'entrepôt du magasin demandé ; null si aucun magasin n'a été précisé. */
  stockMagasin: number | null;
  suiviSerie: boolean;
  /** false = désactivé par le marchand : affichable, mais refusé à la vente. */
  actif: boolean;
  variantes: VarianteArticle[];
  /** Le code lu était un numéro de série en stock. */
  numeroSerieId?: string;
  numeroSerie?: string;
  /** Le code lu était une étiquette de balance : poids embarqué, en grammes. */
  poidsGrammes?: number;
};

export type ContexteScan = "vente" | "inventaire" | "reception" | "transfert" | "recherche" | "prix" | "stock" | "creation";
export type SourceScan = "camera" | "clavier" | "mobile";

// ─── Panier ───────────────────────────────────────────────────────────────────

export type Remise = { type: "pourcentage" | "montant"; valeur: number };

/** Ce que la caisse envoie pour une ligne : jamais de prix catalogue, le serveur le relit. */
export type LigneDemande = {
  produitId: string;
  varianteId?: string | null;
  /** Pièces, ou GRAMMES (entier) pour un produit au poids. */
  quantite: number;
  /** Prix saisi à la main (à la pièce ou au kilo) — droit « prix_personnalise ». */
  prixPersonnalise?: number | null;
  remise?: Remise | null;
  /** Produit offert — droit « produit_offert ». */
  offert?: boolean;
  commentaire?: string | null;
  /** Numéro de série vendu (texte lu) ou son identifiant. */
  numeroSerie?: string | null;
  numeroSerieId?: string | null;
};

/** Ligne de panier complète : la demande + ce que le catalogue en dit. */
export type LignePanier = LigneDemande & {
  /** Identifiant local de la ligne (écran de caisse). */
  id?: string;
  nom: string;
  variante?: string | null;
  /** Prix catalogue : à la pièce, ou au KILO si uniteVente = "kg". */
  prixUnitaire: number;
  uniteVente?: UniteVente;
  tauxTVA?: number | null;
  cout?: number | null;
  categorie?: string | null;
  image?: string | null;
};

export type LigneCalculee = LignePanier & {
  /** Prix retenu (personnalisé ou catalogue), à la pièce ou au kilo. */
  prixApplique: number;
  /** prixApplique × quantité, avant toute remise. */
  brut: number;
  /** Remise saisie sur la ligne (ou valeur entière si offert). */
  remiseLigne: number;
  /** Remise apportée par une promotion. */
  remisePromotion: number;
  promotionId: string | null;
  /** Part de la remise globale et du code promo répartie sur cette ligne. */
  remiseRepartie: number;
  /** Total des remises de la ligne. */
  remiseTotale: number;
  /** Fraction de TVA appliquée. */
  taux: number;
  ht: number;
  taxe: number;
  /** Montant final de la ligne, taxes comprises. */
  total: number;
};

/** Refus ou point d'attention levé par le calcul. Bloquant = la vente est refusée par le serveur. */
export type AlertePanier = { code: string; message: string; ligne?: number; bloquant: boolean };

export type PanierCalcule = {
  lignes: LigneCalculee[];
  /** Nombre d'articles (un produit au poids compte pour 1). */
  articles: number;
  /** Somme des montants bruts, avant remises. */
  sousTotal: number;
  remiseLignes: number;
  remisePromotions: number;
  remiseGlobale: number;
  remiseCodePromo: number;
  totalRemises: number;
  totalHT: number;
  montantTaxes: number;
  taxesParTaux: { taux: number; base: number; montant: number }[];
  /** Toujours 0 en caisse (pas de livraison) — présent pour l'affichage. */
  frais: number;
  total: number;
  promotionsAppliquees: { promotionId: string; nom: string; montant: number }[];
  alertes: AlertePanier[];
};

// ─── Vente et paiement ────────────────────────────────────────────────────────

export type DemandePaiementPos = {
  mode: ModePaiement;
  /** Montant affecté à la vente par ce moyen. Pour des espèces : ce que le client remet (la monnaie est calculée). */
  montant: number;
  /** Information saisie : opérateur (mtn, orange, wave), banque, TPE… */
  prestataire?: string | null;
  /** N° de transaction saisi par le caissier, ou code de l'avoir. */
  reference?: string | null;
};

export type DemandeVente = {
  /** Clé d'idempotence générée par l'appareil (crypto.randomUUID) : la même clé ne crée jamais deux ventes. */
  cle: string;
  lignes: LigneDemande[];
  clientId?: string | null;
  paiements: DemandePaiementPos[];
  /** Remise sur l'ensemble du panier. */
  remise?: Remise | null;
  codePromo?: string | null;
  note?: string | null;
  /** Horodatage de l'appareil (ISO) quand la vente a été saisie hors ligne. */
  creeLocalAt?: string | null;
};

export type ResultatVente = {
  commandeId: string;
  numero: string;
  total: number;
  /** Réellement encaissé (hors crédit). */
  paye: number;
  /** Reste dû par le client (part à crédit). */
  du: number;
  /** Monnaie à rendre. */
  monnaie: number;
  /** true = cette clé avait déjà été traitée : la vente d'origine est renvoyée, rien n'a été créé. */
  rejoue: boolean;
};

// ─── Temps réel ───────────────────────────────────────────────────────────────

export const TYPES_EVENEMENT_POS = [
  "scan.created", "cart.updated",
  "sale.created", "sale.cancelled", "payment.updated", "return.created",
  "inventory.updated",
  "device.connected", "device.disconnected",
  "cash.opened", "cash.closed", "cash.movement",
  "alert.created", "sync.completed",
] as const;
export type TypeEvenementPos = (typeof TYPES_EVENEMENT_POS)[number];

/** Événement tel que lu sur le flux. `seq` est un BigInt sérialisé en chaîne. */
export type EvenementPosLu = {
  seq: string;
  type: TypeEvenementPos;
  magasinId: string | null;
  caisseId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

/**
 * Forme unique d'un numéro de série ou IMEI, à l'enregistrement comme à la
 * vente : sans espaces, en majuscules (« abc 123 » et « ABC123 » sont la même unité).
 */
export const normaliserSerie = (numero?: string | null) => (numero ?? "").replace(/\s+/g, "").toUpperCase();

/** Clé d'article sans le piège des NULL : produitId + ":" + (varianteId ou ""). */
export const cleArticle = (produitId: string, varianteId?: string | null) => `${produitId}:${varianteId ?? ""}`;
