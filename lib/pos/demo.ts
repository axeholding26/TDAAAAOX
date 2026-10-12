// Mode démo (§76) — CLIENT-SAFE, AUCUNE écriture en base.
//
// POURQUOI UNE VISITE GUIDÉE ET PAS DES DONNÉES EN BASE
// `Magasin.demo` existe, mais une vente de démonstration resterait une vraie
// `Commande` : elle sortirait du vrai stock (Produit.stock n'a pas de marqueur
// démo), créerait une vraie facture, et entrerait dans la comptabilité, le
// rapprochement, les statistiques client et les écrans de stock des autres
// modules, qui ne filtrent pas sur `Magasin.demo`. L'isoler proprement demande
// de toucher les fondations (marqueur démo sur Produit, filtre dans chaque
// lecture). Plutôt qu'une isolation à moitié, la démo est une visite de l'écran
// de caisse jouée ENTIÈREMENT dans le navigateur : les articles ci-dessous
// n'existent nulle part ailleurs, le total est calculé par la vraie fonction
// `calculerPanier`, et rien n'est envoyé au serveur. Elle se « supprime » en
// fermant la fenêtre.
// Les chiffres réels excluent quand même tout magasin marqué `demo`
// (lib/pos/analytics/ventes.ts), pour le jour où ce marqueur servira.
import type { LignePanier } from "./types";

export type ArticleDemo = Pick<LignePanier, "produitId" | "nom" | "prixUnitaire" | "categorie" | "uniteVente"> & { codeBarres: string };

/** Catalogue fictif de la visite. Prix pensés pour une devise sans centimes ; ils ne sont que des exemples. */
export const ARTICLES_DEMO: ArticleDemo[] = [
  { produitId: "demo-1", nom: "Riz parfumé 5 kg", prixUnitaire: 4500, categorie: "Épicerie", uniteVente: "piece", codeBarres: "2000000000015" },
  { produitId: "demo-2", nom: "Huile végétale 1 L", prixUnitaire: 1500, categorie: "Épicerie", uniteVente: "piece", codeBarres: "2000000000022" },
  { produitId: "demo-3", nom: "Savon de ménage", prixUnitaire: 400, categorie: "Entretien", uniteVente: "piece", codeBarres: "2000000000039" },
  { produitId: "demo-4", nom: "Lait en poudre 400 g", prixUnitaire: 2800, categorie: "Épicerie", uniteVente: "piece", codeBarres: "2000000000046" },
  { produitId: "demo-5", nom: "Eau minérale 1,5 L", prixUnitaire: 500, categorie: "Boissons", uniteVente: "piece", codeBarres: "2000000000053" },
  { produitId: "demo-6", nom: "Tomates (au kilo)", prixUnitaire: 1200, categorie: "Frais", uniteVente: "kg", codeBarres: "2100006000000" },
];

export type EtapeDemo = { id: "scan" | "panier" | "paiement" | "recu"; titre: string; texte: string };

export const ETAPES_DEMO: EtapeDemo[] = [
  { id: "scan", titre: "1. Scanner ou toucher un article", texte: "En vrai, la douchette, la caméra ou un téléphone appairé ajoutent l'article. Ici, touchez un article de démonstration." },
  { id: "panier", titre: "2. Le panier se calcule seul", texte: "Quantités, remise et taxes sont recalculées à chaque geste, avec les mêmes règles que la vraie caisse." },
  { id: "paiement", titre: "3. Encaisser", texte: "Espèces, Mobile Money, carte ou plusieurs moyens à la fois. La monnaie à rendre s'affiche." },
  { id: "recu", titre: "4. Reçu", texte: "La vraie caisse imprime le reçu, sort le stock et alimente vos chiffres. Cette démonstration n'enregistre rien." },
];
