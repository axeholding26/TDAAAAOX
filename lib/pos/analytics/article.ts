// Analyse d'un article au scan (§44) : tendance des ventes, jours de stock,
// délai fournisseur, réapprovisionnement recommandé et quantité suggérée.
// Tout est CALCULÉ ici, par des règles simples et lisibles — jamais par le
// modèle de langage — et présenté comme une ESTIMATION.
//
// Règles (les mêmes que lib/sourcing/stocks.ts, pour qu'AXIA, la page Achats
// et le scan disent la même chose) :
// - rythme        = unités vendues sur 30 jours ÷ 30 (tous canaux, retours déduits) ;
// - tendance      = 7 derniers jours comparés aux 7 jours d'avant ;
// - jours de stock = stock ÷ rythme ;
// - réappro recommandé quand les jours de stock ≤ délai fournisseur + 14 jours de sécurité ;
// - quantité suggérée = rythme × (délai + 14) − stock, arrondie au minimum de commande.
import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { ErreurPos } from "../erreurs";

export const SECURITE_JOURS = 14;
export const DELAI_DEFAUT_JOURS = 15; // hypothèse quand le fournisseur n'a pas annoncé de délai

export type DonneesArticle = {
  /** Unités vendues (retours déduits) : 7 derniers jours, 7 jours précédents, 30 derniers jours. */
  ventes7: number; ventes7Precedents: number; ventes30: number;
  stock: number;
  delaiJours: number;
  /** false = délai par défaut, aucun fournisseur renseigné. */
  delaiConnu: boolean;
  moq: number;
};

export type AnalyseArticle = {
  estimation: true;
  ventes7: number; ventes7Precedents: number; ventes30: number;
  /** Variation en % des 7 derniers jours sur les 7 précédents ; null s'il n'y avait aucune vente avant. */
  tendancePct: number | null;
  ventesParJour: number;
  stock: number;
  /** null = aucune vente sur 30 jours : pas de rythme, donc pas de prévision. */
  joursDeStock: number | null;
  delaiJours: number; delaiConnu: boolean;
  niveau: "rupture" | "urgent" | "a_surveiller" | "ok" | "sans_vente";
  reapproRecommande: boolean;
  quantiteSuggeree: number;
  /** Comment les chiffres ont été obtenus, en une phrase. */
  methode: string;
};

/** PURE. */
export function analyserArticle(d: DonneesArticle): AnalyseArticle {
  const ventesParJour = d.ventes30 / 30;
  const joursDeStock = ventesParJour > 0 ? Math.floor(Math.max(d.stock, 0) / ventesParJour) : null;
  const horizon = d.delaiJours + SECURITE_JOURS;
  const besoin = Math.ceil(ventesParJour * horizon) - Math.max(d.stock, 0);
  const moq = Math.max(1, Math.floor(d.moq) || 1);
  const niveau: AnalyseArticle["niveau"] =
    d.stock <= 0 ? "rupture"
    : joursDeStock === null ? "sans_vente"
    : joursDeStock <= d.delaiJours ? "urgent"
    : joursDeStock <= horizon ? "a_surveiller" : "ok";
  return {
    estimation: true,
    ventes7: d.ventes7, ventes7Precedents: d.ventes7Precedents, ventes30: d.ventes30,
    tendancePct: d.ventes7Precedents > 0 ? Math.round(((d.ventes7 - d.ventes7Precedents) / d.ventes7Precedents) * 100) : null,
    ventesParJour: Math.round(ventesParJour * 10) / 10,
    stock: d.stock, joursDeStock, delaiJours: d.delaiJours, delaiConnu: d.delaiConnu, niveau,
    // Sans vente sur 30 jours, on ne recommande rien : commander « au cas où » un article qui ne part pas serait un mauvais conseil.
    reapproRecommande: besoin > 0 && ventesParJour > 0,
    quantiteSuggeree: besoin > 0 && ventesParJour > 0 ? Math.ceil(besoin / moq) * moq : 0,
    methode: `Rythme moyen des 30 derniers jours, délai fournisseur de ${d.delaiJours} jours${d.delaiConnu ? "" : " (valeur par défaut, aucun fournisseur renseigné)"} et ${SECURITE_JOURS} jours de sécurité.`,
  };
}

