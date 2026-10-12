// Stock et compteur de ventes des produits — point de passage unique pour la
// vitrine, la caisse, l'annulation et les retours.
//
// Règles :
// - Seuls les produits physiques ont un stock suivi (digital = illimité,
//   dropshipping = stock chez le fournisseur).
// - Toute écriture de stock passe par mouvementStock (lib/pos/stock.ts), qui tient
//   ensemble le total de l'article et sa ventilation par entrepôt.
// - Le stock sort à la création de la commande (paiement à la livraison) ou de
//   la vente en caisse, jamais en dessous de 0 : une rupture refuse la vente.
// - Il revient à l'annulation, ou au retour accepté de la marchandise.
// - Produit.ventes suit la même définition que le CA : il augmente quand le
//   paiement est acquis et redescend si la commande est remboursée.
import type { Prisma } from "@prisma/client";
import { mouvementStock, resoudreLieu } from "./pos/stock";

type Tx = Prisma.TransactionClient;

export class RuptureStock extends Error {
  status = 409;
}

/** « Taille: XL » → { nom: "Taille", valeur: "XL" } (format des lignes de commande). */
function lireVariante(v: string) {
  const i = v.indexOf(": ");
  return i < 0 ? null : { nom: v.slice(0, i), valeur: v.slice(i + 2) };
}

type LigneVariante = { produitId: string; varianteId: string | null; variante: string | null };

/**
 * Variante d'une ligne : son identifiant (lignes de la caisse 2.0), sinon
 * retrouvée par son libellé « Nom: Valeur » (lignes de la vitrine).
 * `undefined` = la ligne nomme une variante qui n'existe plus.
 */
async function varianteDeLigne(tx: Tx, l: LigneVariante): Promise<string | null | undefined> {
  if (l.varianteId) return l.varianteId;
  const v = l.variante ? lireVariante(l.variante) : null;
  if (!v) return null;
  return (await tx.variante.findFirst({ where: { produitId: l.produitId, nom: v.nom, valeur: v.valeur }, select: { id: true } }))?.id;
}

/**
 * Sort du stock les lignes physiques d'une commande déjà créée (même transaction).
 * Lève RuptureStock si une quantité n'est pas disponible : la transaction entière
 * est alors annulée, la commande n'existe pas.
 *
 * Tout passe par mouvementStock (lib/pos/stock.ts) : total de l'article,
 * ventilation par entrepôt, lots en FEFO (expiration la plus proche d'abord,
 * lots périmés ou bloqués exclus), journal.
 * - `entrepotId` : lieu d'où sort la marchandise (l'entrepôt du magasin pour une
 *   vente en caisse). Absent — la vitrine — : l'entrepôt principal.
 * - `varianteId` : ne traite que les lignes de cette variante (la variante de
 *   chaque ligne vient de la ligne elle-même, LigneCommande.varianteId).
 * - `autoriserNegatif` : laisse passer sous zéro au lieu de refuser (vente hors
 *   ligne rejouée). Jamais utilisé par la vitrine.
 */
export async function sortirStock(tx: Tx, p: { tenantId: string; commandeId: string; motif: string; creePar?: string | null; entrepotId?: string | null; varianteId?: string | null; autoriserNegatif?: boolean }) {
  const lignes = await tx.ligneCommande.findMany({
    where: { commandeId: p.commandeId },
    include: { produit: { select: { type: true, nom: true } } },
  });
  const lieu = await resoudreLieu(tx, p.tenantId, p.entrepotId);
  for (const l of lignes) {
    if (l.produit.type !== "physique") continue;
    const libelle = `Stock insuffisant pour « ${l.produit.nom}${l.variante ? ` (${l.variante})` : ""} »`;
    const varianteId = await varianteDeLigne(tx, l);
    if (varianteId === undefined) throw new RuptureStock(libelle);
    if (p.varianteId && varianteId !== p.varianteId) continue;

    let r;
    try {
      r = await mouvementStock(tx, {
        tenantId: p.tenantId, produitId: l.produitId, varianteId, type: "vente", quantite: l.quantite, lieu,
        motif: p.motif, refs: { commandeId: p.commandeId }, creePar: p.creePar, autoriserNegatif: p.autoriserNegatif,
      });
    } catch (e) {
      // Même erreur qu'avant pour les appelants existants (vitrine, ancienne caisse) ; le détail par magasin est gardé.
      if ((e as any)?.code === "stock_insuffisant") throw new RuptureStock((e as any).details?.disponibleIci !== undefined ? (e as Error).message.replace(/\.$/, "") : libelle);
      throw e;
    }
    // Traçabilité : la ligne garde le premier lot entamé (le détail par lot est dans StockMouvement).
    if (r.lots[0] || (varianteId && !l.varianteId)) {
      await tx.ligneCommande.update({ where: { id: l.id }, data: { ...(r.lots[0] ? { lotId: r.lots[0].lotId } : {}), ...(varianteId && !l.varianteId ? { varianteId } : {}) } });
    }
  }
}

