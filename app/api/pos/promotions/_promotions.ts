// Mise en forme et contrôles partagés par les routes /api/pos/promotions.
// Fichier privé (préfixe « _ ») : ce n'est pas une route.
import type { Promotion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { erreurs } from "@/lib/pos/erreurs";
import type { DonneesPromotion } from "@/lib/pos/promotions/schema";
import type { ContextePos } from "@/lib/pos/types";

/** Où en est une promotion aujourd'hui : c'est ce que l'écran affiche. */
function etat(p: Promotion, maintenant = new Date()): "active" | "inactive" | "a_venir" | "terminee" {
  if (!p.actif) return "inactive";
  if (p.dateDebut && p.dateDebut > maintenant) return "a_venir";
  if (p.dateFin && p.dateFin < maintenant) return "terminee";
  return "active";
}

export function versReponse(p: Promotion) {
  return {
    id: p.id, nom: p.nom, type: p.type, valeur: p.valeur, regles: (p.regles ?? {}) as Record<string, unknown>,
    cumulable: p.cumulable, priorite: p.priorite, dateDebut: p.dateDebut?.toISOString() ?? null, dateFin: p.dateFin?.toISOString() ?? null,
    magasinIds: p.magasinIds, codePromoId: p.codePromoId, actif: p.actif, utilisations: p.utilisations, etat: etat(p), createdAt: p.createdAt.toISOString(),
  };
}

/** Les magasins et le code promo cités doivent appartenir à la boutique. */
export async function verifierReferences(ctx: ContextePos, d: Pick<DonneesPromotion, "magasinIds" | "codePromoId">) {
  if (d.magasinIds.length) {
    const connus = await prisma.magasin.count({ where: { tenantId: ctx.tenantId, id: { in: d.magasinIds } } });
    if (connus !== new Set(d.magasinIds).size) throw erreurs.invalide("Un des magasins choisis n'existe pas dans cette boutique.");
  }
  if (d.codePromoId && !(await prisma.codePromo.findFirst({ where: { id: d.codePromoId, tenantId: ctx.tenantId }, select: { id: true } }))) {
    throw erreurs.invalide("Ce code promo n'existe pas dans cette boutique.");
  }
}
