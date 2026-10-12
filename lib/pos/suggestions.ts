// Suggestions de la caisse : « qui achète X achète souvent Y ». SERVEUR uniquement.
//
// Ce n'est PAS une prédiction : c'est un comptage sur l'historique réel de la
// boutique. On prend les commandes non annulées des 180 derniers jours qui
// contiennent au moins un article du panier, et on compte dans combien d'entre
// elles chaque autre article apparaît. Une suggestion n'est rendue que si :
//   - le panier s'appuie sur au moins MIN_COMMANDES commandes passées ;
//   - l'article a été acheté avec lui dans au moins MIN_OCCURRENCES commandes ;
//   - l'article est actif et en stock dans le magasin.
// Pas assez d'historique = liste vide. Jamais de suggestion inventée.
import { prisma } from "../prisma";
import { entrepotDuMagasin } from "./magasins";
import { stocksDuLieu } from "./stock";
import { cleArticle, type UniteVente } from "./types";

export const MIN_COMMANDES = 5;
export const MIN_OCCURRENCES = 3;
const JOURS = 180;
// ponytail: les 2 000 commandes les plus récentes contenant le panier suffisent à un comptage ; au-delà, précalculer les paires.
const MAX_COMMANDES = 2000;

export type Suggestion = {
  produitId: string; nom: string; prix: number; image: string | null; uniteVente: UniteVente;
  /** L'article a des variantes : la caisse doit en faire choisir une. */
  aVariantes: boolean;
  /** Stock dans le magasin (somme des variantes le cas échéant). */
  stock: number;
  /** Nombre de commandes où il a été acheté avec un article du panier, sur `surCommandes`. */
  occurrences: number;
  surCommandes: number;
};

export async function suggestionsCoAchat(tenantId: string, produitIds: string[], o: { magasinId: string; limite?: number }): Promise<Suggestion[]> {
  const panier = [...new Set(produitIds)].slice(0, 50);
  if (!panier.length) return [];
  const depuis = new Date(Date.now() - JOURS * 86400_000);
  const commandes = await prisma.commande.findMany({
    where: { tenantId, statut: { not: "annulee" }, createdAt: { gte: depuis }, lignes: { some: { produitId: { in: panier } } } },
    select: { id: true }, orderBy: { createdAt: "desc" }, take: MAX_COMMANDES,
  });
  if (commandes.length < MIN_COMMANDES) return [];

  const lignes = await prisma.ligneCommande.findMany({
    where: { commandeId: { in: commandes.map((c) => c.id) }, produitId: { notIn: panier }, offert: false },
    select: { commandeId: true, produitId: true },
  });
  const vues = new Set<string>();
  const compte = new Map<string, number>();
  for (const l of lignes) {
    const paire = l.commandeId + ":" + l.produitId;
    if (vues.has(paire)) continue; // deux variantes du même article dans une commande = une occurrence
    vues.add(paire);
    compte.set(l.produitId, (compte.get(l.produitId) ?? 0) + 1);
  }
  const retenus = [...compte].filter(([, n]) => n >= MIN_OCCURRENCES).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 20);
  if (!retenus.length) return [];

  const [produits, entrepotId] = await Promise.all([
    prisma.produit.findMany({
      where: { tenantId, actif: true, type: "physique", id: { in: retenus.map(([id]) => id) } },
      select: { id: true, nom: true, prix: true, images: true, stock: true, uniteVente: true, variantes: { where: { actif: true }, select: { id: true, stock: true } } },
    }),
    entrepotDuMagasin(prisma, tenantId, o.magasinId),
  ]);
  const stocks = await stocksDuLieu(prisma, tenantId, entrepotId, produits.flatMap((p) =>
    p.variantes.length ? p.variantes.map((v) => ({ produitId: p.id, varianteId: v.id, stock: v.stock })) : [{ produitId: p.id, stock: p.stock }]));
  const parId = new Map(produits.map((p) => [p.id, p]));

  return retenus.flatMap(([id, occurrences]) => {
    const p = parId.get(id);
    if (!p) return [];
    const stock = p.variantes.length
      ? p.variantes.reduce((s, v) => s + Math.max(0, stocks.get(cleArticle(p.id, v.id)) ?? 0), 0)
      : stocks.get(cleArticle(p.id)) ?? 0;
    if (stock <= 0) return [];
    return [{
      produitId: p.id, nom: p.nom, prix: p.prix, image: p.images[0] ?? null, uniteVente: p.uniteVente === "kg" ? "kg" as const : "piece" as const,
      aVariantes: p.variantes.length > 0, stock, occurrences, surCommandes: commandes.length,
    }];
  }).slice(0, Math.min(Math.max(o.limite ?? 4, 1), 10));
}