/**
 * Remet en stock ce qu'une commande avait sorti (annulation, retour accepté).
 * Idempotent : ne rend jamais deux fois, et ne rend rien pour une commande
 * dont le stock n'était jamais sorti (digital, dropshipping, anciennes commandes).
 *
 * Ce qui reste à rendre se lit dans le journal : quantités sorties (« vente »)
 * moins quantités déjà revenues (« retour », y compris les retours partiels de
 * la caisse) — et, par ligne, quantite − quantiteRetournee.
 * - `entrepotId` : lieu où la marchandise revient ; absent : celui d'où elle était sortie.
 * - `varianteId` : ne traite que les lignes de cette variante.
 */
export async function rendreStock(tx: Tx, p: { commandeId: string; motif: string; entrepotId?: string | null; varianteId?: string | null }) {
  const mouvements = await tx.stockMouvement.findMany({ where: { commandeId: p.commandeId, type: { in: ["vente", "retour"] } } });
  const sorties = mouvements.filter((m) => m.type === "vente");
  if (!sorties.length) return;

  const lignes = await tx.ligneCommande.findMany({
    where: { commandeId: p.commandeId },
    include: { produit: { select: { type: true, tenantId: true } } },
  });
  // Reste à rendre par produit, puis par lot de ce produit.
  const reste = new Map<string, number>();
  const resteLot = new Map<string, number>();
  for (const m of mouvements) {
    const signe = m.type === "vente" ? 1 : -1;
    reste.set(m.produitId, (reste.get(m.produitId) ?? 0) + signe * m.quantite);
    if (m.lotId) resteLot.set(m.lotId, (resteLot.get(m.lotId) ?? 0) + signe * m.quantite);
  }

  for (const l of lignes) {
    if (l.produit.type !== "physique") continue;
    const quantite = Math.min(l.quantite - l.quantiteRetournee, reste.get(l.produitId) ?? 0);
    if (quantite <= 0) continue;
    const varianteId = await varianteDeLigne(tx, l);
    if (varianteId === undefined) continue; // variante supprimée depuis : plus rien à recréditer
    if (p.varianteId && varianteId !== p.varianteId) continue;

    const origine = sorties.find((m) => m.produitId === l.produitId && (m.varianteId ?? null) === (l.varianteId ?? m.varianteId ?? null));
    const commun = {
      tenantId: l.produit.tenantId, produitId: l.produitId, varianteId, type: "retour" as const, motif: p.motif,
      entrepotId: p.entrepotId ?? origine?.entrepotId ?? null,
    };
    // D'abord vers les lots d'où la marchandise était sortie, puis le reste sans lot.
    let aRendre = quantite;
    for (const m of sorties) {
      if (aRendre <= 0) break;
      if (m.produitId !== l.produitId || !m.lotId) continue;
      const q = Math.min(aRendre, resteLot.get(m.lotId) ?? 0);
      if (q <= 0) continue;
      await mouvementStock(tx, { ...commun, quantite: q, refs: { commandeId: p.commandeId, lotId: m.lotId } });
      resteLot.set(m.lotId, (resteLot.get(m.lotId) ?? 0) - q);
      aRendre -= q;
    }
    if (aRendre > 0) await mouvementStock(tx, { ...commun, quantite: aRendre, refs: { commandeId: p.commandeId } });

    reste.set(l.produitId, (reste.get(l.produitId) ?? 0) - quantite);
    await tx.ligneCommande.update({ where: { id: l.id }, data: { quantiteRetournee: { increment: quantite } } });
  }
}

/** Compteur de ventes des produits : +1 au paiement acquis, -1 au remboursement. */
export async function compterVentes(tx: Tx, commandeId: string, sens: 1 | -1) {
  const lignes = await tx.ligneCommande.findMany({ where: { commandeId }, select: { produitId: true, quantite: true } });
  for (const l of lignes) {
    await tx.produit.update({ where: { id: l.produitId }, data: { ventes: { increment: sens * l.quantite } } });
  }
}
