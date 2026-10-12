// Score produit sur 100 — module pur, explicable critère par critère.
//
// Quatre critères sont CALCULÉS à partir de données réelles du produit (marge,
// prix fournisseur, poids, disponibilité). Les autres ne sont mesurables par
// aucune source branchée (concurrence, demande…) : ce sont des ESTIMATIONS
// saisies par le marchand ou proposées par le copilote IA, de 1 (défavorable)
// à 5 (favorable), et affichées comme telles.
// Un critère non renseigné ne compte pas : le score porte sur le reste, et
// `confiance` dit quelle part du barème est réellement renseignée.
import { versXAF } from "../devise-convert";

export type CleCritere =
  | "marge" | "prixFournisseur" | "poids" | "disponibilite"
  | "livraison" | "concurrence" | "demande" | "potentielPub"
  | "risqueRetour" | "risqueReglementaire" | "branding" | "reachat";

/** Critères estimés : libellé, poids, et ce que veulent dire 1 et 5. */
export const CRITERES_ESTIMES: { cle: CleCritere; libelle: string; poids: number; bas: string; haut: string }[] = [
  { cle: "demande", libelle: "Demande estimée", poids: 12, bas: "Presque personne ne le cherche", haut: "Beaucoup de gens le veulent" },
  { cle: "concurrence", libelle: "Concurrence", poids: 8, bas: "Déjà vendu partout", haut: "Peu de vendeurs" },
  { cle: "livraison", libelle: "Facilité de livraison", poids: 8, bas: "Fragile ou encombrant", haut: "Petit et solide" },
  { cle: "potentielPub", libelle: "Potentiel publicitaire", poids: 8, bas: "Difficile à montrer", haut: "Effet visible en vidéo" },
  { cle: "risqueRetour", libelle: "Risque de retour", poids: 7, bas: "Retours fréquents (taille, panne)", haut: "Retours rares" },
  { cle: "risqueReglementaire", libelle: "Risque réglementaire", poids: 7, bas: "Produit contrôlé ou interdit", haut: "Aucune restriction connue" },
  { cle: "branding", libelle: "Possibilité de marque", poids: 6, bas: "Impossible à personnaliser", haut: "Logo et emballage faciles" },
  { cle: "reachat", libelle: "Potentiel de réachat", poids: 6, bas: "Acheté une seule fois", haut: "Racheté régulièrement" },
];

const POIDS_CALCULES = { marge: 18, poids: 8, prixFournisseur: 6, disponibilite: 6 } as const;

export interface EntreeScore {
  /** Bénéfice / prix de vente, issu du calculateur de coût réel. */
  tauxMargeNette?: number | null;
  prixFournisseur?: number | null;
  deviseFournisseur?: string;
  poidsKg?: number | null;
  /** Stock annoncé par le fournisseur ; null/undefined = inconnu. */
  disponibilite?: number | null;
  /** Estimations de 1 à 5 par critère. */
  estimations?: Partial<Record<CleCritere, number>>;
}

export interface CritereNote {
  cle: CleCritere;
  libelle: string;
  poids: number;
  /** Note sur 10 ; null = non renseigné. */
  note: number | null;
  source: "calcule" | "estime" | "non_renseigne";
  explication: string;
}

export interface ScoreProduit {
  total: number;
  /** Part du barème réellement renseignée (0 à 1). */
  confiance: number;
  verdict: string;
  niveau: "excellent" | "bon" | "moyen" | "risque";
  criteres: CritereNote[];
}

const borne = (n: number) => Math.max(0, Math.min(10, n));
/** 10 à `bon`, 0 à `mauvais`, linéaire entre les deux. */
const echelle = (v: number, mauvais: number, bon: number) => borne(((v - mauvais) / (bon - mauvais)) * 10);

export function calculerScore(e: EntreeScore): ScoreProduit {
  const criteres: CritereNote[] = [];
  const calcule = (cle: keyof typeof POIDS_CALCULES, libelle: string, note: number | null, explication: string) =>
    criteres.push({ cle, libelle, poids: POIDS_CALCULES[cle], note: note === null ? null : Math.round(note * 10) / 10, source: note === null ? "non_renseigne" : "calcule", explication });

  const m = e.tauxMargeNette;
  calcule("marge", "Marge potentielle", typeof m === "number" ? echelle(m, 0, 0.45) : null,
    typeof m === "number" ? `Bénéfice estimé de ${Math.round(m * 100)} % du prix de vente (45 % et plus = note maximale).` : "Renseignez les coûts dans le calculateur.");

  const prixXAF = e.prixFournisseur ? versXAF(e.prixFournisseur, e.deviseFournisseur ?? "USD") : null;
  calcule("prixFournisseur", "Prix fournisseur", prixXAF === null ? null : echelle(Math.log10(prixXAF), Math.log10(60000), Math.log10(3000)),
    prixXAF === null ? "Prix fournisseur inconnu." : "Plus le prix d'achat est bas, moins le test immobilise d'argent.");

  calcule("poids", "Poids", typeof e.poidsKg === "number" && e.poidsKg > 0 ? echelle(e.poidsKg, 5, 0.3) : null,
    typeof e.poidsKg === "number" && e.poidsKg > 0 ? `${e.poidsKg} kg : le transport se paie au poids (0,3 kg ou moins = note maximale).` : "Poids inconnu.");

  const d = e.disponibilite;
  calcule("disponibilite", "Disponibilité fournisseur", typeof d === "number" ? (d <= 0 ? 0 : echelle(d, 0, 200)) : null,
    typeof d === "number" ? `${d} unité(s) annoncée(s) par le fournisseur.` : "Stock fournisseur inconnu.");

  for (const c of CRITERES_ESTIMES) {
    const v = e.estimations?.[c.cle];
    const ok = typeof v === "number" && v >= 1 && v <= 5;
    criteres.push({
      cle: c.cle, libelle: c.libelle, poids: c.poids,
      note: ok ? ((v - 1) / 4) * 10 : null,
      source: ok ? "estime" : "non_renseigne",
      explication: ok ? `Votre estimation : ${v}/5 (1 = ${c.bas.toLowerCase()}, 5 = ${c.haut.toLowerCase()}).` : "À estimer.",
    });
  }

  const notes = criteres.filter((c) => c.note !== null);
  const poidsRenseigne = notes.reduce((s, c) => s + c.poids, 0);
  const total = poidsRenseigne ? Math.round(notes.reduce((s, c) => s + c.note! * c.poids, 0) / poidsRenseigne * 10) : 0;
  const niveau = total >= 80 ? "excellent" : total >= 65 ? "bon" : total >= 50 ? "moyen" : "risque";
  const verdict = { excellent: "Excellent candidat au test", bon: "Bon candidat au test", moyen: "À tester avec prudence", risque: "Risqué en l'état" }[niveau];
  return { total, confiance: poidsRenseigne / 100, verdict, niveau, criteres };
}
