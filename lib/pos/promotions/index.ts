// Moteur de promotions de la caisse — FICHIER AMORCÉ par les fondations,
// propriété du lot « Clients, promotions, fidélité, crédit ».
//
// Les SIGNATURES ci-dessous sont figées : lib/pos/tarification.ts appelle
// `appliquerPromotions` et lib/pos/vente.ts appelle `promotionsActives` puis
// `compterUtilisations`. Le lot propriétaire en écrit le corps (types de
// promotion, cumul, priorités) sans changer ces signatures.
//
// CLIENT-SAFE : `appliquerPromotions` est pure (l'écran de caisse l'exécute pour
// afficher le panier) ; les fonctions qui lisent la base reçoivent leur client
// Prisma en paramètre — ce fichier n'importe jamais ../prisma.
//
// Le calcul, le format de `Promotion.regles` et les règles de cumul sont dans
// ./moteur.ts ; la validation des règles à l'enregistrement dans ./schema.ts.
import type { Prisma, PrismaClient } from "@prisma/client";
import { expliquerPromotions } from "./moteur";

export { expliquerPromotions, TYPES_PROMOTION, type TypePromotion, type DecisionPromotion, type ExplicationPromotions } from "./moteur";

type Db = Prisma.TransactionClient | PrismaClient;

/** Promotion telle que le calcul du panier la reçoit (ligne Promotion, dates en ISO). */
export type PromotionActive = {
  id: string;
  nom: string;
  /** pourcentage | montant_fixe | x_pour_y | lot | achete_x_obtiens_y | seuil_panier | produit_offert | prix_membre | prix_grossiste */
  type: string;
  valeur: number | null;
  regles: Record<string, unknown>;
  cumulable: boolean;
  priorite: number;
  codePromoId: string | null;
};

/** Ligne vue par le moteur : montant net après la remise saisie sur la ligne. */
export type LignePromotion = {
  index: number;
  produitId: string;
  varianteId: string | null;
  categorie: string | null;
  /** Pièces, ou grammes pour un produit au poids. */
  quantite: number;
  /** Prix retenu, à la pièce ou au kilo. */
  prixApplique: number;
  net: number;
  offert: boolean;
};

export type ContextePromotion = {
  client?: { id: string; segment?: string | null; niveauFidelite?: string | null } | null;
  magasinId?: string | null;
  /** Arrondi de la devise (0 pour XAF/XOF, 2 sinon). */
  decimales: number;
  /**
   * Codes promo saisis à la caisse (CodePromo.id). Une promotion liée à un coupon
   * (`codePromoId`) ne s'applique que si son code figure ici. Facultatif : absent,
   * les promotions à coupon sont écartées.
   */
  codePromoIds?: string[];
};

/** Remise accordée par une promotion sur une ligne (`index` = position dans le panier). */
export type ReductionPromotion = { index: number; promotionId: string; nom: string; montant: number };

/**
 * Remises des promotions sur un panier. PURE, sans accès base.
 * Contrat : au plus une réduction par ligne, jamais supérieure au `net` de la
 * ligne ; les lignes offertes ne reçoivent rien.
 * Types, format des règles et cumul : voir ./moteur.ts (`expliquerPromotions`
 * rend en plus la décision prise pour chaque promotion).
 */
export function appliquerPromotions(lignes: LignePromotion[], promotions: PromotionActive[], contexte: ContextePromotion): ReductionPromotion[] {
  return expliquerPromotions(lignes, promotions, contexte).reductions;
}

/** Promotions en vigueur pour une boutique (actives, dans leurs dates, valables dans le magasin), les plus prioritaires d'abord. */
export async function promotionsActives(db: Db, tenantId: string, p: { magasinId?: string | null; date?: Date } = {}): Promise<PromotionActive[]> {
  const date = p.date ?? new Date();
  const lignes = await db.promotion.findMany({
    where: {
      tenantId, actif: true,
      AND: [
        { OR: [{ dateDebut: null }, { dateDebut: { lte: date } }] },
        { OR: [{ dateFin: null }, { dateFin: { gte: date } }] },
      ],
    },
    orderBy: [{ priorite: "desc" }, { createdAt: "asc" }],
  });
  return lignes
    .filter((l) => !l.magasinIds.length || !p.magasinId || l.magasinIds.includes(p.magasinId))
    .map((l) => ({
      id: l.id, nom: l.nom, type: l.type, valeur: l.valeur, regles: (l.regles ?? {}) as Record<string, unknown>,
      cumulable: l.cumulable, priorite: l.priorite, codePromoId: l.codePromoId,
    }));
}

/** +1 (vente) ou −1 (annulation) sur le compteur des promotions utilisées par une vente. */
export async function compterUtilisations(tx: Prisma.TransactionClient, tenantId: string, promotionIds: string[], sens: 1 | -1 = 1): Promise<void> {
  const ids = [...new Set(promotionIds)];
  if (ids.length) await tx.promotion.updateMany({ where: { tenantId, id: { in: ids } }, data: { utilisations: { increment: sens } } });
}
