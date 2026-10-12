// Évaluation d'un produit sourcé (ProduitSource) : assemble sa fiche, les
// réglages de la boutique et les hypothèses saisies en une entrée du
// calculateur, puis rend coût réel, prix conseillé et score. Module pur : le
// même calcul tourne en direct dans le navigateur et côté serveur.
import { analyserRentabilite, type EntreeCoutReel, type Rentabilite, type Tarification } from "./rentabilite";
import { calculerScore, type CleCritere, type ScoreProduit } from "./score";
import { z } from "zod";
import { configPays, CODES_PAYS, type CodePays, type EstimationsPays } from "./pays";

export const MODES_APPRO = [
  { cle: "dropshipping", libelle: "Dropshipping", resume: "Le fournisseur expédie directement à votre client. Aucun stock à acheter d'avance.", typeProduit: "dropshipping" },
  { cle: "stock_axso", libelle: "Stock chez un partenaire", resume: "La marchandise est importée en quantité et stockée localement chez un partenaire logistique : livraison en quelques jours.", typeProduit: "physique" },
  { cle: "stock_vendeur", libelle: "Mon propre stock", resume: "Vous importez et gérez vous-même le stock. La meilleure marge, mais l'argent est immobilisé.", typeProduit: "physique" },
] as const;
export type ModeAppro = (typeof MODES_APPRO)[number]["cle"];

/** Feuille de route d'un produit : DÉCOUVERTE → TEST → VALIDATION → STOCK → MARQUE → SCALE. */
export const ETAPES_PRODUIT = [
  { cle: "decouverte", libelle: "Découverte", objectif: "Analyser le produit avant d'y mettre de l'argent." },
  { cle: "test", libelle: "Test", objectif: "Vendre les premières unités pour vérifier la demande." },
  { cle: "validation", libelle: "Validation", objectif: "Le produit se vend avec un bénéfice : c'est un produit gagnant." },
  { cle: "stock", libelle: "Stock local", objectif: "Importer en volume pour livrer vite et augmenter la marge." },
  { cle: "marque", libelle: "Marque", objectif: "Logo, emballage personnalisé, marque privée (private label)." },
  { cle: "scale", libelle: "Scale", objectif: "Augmenter la publicité et ouvrir d'autres pays." },
] as const;
export type EtapeProduit = (typeof ETAPES_PRODUIT)[number]["cle"];
export const ETAPES_GAGNANTES: EtapeProduit[] = ["validation", "stock", "marque", "scale"];

/** Réglages Sourcing de la boutique (ReglagesSourcing.reglages) — tout est optionnel. */
export interface Reglages extends Partial<EstimationsPays> {
  pays?: CodePays;
  /** Tarif du transitaire au kilo, devise de la boutique. */
  tarifTransportKg?: number;
  /** Frais de transitaire et de dédouanement habituels PAR ENVOI. */
  fraisTransitaire?: number;
  fraisDedouanement?: number;
  /** Frais de livraison au client, par commande. */
  livraisonLocale?: number;
  pointEntree?: string;
}

/** Hypothèses propres à un produit (ProduitSource.parametresCout) : remplacent les réglages. */
export interface ParametresCout extends Reglages {
  /** Taille du lot importé (modes avec stock) ; 1 en dropshipping. */
  quantite?: number;
  transportInternational?: number;
  assurance?: number;
  coutPubParCommande?: number;
  autresFrais?: number;
}

/** Validation des hypothèses envoyées par le marchand (réglages de la boutique et paramètres d'un produit). */
const montant = z.number().nonnegative().max(1e12).optional();
const part = z.number().min(0).max(0.95).optional();
export const schemaHypotheses = z.object({
  pays: z.enum(CODES_PAYS as [CodePays, ...CodePays[]]).optional(),
  tauxDroits: z.number().min(0).max(5).optional(), tauxRefus: part, tauxRetour: part, tauxFraisPaiement: part,
  tarifTransportKg: montant, fraisTransitaire: montant, fraisDedouanement: montant, livraisonLocale: montant,
  pointEntree: z.string().max(80).optional(),
  quantite: z.number().int().positive().max(1e7).optional(),
  transportInternational: montant, assurance: montant, coutPubParCommande: montant, autresFrais: montant,
}).strict();

