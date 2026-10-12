// Price Intelligence et coût total de possession (TCO) — fonctions pures.
// Le classement des fournisseurs ne se fait jamais sur le prix catalogue : il
// se fait sur le coût réel estimé par unité vendable, rendu dans le pays.
//   coût rendu (lib/sourcing/cout-rendu.ts : produit + transport + assurance +
//   droits/taxes + dédouanement + livraison locale)
//   + inspection + défauts estimés + retours + capital immobilisé pendant le délai.
import type { ProduitFournisseur } from "@prisma/client";
import { calculerCoutRendu, arrondirMontant, type EntreeCoutRendu, type LigneCout } from "../cout-rendu";
import { configPays } from "../pays";
import { QUANTITES_PALIERS } from "./types";

export interface Palier { quantiteMin: number; prix: number }

/** Paliers valides d'une offre, triés par quantité croissante. */
export function lirePaliers(json: unknown): Palier[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((p) => ({ quantiteMin: Math.floor(Number(p?.quantiteMin)), prix: Number(p?.prix) }))
    .filter((p) => p.quantiteMin > 0 && p.prix > 0)
    .sort((a, b) => a.quantiteMin - b.quantiteMin);
}

type OffrePrix = Pick<ProduitFournisseur, "prixUnitaire" | "paliers">;

/** Prix unitaire pour une quantité : le dernier palier atteint, sinon le prix de base. */
export function prixPourQuantite(offre: OffrePrix, quantite: number): number {
  const atteints = lirePaliers(offre.paliers).filter((p) => p.quantiteMin <= quantite);
  return atteints.length ? atteints[atteints.length - 1].prix : offre.prixUnitaire;
}

/** Grille « 10 → 3,50 ; 50 → 3,10 ; … » aux quantités standard, à partir du MOQ. */
export function grillePrix(offre: OffrePrix & Pick<ProduitFournisseur, "moq">) {
  return QUANTITES_PALIERS.map((quantite) => ({ quantite, prix: prixPourQuantite(offre, quantite), sousMoq: offre.moq != null && quantite < offre.moq }));
}

/** Paramètres logistiques de l'envoi (voir EntreeCoutRendu) : tout sauf ce que porte l'offre. */
export type Logistique = Omit<EntreeCoutRendu, "prixUnitaire" | "deviseFournisseur" | "poidsKg">;

/** Hypothèses du TCO : toutes modifiables par le marchand, toujours affichées comme des estimations. */
export interface HypothesesTco {
  /** Coût d'une inspection par un tiers pour l'envoi entier, dans la devise cible. */
  fraisInspection?: number;
  /** Taux de défaut constaté sur les commandes évaluées ; null = jamais mesuré. */
  tauxDefautConstate?: number | null;
  tauxDefautHypothese?: number;
  tauxRetour?: number;
  /** Jours pendant lesquels l'argent est immobilisé (production + transport). */
  delaiJours: number;
  tauxCapitalAnnuel?: number;
}

/** Valeurs de départ quand rien n'a été mesuré ni saisi — des hypothèses, pas des constats. */
export const HYPOTHESES_DEFAUT = { tauxDefaut: 0.03, tauxCapitalAnnuel: 0.15 };

export interface LigneTco extends LigneCout {
  /** D'où vient le montant : saisi, constaté ou hypothèse. */
  source: string;
}

export interface CoutTotal {
  /** Prix unitaire fournisseur retenu pour la quantité, dans sa devise. */
  prix: number;
  devisePrix: string;
  quantite: number;
  /** Coût rendu par unité (landed cost). */
  rendu: number;
  /** Coût réel estimé par unité vendable (TCO). */
  total: number;
  devise: string;
  lignes: LigneTco[];
}

export function calculerCoutTotal(
  offre: Pick<ProduitFournisseur, "prixUnitaire" | "paliers" | "devise" | "poidsKg">,
  logistique: Logistique,
  hyp: HypothesesTco,
): CoutTotal {
  const quantite = Math.max(1, Math.floor(logistique.quantite) || 1);
  const prix = prixPourQuantite(offre, quantite);
  const rendu = calculerCoutRendu({ ...logistique, quantite, prixUnitaire: prix, deviseFournisseur: offre.devise, poidsKg: offre.poidsKg ?? undefined });
  const devise = rendu.devise;
  const produit = rendu.lignes.find((l) => l.cle === "produit")?.montant ?? 0;

  const constate = hyp.tauxDefautConstate != null;
  const tauxDefaut = Math.min(0.9, constate ? hyp.tauxDefautConstate! : hyp.tauxDefautHypothese ?? HYPOTHESES_DEFAUT.tauxDefaut);
  const tauxRetour = hyp.tauxRetour ?? configPays(logistique.pays).estimations.tauxRetour;
  const tauxCapital = hyp.tauxCapitalAnnuel ?? HYPOTHESES_DEFAUT.tauxCapitalAnnuel;
  const pct = (t: number) => `${(t * 100).toFixed(1).replace(".0", "")} %`;

  const lignes: LigneTco[] = [
    // Un poste à 0 n'est pas « gratuit » : il n'a pas été renseigné, et l'interface le dit.
    ...rendu.lignes.map((l) => ({ ...l, source: l.cle === "produit" ? `Prix pour ${quantite} unités` : l.cle === "droits" ? "Estimation à confirmer avec votre transitaire" : l.montant > 0 ? "Réglages Sourcing de la boutique" : "Non renseigné (Pays & intégrations)" })),
    { cle: "inspection", libelle: "Inspection qualité", montant: (hyp.fraisInspection ?? 0) / quantite, source: hyp.fraisInspection ? "Montant saisi" : "Aucune inspection prévue" },
    // Pour vendre 1 unité saine il faut en acheter 1 / (1 − taux de défaut).
    { cle: "defauts", libelle: "Défauts estimés", montant: rendu.total * (tauxDefaut / (1 - tauxDefaut)), source: constate ? `${pct(tauxDefaut)} constatés sur vos commandes` : `Hypothèse ${pct(tauxDefaut)} — aucune commande évaluée` },
    { cle: "retours", libelle: "Retours clients", montant: rendu.total * tauxRetour, source: `Hypothèse ${pct(tauxRetour)} de retours` },
    { cle: "capital", libelle: "Capital immobilisé (délais)", montant: produit * tauxCapital * (Math.max(0, hyp.delaiJours) / 365), source: `${Math.round(hyp.delaiJours)} jours à ${pct(tauxCapital)} par an (hypothèse)` },
  ].map((l) => ({ ...l, montant: arrondirMontant(l.montant, devise) }));

  return { prix, devisePrix: offre.devise, quantite, rendu: rendu.total, devise, lignes, total: arrondirMontant(lignes.reduce((s, l) => s + l.montant, 0), devise) };
}
