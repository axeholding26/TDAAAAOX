// Réapprovisionnement : quoi commander, combien, à qui, et pourquoi.
// SERVEUR uniquement.
//
// Part de previsionsStock (lib/sourcing/stocks.ts : ventes réelles des 30
// derniers jours, stock, délai) et y ajoute ce que la caisse sait :
// - le fournisseur PRINCIPAL du produit (ProduitFournisseur.principal), son
//   délai et son minimum de commande ;
// - ce qui est déjà en commande (bons envoyés non reçus), pour ne pas commander deux fois ;
// - le seuil d'alerte du produit (Produit.stockMin) comme plancher du stock de sécurité ;
// - une saisonnalité estimée sur les ventes de l'an dernier (./regles.ts) ;
// - l'historique des 8 dernières semaines, pour que le marchand juge par lui-même.
// Rien n'est inventé : une donnée absente est rendue null et affichée « non renseigné ».
import { prisma } from "../../prisma";
import { previsionsStock } from "../../sourcing/stocks";
import { STATUTS_RECEVABLES, calculerReappro, saisonnalite, type CalculReappro, type Saisonnalite } from "./regles";

const JOUR = 86_400_000;
const SEMAINES_HISTORIQUE = 8;

export type LigneReappro = {
  produitId: string;
  nom: string;
  image: string | null;
  uniteVente: string;
  /** Avec variantes : la quantité porte sur le produit, la répartition se fait à la réception. */
  aVariantes: boolean;
  niveau: "rupture" | "urgent" | "a_surveiller" | "ok";
  stock: number;
  enCommande: number;
  ventes30j: number;
  joursRestants: number | null;
  delaiJours: number;
  /** false : aucun délai renseigné, 15 jours par défaut. */
  delaiConnu: boolean;
  moq: number | null;
  stockMin: number | null;
  saison: Saisonnalite;
  /** Ventes par semaine, de la plus ancienne à la plus récente. */
  semaines: number[];
  calcul: CalculReappro;
  fournisseur: { id: string; nom: string; principal: boolean } | null;
  /** Prix d'achat estimé : le coût actuel du produit (tenu par les réceptions). null = inconnu. */
  prixEstime: number | null;
};

/** Ventes par produit entre deux dates (commandes non annulées), tous canaux. */
async function ventesEntre(tenantId: string, debut: Date, fin: Date): Promise<Map<string, number>> {
  const lignes = await prisma.ligneCommande.groupBy({
    by: ["produitId"],
    where: { commande: { tenantId, createdAt: { gte: debut, lt: fin }, statut: { not: "annulee" } } },
    _sum: { quantite: true },
  });
  return new Map(lignes.map((l) => [l.produitId, l._sum.quantite ?? 0]));
}

export async function recommandationsReappro(tenantId: string): Promise<{ aCommander: LigneReappro[]; sansRecommandation: LigneReappro[]; analyses: number }> {
  const previsions = await previsionsStock(tenantId);
  const maintenant = Date.now();
  const ilYaUnAn = maintenant - 365 * JOUR;

  const [produits, offres, commandes, avant, apres, ...semaines] = await Promise.all([
    // Même périmètre que previsionsStock, sans liste d'identifiants (un grand catalogue dépasserait la limite de paramètres SQL).
    prisma.produit.findMany({ where: { tenantId, type: "physique", actif: true }, select: { id: true, uniteVente: true, cout: true, stockMin: true, fournisseurId: true, fournisseur: { select: { id: true, nom: true } }, _count: { select: { variantes: true } } } }),
    prisma.produitFournisseur.findMany({ where: { tenantId, produitId: { not: null }, principal: true }, select: { produitId: true, moq: true, delaiProduction: true, fournisseur: { select: { id: true, nom: true, delaiLivraison: true } } } }),
    prisma.ligneBonCommande.findMany({ where: { bonCommande: { tenantId, statut: { in: STATUTS_RECEVABLES } } }, select: { produitId: true, quantite: true, quantiteRecue: true } }),
    // Saisonnalité : les 30 jours avant et après la même date, l'an dernier.
    ventesEntre(tenantId, new Date(ilYaUnAn - 30 * JOUR), new Date(ilYaUnAn)),
    ventesEntre(tenantId, new Date(ilYaUnAn), new Date(ilYaUnAn + 30 * JOUR)),
    ...Array.from({ length: SEMAINES_HISTORIQUE }, (_, i) => {
      const fin = maintenant - (SEMAINES_HISTORIQUE - 1 - i) * 7 * JOUR;
      return ventesEntre(tenantId, new Date(fin - 7 * JOUR), new Date(fin));
    }),
  ]);
  const fiche = new Map(produits.map((p) => [p.id, p]));
  const principale = new Map(offres.map((o) => [o.produitId!, o]));
  const enCommande = new Map<string, number>();
  for (const l of commandes) enCommande.set(l.produitId, (enCommande.get(l.produitId) ?? 0) + Math.max(0, l.quantite - l.quantiteRecue));

  const lignes = previsions.flatMap((p): LigneReappro[] => {
    const f = fiche.get(p.produitId);
    if (!f) return [];
    const offre = principale.get(p.produitId);
    const saison = saisonnalite(avant.get(p.produitId) ?? 0, apres.get(p.produitId) ?? 0);
    const delaiJours = offre && offre.fournisseur.delaiLivraison !== null ? (offre.delaiProduction ?? 0) + offre.fournisseur.delaiLivraison : p.delaiReappro;
    const deja = enCommande.get(p.produitId) ?? 0;
    return [{
      produitId: p.produitId, nom: p.nom, image: p.image, uniteVente: f.uniteVente, aVariantes: f._count.variantes > 0,
      niveau: p.niveau, stock: p.stock, enCommande: deja, ventes30j: p.ventes30j, joursRestants: p.joursRestants,
      delaiJours, delaiConnu: offre ? true : p.delaiConnu, moq: offre?.moq ?? null, stockMin: f.stockMin,
      saison, semaines: semaines.map((s) => s.get(p.produitId) ?? 0),
      calcul: calculerReappro({ ventes30j: p.ventes30j, coefficient: saison.coefficient, delaiJours, stock: p.stock, enCommande: deja, stockMin: f.stockMin, moq: offre?.moq }),
      fournisseur: offre ? { id: offre.fournisseur.id, nom: offre.fournisseur.nom, principal: true } : f.fournisseur ? { ...f.fournisseur, principal: false } : null,
      prixEstime: f.cout,
    }];
  });
  return {
    aCommander: lignes.filter((l) => l.calcul.quantite > 0),
    // En rupture, sans vente récente ni seuil d'alerte : aucun chiffre honnête à proposer.
    sansRecommandation: lignes.filter((l) => l.calcul.quantite === 0 && l.stock <= 0 && l.enCommande === 0).slice(0, 50),
    analyses: lignes.length,
  };
}
