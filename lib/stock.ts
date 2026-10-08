// Stock et compteur de ventes des produits — point de passage unique pour la
// vitrine, la caisse, l'annulation et les retours.
//
// Règles :
// - Seuls les produits physiques ont un stock suivi (digital = illimité,
//   dropshipping = stock chez le fournisseur).
// - Le stock sort à la création de la commande (paiement à la livraison) ou de
//   la vente en caisse, jamais en dessous de 0 : une rupture refuse la vente.
// - Il revient à l'annulation, ou au retour accepté de la marchandise.
// - Produit.ventes suit la même définition que le CA : il augmente quand le
//   paiement est acquis et redescend si la commande est remboursée.
import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export class RuptureStock extends Error {
  status = 409;
}

/** « Taille: XL » → { nom: "Taille", valeur: "XL" } (format des lignes de commande). */
function lireVariante(v: string) {
  const i = v.indexOf(": ");
  return i < 0 ? null : { nom: v.slice(0, i), valeur: v.slice(i + 2) };
}

/**
 * Sort du stock les lignes physiques d'une commande déjà créée (même transaction).
 * Lève RuptureStock si une quantité n'est pas disponible : la transaction entière
 * est alors annulée, la commande n'existe pas.
 */
export async function sortirStock(tx: Tx, p: { tenantId: string; commandeId: string; motif: string; creePar?: string | null }) {
  const lignes = await tx.ligneCommande.findMany({
    where: { commandeId: p.commandeId },
    include: { produit: { select: { type: true, nom: true } } },
  });
  for (const l of lignes) {
    if (l.produit.type !== "physique") continue;
    const v = l.variante ? lireVariante(l.variante) : null;
    const r = v
      ? await tx.variante.updateMany({
          where: { produitId: l.produitId, nom: v.nom, valeur: v.valeur, stock: { gte: l.quantite } },
          data: { stock: { decrement: l.quantite } },
        })
      : await tx.produit.updateMany({
          where: { id: l.produitId, stock: { gte: l.quantite } },
          data: { stock: { decrement: l.quantite } },
        });
    if (r.count === 0) throw new RuptureStock(`Stock insuffisant pour « ${l.produit.nom}${l.variante ? ` (${l.variante})` : ""} »`);

    const { stock: stockApres } = v
      ? (await tx.variante.findFirst({ where: { produitId: l.produitId, nom: v.nom, valeur: v.valeur }, select: { stock: true } }))!
      : (await tx.produit.findUnique({ where: { id: l.produitId }, select: { stock: true } }))!;

    // Traçabilité : consomme en FIFO le lot actif le plus ancien du produit, s'il y en a.
    const lot = await tx.lotTracabilite.findFirst({
      where: { tenantId: p.tenantId, produitId: l.produitId, statut: "actif", quantiteRestante: { gt: 0 } },
      orderBy: { dateReception: "asc" },
    });
    if (lot) {
      const reste = Math.max(0, lot.quantiteRestante - l.quantite);
      await tx.lotTracabilite.update({ where: { id: lot.id }, data: { quantiteRestante: reste, ...(reste === 0 ? { statut: "epuise" } : {}) } });
      await tx.ligneCommande.update({ where: { id: l.id }, data: { lotId: lot.id } });
    }

    await tx.stockMouvement.create({
      data: {
        tenantId: p.tenantId, produitId: l.produitId, type: "vente", quantite: l.quantite,
        stockAvant: stockApres + l.quantite, stockApres, motif: p.motif, lotId: lot?.id ?? null,
        commandeId: p.commandeId, creePar: p.creePar ?? null,
      },
    });
  }
}

/**
 * Remet en stock ce qu'une commande avait sorti (annulation, retour accepté).
 * Idempotent : ne rend jamais deux fois, et ne rend rien pour une commande
 * dont le stock n'était jamais sorti (digital, dropshipping, anciennes commandes).
 */
export async function rendreStock(tx: Tx, p: { commandeId: string; motif: string }) {
  const sorties = await tx.stockMouvement.findMany({ where: { commandeId: p.commandeId, type: { in: ["vente", "retour"] } } });
  if (!sorties.some((m) => m.type === "vente") || sorties.some((m) => m.type === "retour")) return;

  const lignes = await tx.ligneCommande.findMany({
    where: { commandeId: p.commandeId },
    include: { produit: { select: { type: true, tenantId: true } } },
  });
  for (const l of lignes) {
    if (l.produit.type !== "physique") continue;
    const v = l.variante ? lireVariante(l.variante) : null;
    if (v) {
      await tx.variante.updateMany({ where: { produitId: l.produitId, nom: v.nom, valeur: v.valeur }, data: { stock: { increment: l.quantite } } });
    } else {
      await tx.produit.update({ where: { id: l.produitId }, data: { stock: { increment: l.quantite } } });
    }
    if (l.lotId) {
      await tx.lotTracabilite.update({ where: { id: l.lotId }, data: { quantiteRestante: { increment: l.quantite }, statut: "actif" } });
    }
    const { stock: stockApres } = v
      ? (await tx.variante.findFirst({ where: { produitId: l.produitId, nom: v.nom, valeur: v.valeur }, select: { stock: true } })) ?? { stock: 0 }
      : (await tx.produit.findUnique({ where: { id: l.produitId }, select: { stock: true } }))!;
    await tx.stockMouvement.create({
      data: {
        tenantId: l.produit.tenantId, produitId: l.produitId, type: "retour", quantite: l.quantite,
        stockAvant: stockApres - l.quantite, stockApres, motif: p.motif, lotId: l.lotId, commandeId: p.commandeId,
      },
    });
  }
}

/** Compteur de ventes des produits : +1 au paiement acquis, -1 au remboursement. */
export async function compterVentes(tx: Tx, commandeId: string, sens: 1 | -1) {
  const lignes = await tx.ligneCommande.findMany({ where: { commandeId }, select: { produitId: true, quantite: true } });
  for (const l of lignes) {
    await tx.produit.update({ where: { id: l.produitId }, data: { ventes: { increment: sens * l.quantite } } });
  }
}