/** Analyse d'un produit de la boutique (ou d'une de ses variantes). Quantités en unités de vente (kilos pour un produit au poids). */
export async function analyseArticle(tenantId: string, produitId: string, varianteId?: string | null): Promise<AnalyseArticle & { produitId: string; varianteId: string | null; nom: string; unite: string; fournisseur: string | null }> {
  const produit = await prisma.produit.findFirst({
    where: { id: produitId, tenantId },
    select: {
      id: true, nom: true, stock: true, uniteVente: true,
      variantes: { where: { actif: true }, select: { id: true, stock: true, nom: true, valeur: true } },
      fournisseur: { select: { nom: true, delaiLivraison: true } },
      offresFournisseurs: { where: { tenantId, principal: true }, take: 1, select: { moq: true, delaiProduction: true, fournisseur: { select: { nom: true, delaiLivraison: true } } } },
    },
  });
  if (!produit) throw new ErreurPos("introuvable", 404, "Ce produit est introuvable dans cette boutique.");
  const variante = varianteId ? produit.variantes.find((v) => v.id === varianteId) : null;
  if (varianteId && !variante) throw new ErreurPos("introuvable", 404, "Cette variante est introuvable pour ce produit.");

  const j = (n: number) => new Date(Date.now() - n * 86_400_000);
  const [v] = await prisma.$queryRaw<{ v7: number | null; v7p: number | null; v30: number | null }[]>(Prisma.sql`
    SELECT
      SUM(lc."quantite" - lc."quantiteRetournee") FILTER (WHERE c."createdAt" >= ${j(7)}) AS v7,
      SUM(lc."quantite" - lc."quantiteRetournee") FILTER (WHERE c."createdAt" >= ${j(14)} AND c."createdAt" < ${j(7)}) AS v7p,
      SUM(lc."quantite" - lc."quantiteRetournee") AS v30
    FROM "LigneCommande" lc JOIN "Commande" c ON c."id" = lc."commandeId"
    WHERE c."tenantId" = ${tenantId} AND c."statut" <> 'annulee' AND c."createdAt" >= ${j(30)} AND lc."produitId" = ${produitId}
      ${variante ? Prisma.sql`AND lc."varianteId" = ${variante.id}` : Prisma.empty}`);

  // Produit au poids : stock et quantités sont en grammes, on parle en kilos.
  const div = produit.uniteVente === "kg" ? 1000 : 1;
  const principal = produit.offresFournisseurs[0];
  const fournisseur = principal?.fournisseur ?? produit.fournisseur;
  const stock = variante ? variante.stock : produit.variantes.length ? produit.variantes.reduce((s, x) => s + x.stock, 0) : produit.stock;
  const analyse = analyserArticle({
    ventes7: Number(v?.v7 ?? 0) / div, ventes7Precedents: Number(v?.v7p ?? 0) / div, ventes30: Number(v?.v30 ?? 0) / div,
    stock: stock / div,
    delaiJours: fournisseur?.delaiLivraison != null ? fournisseur.delaiLivraison + (principal?.delaiProduction ?? 0) : DELAI_DEFAUT_JOURS,
    delaiConnu: fournisseur?.delaiLivraison != null, moq: principal?.moq ?? 1,
  });
  return {
    ...analyse, produitId: produit.id, varianteId: variante?.id ?? null,
    nom: variante ? `${produit.nom} — ${variante.nom}: ${variante.valeur}` : produit.nom,
    unite: produit.uniteVente === "kg" ? "kg" : "unité", fournisseur: fournisseur?.nom ?? null,
  };
}
