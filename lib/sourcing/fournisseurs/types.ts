// Supplier Intelligence — types et libellés communs. Module pur (types Prisma
// importés en `type` seulement) : utilisable côté client comme côté serveur.
//
// RÈGLE FONDAMENTALE : AXSO n'invente jamais une certification, une usine, un
// audit, un avis, un statut fabricant, un historique ni un score. Toute donnée
// porte un niveau de confiance et la source de sa vérification ; ce qui n'est
// pas vérifiable s'affiche « Non vérifié ».
import type {
  Fournisseur, ProduitFournisseur, DocumentFournisseur, AuditFournisseur,
  EchantillonFournisseur, EvaluationFournisseur, VerificationFournisseur,
} from "@prisma/client";

export const NIVEAUX_CONFIANCE = ["verifie", "partiellement_verifie", "declare_fournisseur", "inconnu"] as const;
export type NiveauConfiance = (typeof NIVEAUX_CONFIANCE)[number];

export const LIBELLES_CONFIANCE: Record<NiveauConfiance, string> = {
  verifie: "Vérifié",
  partiellement_verifie: "Partiellement vérifié",
  declare_fournisseur: "Déclaré par le fournisseur",
  inconnu: "Non vérifié",
};

/** Part d'une note réellement comptée selon la confiance de la donnée : une
 *  information seulement déclarée ne vaut jamais autant qu'une information vérifiée. */
export const DECOTE_CONFIANCE: Record<NiveauConfiance, number> = {
  verifie: 1, partiellement_verifie: 0.85, declare_fournisseur: 0.6, inconnu: 0,
};

export const niveauConfiance = (v: unknown): NiveauConfiance =>
  (NIVEAUX_CONFIANCE as readonly string[]).includes(v as string) ? (v as NiveauConfiance) : "inconnu";

export const TYPES_ENTREPRISE: Record<string, string> = {
  fabricant: "Fabricant",
  fabricant_trading: "Fabricant + trading",
  trading: "Société de trading",
  grossiste: "Grossiste",
  distributeur: "Distributeur",
  inconnu: "Non renseigné",
};

export const TYPES_DOCUMENT: Record<string, string> = {
  certificat: "Certificat",
  rapport_labo: "Rapport de laboratoire",
  licence: "Licence",
  document_entreprise: "Document d'entreprise",
  rapport_inspection: "Rapport d'inspection",
  document_qualite: "Document qualité",
};

export const TYPES_AUDIT: Record<string, string> = {
  avant_production: "Inspection avant production",
  pendant_production: "Inspection pendant production",
  avant_expedition: "Inspection avant expédition",
  controle_qualite: "Contrôle qualité",
  audit_usine: "Audit usine",
};

export const STATUTS_AUDIT: Record<string, string> = {
  demande: "Demandé", planifie: "Planifié", reussi: "Réussi", echoue: "Échoué", annule: "Annulé",
};

export const STATUTS_ECHANTILLON: Record<string, string> = {
  a_commander: "À commander", commande: "Commandé", recu: "Reçu", controle: "Contrôlé",
  refuse_par_fournisseur: "Refusé par le fournisseur",
};

export const VERDICTS_ECHANTILLON: Record<string, string> = {
  conforme: "Conforme", reserves: "Conforme avec réserves", non_conforme: "Non conforme",
};

/** Points de contrôle d'un échantillon reçu, notés de 1 à 5 par le marchand. */
export const CHECKLIST_ECHANTILLON: Record<string, string> = {
  qualite: "Qualité",
  packaging: "Packaging",
  finition: "Finition",
  fonctionnement: "Fonctionnement",
  conformite: "Conformité",
  photos: "Fidélité aux photos",
  delai: "Délai de livraison",
};

export const QUANTITES_ECHANTILLON = [1, 3, 5, 10];
/** Quantités auxquelles la grille de prix est affichée. */
export const QUANTITES_PALIERS = [10, 50, 100, 500, 1000, 5000];

/** Champs dont un admin AXSO (ou une source tierce nommée) atteste la vérification. */
export const CHAMPS_VERIFIABLES: Record<string, string> = {
  identite: "Identité du contact",
  entreprise: "Existence légale de l'entreprise",
  fabricant: "Informations fabricant (usine, capacité)",
};

/** Coordonnées dont les changements sont journalisés (signal de risque s'ils sont fréquents). */
export const CHAMPS_COORDONNEES = ["email", "telephone", "url", "adresseUsine"] as const;

/** Un fournisseur avec tout ce que le moteur analyse. */
export type Dossier = Fournisseur & {
  offres: ProduitFournisseur[];
  documents: DocumentFournisseur[];
  audits: AuditFournisseur[];
  echantillons: EchantillonFournisseur[];
  evaluations: EvaluationFournisseur[];
  verifications: VerificationFournisseur[];
};

/** Critère du score : toujours explicable (valeur, poids, raison, confiance). */
export interface Critere {
  cle: string;
  libelle: string;
  /** 0–100, ou null quand aucune donnée ne permet de noter (compte alors pour 0). */
  note: number | null;
  poids: number;
  raison: string;
  confiance: NiveauConfiance;
}

export type NiveauRisque = "faible" | "moyen" | "eleve";
export const LIBELLES_RISQUE: Record<NiveauRisque, string> = { faible: "LOW RISK", moyen: "MEDIUM RISK", eleve: "HIGH RISK" };

export interface SignalRisque {
  cle: string;
  libelle: string;
  explication: string;
  /** 1 = à surveiller, 2 = sérieux, 3 = critique. */
  gravite: 1 | 2 | 3;
}

export type StatutFabricant = "fabricant" | "fabricant_trading" | "trading" | "insuffisant";

export interface IndiceFabricant {
  cle: string;
  libelle: string;
  points: number;
  obtenu: number;
  present: boolean;
  confiance: NiveauConfiance;
}

export interface DetectionFabricant {
  statut: StatutFabricant;
  libelle: string;
  /** Manufacturer Confidence Score, 0–100. */
  score: number;
  confiance: NiveauConfiance;
  source: string;
  indices: IndiceFabricant[];
}

export type StatutCertification = "verifiee" | "declaree" | "non_trouvee" | "expiree";

export interface EtatCertification {
  code: string;
  note: string;
  statut: StatutCertification;
  /** Source de vérification, ou d'où vient la déclaration. */
  source: string;
  documentId?: string;
  /** Message d'expiration à afficher, le cas échéant. */
  alerte?: string;
}

export interface CritereLabel {
  cle: string;
  libelle: string;
  rempli: boolean;
  applicable: boolean;
  raison: string;
}

export interface AnalyseFournisseur {
  score: number;
  /** Part (0–1) du poids total des critères pour laquelle une donnée existe. */
  couverture: number;
  confiance: NiveauConfiance;
  criteres: Critere[];
  fabricant: DetectionFabricant;
  risque: { niveau: NiveauRisque; points: number; signaux: SignalRisque[]; plancher?: string };
  label: { attribue: boolean; criteres: CritereLabel[] };
  certifications: EtatCertification[];
  /** Note sur les exigences du pays de destination, à confirmer. */
  noteConformitePays?: string;
  qualite: { nbEvaluations: number; tauxDefaut: number | null; moyenne: number | null; delaiReelMoyen: number | null };
}

/** Ce qui dépend de la recherche en cours : volume visé, destination, offres comparables. */
export interface Contexte {
  quantite?: number;
  /** Code ISO2 du pays de destination. */
  pays?: string;
  maintenant?: Date;
  /** Coût rendu par unité de l'offre analysée et des offres comparables (même devise). */
  coutOffre?: number;
  coutsComparables?: number[];
}
