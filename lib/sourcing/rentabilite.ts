// Coût RÉEL par commande livrée et prix de vente conseillé — module pur,
// utilisé en direct par le calculateur (client) et par les API (serveur).
//
// Coût réel = coût rendu (lib/sourcing/cout-rendu.ts) + frais de paiement +
// publicité par commande + risque de refus/retour + autres frais.
// Tout ce qui n'est pas saisi par le marchand vient des valeurs de départ du
// pays : ce sont des ESTIMATIONS, étiquetées comme telles dans l'interface.
import { calculerCoutRendu, arrondirMontant, type EntreeCoutRendu, type LigneCout } from "./cout-rendu";
import { configPays } from "./pays";

export type ModePrix = "marge_fixe" | "marge_pct" | "psychologique" | "auto";

export interface EntreeCoutReel extends EntreeCoutRendu {
  /** Frais du moyen de paiement, en part du prix de vente (0 pour un paiement à la livraison). */
  tauxFraisPaiement?: number;
  /** Dépense publicitaire moyenne pour obtenir UNE commande (CPA), devise cible. */
  coutPubParCommande?: number;
  /** Part des commandes refusées à la livraison (0 à 1). */
  tauxRefus?: number;
  /** Part des commandes livrées puis retournées (0 à 1). */
  tauxRetour?: number;
  autresFrais?: number;
  /** Dropshipping direct : le produit d'une commande refusée est déjà payé au fournisseur, donc perdu. */
  produitPerduSiRefus?: boolean;
  /** Prix de vente retenu ; sans lui, le calcul s'arrête au coût (les frais de paiement valent 0). */
  prixVente?: number;
}

export interface CoutReel {
  lignes: LigneCout[];
  devise: string;
  /** Coût rendu du produit seul (sans livraison locale) — base de la marge brute. */
  coutProduitRendu: number;
  /** Tout sauf la publicité : ce qu'il reste à couvrir avant de payer la pub. */
  coutHorsPub: number;
  coutTotal: number;
  prixVente: number | null;
  margeBrute: number | null;
  /** Bénéfice estimé par commande livrée. */
  margeNette: number | null;
  tauxMargeNette: number | null;
  /** Dépense publicitaire maximale par commande avant de vendre à perte. */
  budgetPubMax: number | null;
  /** ROAS en dessous duquel chaque vente perd de l'argent. */
  roasMinimum: number | null;
  /** Bénéfice rapporté par chaque unité de monnaie dépensée en publicité. */
  roiPublicitaire: number | null;
}

