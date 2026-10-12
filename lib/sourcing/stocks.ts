// Prévision de rupture de stock — calculée sur les ventes réelles des 30
// derniers jours. SERVEUR uniquement.
//
// Exemple : stock 15, 5 ventes par jour → rupture estimée dans 3 jours.
// Quantité à commander = ventes par jour × (délai du fournisseur + 14 jours
// de sécurité) − stock restant, arrondie au minimum de commande du fournisseur.
// Seuls les produits physiques ont un stock suivi (lib/stock.ts) : un produit
// en dropshipping n'apparaît pas ici, son stock est chez le fournisseur.
import { prisma } from "../prisma";

const FENETRE_JOURS = 30;
const SECURITE_JOURS = 14;
const DELAI_DEFAUT = 15; // jours — hypothèse quand le fournisseur n'a pas annoncé de délai

export interface PrevisionStock {
  produitId: string;
  nom: string;
  image: string | null;
  stock: number;
  ventes30j: number;
  ventesParJour: number;
  /** Jours avant rupture au rythme actuel ; null = aucune vente sur la période. */
  joursRestants: number | null;
  delaiReappro: number;
  /** true si le délai vient du fournisseur ou de la fiche sourcing, false si c'est la valeur par défaut. */
  delaiConnu: boolean;
  aCommander: number;
  niveau: "rupture" | "urgent" | "a_surveiller" | "ok";
  fournisseur: string | null;
  sourceId: string | null;
}

export async function previsionsStock(tenantId: string): Promise<PrevisionStock[]> {
  const depuis = new Date(Date.now() - FENETRE_JOURS * 86400_000);
  const [produits, ventes, sources] = await Promise.all([
    prisma.produit.findMany({
      where: { tenantId, type: "physique", actif: true },
      select: {
        id: true, nom: true, images: true, stock: true, nomFournisseur: true,
        variantes: { where: { actif: true }, select: { stock: true } },
        fournisseur: { select: { nom: true, delaiLivraison: true } },
      },
    }),
    prisma.ligneCommande.groupBy({
      by: ["produitId"],
      where: { commande: { tenantId, createdAt: { gte: depuis }, statut: { not: "annulee" } } },
      _sum: { quantite: true },
    }),
    prisma.produitSource.findMany({ where: { tenantId, produitId: { not: null } }, select: { id: true, produitId: true, moq: true, logistique: true, fournisseurNom: true } }),
  ]);
  const vendu = new Map(ventes.map((v) => [v.produitId, v._sum.quantite ?? 0]));
  const source = new Map(sources.map((s) => [s.produitId!, s]));

  return produits.map((p): PrevisionStock => {
    const s = source.get(p.id);
    // Avec des variantes, le stock vendable est celui des variantes (lib/stock.ts).
    const stock = p.variantes.length ? p.variantes.reduce((t, v) => t + v.stock, 0) : p.stock;
    const ventes30j = vendu.get(p.id) ?? 0;
    const ventesParJour = ventes30j / FENETRE_JOURS;
    const delaiSource = (s?.logistique as { delaiJours?: number } | null)?.delaiJours;
    const delaiReappro = p.fournisseur?.delaiLivraison ?? delaiSource ?? DELAI_DEFAUT;
    const joursRestants = ventesParJour > 0 ? Math.floor(stock / ventesParJour) : null;
    const besoin = Math.ceil(ventesParJour * (delaiReappro + SECURITE_JOURS)) - stock;
    const moq = s?.moq ?? 1;
    return {
      produitId: p.id, nom: p.nom, image: p.images[0] ?? null, stock, ventes30j,
      ventesParJour: Math.round(ventesParJour * 10) / 10,
      joursRestants, delaiReappro, delaiConnu: !!(p.fournisseur || delaiSource),
      aCommander: besoin > 0 ? Math.max(moq, Math.ceil(besoin / moq) * moq) : 0,
      niveau: stock <= 0 ? "rupture"
        : joursRestants !== null && joursRestants <= delaiReappro ? "urgent"
        : joursRestants !== null && joursRestants <= delaiReappro + SECURITE_JOURS ? "a_surveiller" : "ok",
      fournisseur: p.fournisseur?.nom ?? s?.fournisseurNom ?? p.nomFournisseur ?? null,
      sourceId: s?.id ?? null,
    };
  }).sort((a, b) => (a.joursRestants ?? Infinity) - (b.joursRestants ?? Infinity));
}