/** Contexte de calcul fourni par le serveur avec chaque produit. */
export interface ContexteCalcul {
  pays: CodePays;
  devise: string;
  reglages: Reglages;
  /** Table « 1 XAF = x devise » du jour. */
  taux: Record<string, number>;
  /** Taux de refus mesuré sur les commandes de la boutique ; null = pas assez de commandes. */
  tauxRefusReel: number | null;
}

export interface FicheSource {
  prixFournisseur: number;
  deviseFournisseur: string;
  moq?: number;
  poidsKg?: number | null;
  disponibilite?: number | null;
  modeAppro?: string;
  parametresCout?: unknown;
  tarification?: unknown;
  criteresScore?: unknown;
}

const objet = <T>(v: unknown): T => (v && typeof v === "object" ? v : {}) as T;

export function entreeCoutProduit(s: FicheSource, ctx: ContexteCalcul): EntreeCoutReel {
  const p = { ...ctx.reglages, ...objet<ParametresCout>(s.parametresCout) };
  const dropshipping = (s.modeAppro ?? "dropshipping") === "dropshipping";
  return {
    prixUnitaire: s.prixFournisseur,
    deviseFournisseur: s.deviseFournisseur,
    quantite: dropshipping ? 1 : Math.max(1, p.quantite ?? s.moq ?? 1),
    poidsKg: s.poidsKg ?? undefined,
    pays: ctx.pays,
    deviseCible: ctx.devise,
    tauxChange: ctx.taux,
    transportInternational: p.transportInternational,
    tarifTransportKg: p.tarifTransportKg,
    assurance: p.assurance,
    tauxDroits: p.tauxDroits,
    fraisTransitaire: p.fraisTransitaire,
    fraisDedouanement: p.fraisDedouanement,
    livraisonLocale: p.livraisonLocale,
    tauxFraisPaiement: p.tauxFraisPaiement,
    coutPubParCommande: p.coutPubParCommande,
    // Refus : la valeur saisie ; sinon 0 en dropshipping (commande payée en ligne avant
    // l'expédition, pas de refus à la porte) ; sinon le taux mesuré sur les vraies commandes
    // payées à la livraison, et à défaut l'estimation du pays.
    tauxRefus: p.tauxRefus ?? (dropshipping ? 0 : ctx.tauxRefusReel ?? undefined),
    tauxRetour: p.tauxRetour,
    autresFrais: p.autresFrais,
    produitPerduSiRefus: dropshipping,
  };
}

export interface Evaluation extends Rentabilite {
  score: ScoreProduit;
  /** Hypothèses effectivement utilisées, pour les afficher (et dire lesquelles sont des estimations). */
  hypotheses: { tauxDroits: number; tauxRefus: number; tauxRetour: number; tauxFraisPaiement: number; refusMesure: boolean };
}

export function evaluerProduit(s: FicheSource, ctx: ContexteCalcul): Evaluation {
  const entree = entreeCoutProduit(s, ctx);
  const est = configPays(ctx.pays).estimations;
  const r = analyserRentabilite(entree, objet<Tarification>(s.tarification));
  const score = calculerScore({
    tauxMargeNette: r.cout.tauxMargeNette,
    prixFournisseur: s.prixFournisseur, deviseFournisseur: s.deviseFournisseur,
    poidsKg: s.poidsKg, disponibilite: s.disponibilite,
    estimations: objet<Partial<Record<CleCritere, number>>>(s.criteresScore),
  });
  const saisi = { ...ctx.reglages, ...objet<ParametresCout>(s.parametresCout) };
  return {
    ...r, score,
    hypotheses: {
      tauxDroits: entree.tauxDroits ?? est.tauxDroits,
      tauxRefus: entree.tauxRefus ?? est.tauxRefus,
      tauxRetour: entree.tauxRetour ?? est.tauxRetour,
      tauxFraisPaiement: entree.tauxFraisPaiement ?? est.tauxFraisPaiement,
      refusMesure: saisi.tauxRefus === undefined && ctx.tauxRefusReel !== null && (s.modeAppro ?? "dropshipping") !== "dropshipping",
    },
  };
}