const part = (n: number | undefined, defaut: number) => (typeof n === "number" && n >= 0 && n < 1 ? n : defaut);
const montant = (n: number | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

export function calculerCoutReel(entree: EntreeCoutReel): CoutReel {
  const devise = entree.deviseCible;
  const est = configPays(entree.pays).estimations;
  const rendu = calculerCoutRendu(entree);
  const livraison = rendu.lignes.find((l) => l.cle === "livraison")!.montant;
  const coutProduitRendu = rendu.total - livraison;

  const pub = montant(entree.coutPubParCommande);
  const tauxRefus = part(entree.tauxRefus, est.tauxRefus);
  const tauxRetour = part(entree.tauxRetour, est.tauxRetour);
  const tauxPaiement = part(entree.tauxFraisPaiement, est.tauxFraisPaiement);
  const prixVente = montant(entree.prixVente) || null;

  // Pour chaque commande livrée, tauxRefus / (1 - tauxRefus) commandes ont été
  // refusées : leur livraison et leur publicité sont perdues (et le produit, en
  // dropshipping direct). Un retour perd la livraison et le produit.
  const perduParRefus = livraison + pub + (entree.produitPerduSiRefus ? coutProduitRendu : 0);
  const risque = (tauxRefus / (1 - tauxRefus)) * perduParRefus + tauxRetour * (livraison + coutProduitRendu);

  const lignes: LigneCout[] = [
    ...rendu.lignes,
    { cle: "paiement", libelle: "Frais de paiement", montant: arrondirMontant((prixVente ?? 0) * tauxPaiement, devise) },
    { cle: "publicite", libelle: "Publicité par commande", montant: arrondirMontant(pub, devise) },
    { cle: "risque", libelle: "Refus et retours (estimation)", montant: arrondirMontant(risque, devise) },
    { cle: "autres", libelle: "Autres frais", montant: arrondirMontant(montant(entree.autresFrais), devise) },
  ];
  const coutTotal = arrondirMontant(lignes.reduce((s, l) => s + l.montant, 0), devise);
  const coutHorsPub = coutTotal - lignes.find((l) => l.cle === "publicite")!.montant;

  const margeNette = prixVente === null ? null : arrondirMontant(prixVente - coutTotal, devise);
  const budgetPubMax = prixVente === null ? null : arrondirMontant(prixVente - coutHorsPub, devise);
  return {
    lignes, devise, coutProduitRendu, coutHorsPub, coutTotal, prixVente,
    margeBrute: prixVente === null ? null : arrondirMontant(prixVente - coutProduitRendu, devise),
    margeNette,
    tauxMargeNette: prixVente === null ? null : margeNette! / prixVente,
    budgetPubMax,
    roasMinimum: prixVente !== null && budgetPubMax! > 0 ? Math.round((prixVente / budgetPubMax!) * 100) / 100 : null,
    roiPublicitaire: margeNette !== null && pub > 0 ? Math.round((margeNette / pub) * 100) / 100 : null,
  };
}

/**
 * Palier psychologique immédiatement au-dessus d'un prix : 14 167 → 14 900 FCFA,
 * 8 500 → 8 900, 137 GHS → 139. En franc CFA, jamais plus fin que le millier
 * (9 900, 12 900, 14 900, 19 900, 24 900…).
 */
export function prixPsychologique(prix: number, devise: string): number {
  if (!(prix > 0)) return 0;
  let unite = Math.pow(10, Math.floor(Math.log10(prix)) - 1);
  if (devise === "XAF" || devise === "XOF") unite = Math.max(1000, unite);
  let palier = Math.ceil(prix / unite) * unite - unite / 10;
  if (palier < prix) palier += unite;
  return arrondirMontant(palier, devise);
}

export interface EntreePrix {
  mode: ModePrix;
  /** Coût réel SANS frais de paiement (ils dépendent du prix : ils sont ajoutés ici). */
  coutHorsPaiement: number;
  devise: string;
  tauxFraisPaiement?: number;
  /** Bénéfice voulu par commande (mode marge_fixe). */
  margeFixe?: number;
  /** Part du prix de vente gardée en bénéfice, ex. 0.4 = 40 % (modes marge_pct, psychologique, auto). */
  margePct?: number;
}

export interface PrixConseille {
  prix: number;
  /** Raisons du prix, dans l'ordre du calcul — affichées telles quelles au marchand. */
  explication: string[];
}

export const MARGE_AUTO = 0.4;

/** Prix de vente conseillé, avec l'explication du calcul. */
export function recommanderPrix(e: EntreePrix): PrixConseille {
  const taux = part(e.tauxFraisPaiement, 0);
  const cout = Math.max(0, e.coutHorsPaiement);
  const f = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} ${e.devise}`;
  const explication = [`Votre coût réel par commande est de ${f(cout)}.`];
  let brut: number;

  if (e.mode === "marge_fixe") {
    const marge = Math.max(0, e.margeFixe ?? 0);
    brut = (cout + marge) / (1 - taux);
    explication.push(`Vous voulez gagner ${f(marge)} par commande.`);
  } else {
    const voulu = Math.min(0.9, Math.max(0, e.margePct ?? MARGE_AUTO));
    // Marge + frais de paiement doivent laisser au moins 5 % du prix pour le coût : au-delà, le prix serait infini ou négatif.
    const pct = Math.min(voulu, Math.max(0, 0.95 - taux));
    brut = cout / (1 - pct - taux);
    if (pct < voulu) explication.push(`Une marge de ${Math.round(voulu * 100)} % est impossible avec ${Math.round(taux * 100)} % de frais de paiement : elle est ramenée à ${Math.round(pct * 100)} %.`);
    explication.push(e.mode === "auto" && e.margePct === undefined
      ? `Axso vise ${Math.round(pct * 100)} % de bénéfice sur le prix de vente : assez pour absorber une hausse du coût publicitaire.`
      : `Vous visez ${Math.round(pct * 100)} % de bénéfice sur le prix de vente.`);
  }
  if (taux > 0) explication.push(`Les frais de paiement (${(taux * 100).toFixed(1).replace(".0", "")} % du prix) sont inclus.`);
  explication.push(`Il faut donc vendre au moins ${f(brut)}.`);

  // « Marge fixe » et « marge % » donnent le prix exact ; les deux autres l'arrondissent au palier psychologique.
  let prix = arrondirMontant(brut, e.devise);
  if (e.mode === "psychologique" || e.mode === "auto") {
    prix = prixPsychologique(brut, e.devise);
    explication.push(`Arrondi au palier psychologique supérieur : ${f(prix)} se lit moins cher qu'un prix rond et protège votre marge.`);
  }
  explication.push(`Bénéfice estimé : ${f(prix * (1 - taux) - cout)} par commande livrée.`);
  return { prix, explication };
}

export interface Tarification {
  mode?: ModePrix;
  margeFixe?: number;
  margePct?: number;
  /** Prix choisi par le marchand ; sinon le prix conseillé est retenu. */
  prixVente?: number;
}

export interface Rentabilite {
  cout: CoutReel;
  conseil: PrixConseille;
}

/** Calcul complet d'un produit : prix conseillé, puis coût réel et marges au prix retenu. */
export function analyserRentabilite(entree: EntreeCoutReel, tarif: Tarification = {}): Rentabilite {
  const tauxFraisPaiement = part(entree.tauxFraisPaiement, configPays(entree.pays).estimations.tauxFraisPaiement);
  const sansPrix = calculerCoutReel({ ...entree, prixVente: undefined });
  const conseil = recommanderPrix({
    mode: tarif.mode ?? "auto", coutHorsPaiement: sansPrix.coutTotal, devise: entree.deviseCible,
    tauxFraisPaiement, margeFixe: tarif.margeFixe, margePct: tarif.margePct,
  });
  return { conseil, cout: calculerCoutReel({ ...entree, prixVente: montant(tarif.prixVente) || conseil.prix }) };
}
