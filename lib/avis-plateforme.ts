// Avis des marchands sur Axso : éligibilité, validation, lecture publique.
// Règle (modèle Shopify App Store / Trustpilot) : un avis par boutique, déposé par
// son propriétaire après une vraie expérience (1re vente payée ou 14 jours d'usage),
// publié seulement après validation humaine et avec l'accord explicite du marchand.
import { z } from "zod";
import { prisma } from "./prisma";

export const DELAI_ELIGIBILITE_JOURS = 14;

export const schemaAvisPlateforme = z.object({
  note: z.number().int().min(1).max(5),
  texte: z.string().trim().min(30, "30 caractères minimum").max(600, "600 caractères maximum"),
  auteurNom: z.string().trim().min(2).max(60),
  auteurRole: z.string().trim().max(80).optional().transform((v) => v || undefined),
  ville: z.string().trim().max(60).optional().transform((v) => v || undefined),
  consentement: z.literal(true, { message: "Votre accord est nécessaire pour publier l'avis" }),
});

/** Une boutique peut donner son avis après sa 1re commande payée ou 14 jours d'existence. */
export async function eligibiliteAvis(tenantId: string): Promise<{ eligible: boolean; raison?: string }> {
  const [tenant, vente] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { createdAt: true } }),
    prisma.commande.findFirst({ where: { tenantId, paiementStatut: "completed" }, select: { id: true } }),
  ]);
  if (!tenant) return { eligible: false, raison: "Boutique introuvable" };
  if (vente || tenant.createdAt.getTime() <= Date.now() - DELAI_ELIGIBILITE_JOURS * 86_400_000) return { eligible: true };
  return { eligible: false, raison: `Disponible après votre première vente ou ${DELAI_ELIGIBILITE_JOURS} jours sur Axso` };
}

export interface AvisPublic { id: string; note: number; texte: string; auteurNom: string; auteurRole: string | null; ville: string | null; boutique: string; slug: string; pays: string }

/** Avis approuvés et consentis, pour la landing et /temoignages. Ne casse jamais la page. */
export async function avisPublies(limite = 12): Promise<AvisPublic[]> {
  try {
    const avis = await prisma.avisPlateforme.findMany({
      where: { statut: "approuve", consentement: true, tenant: { statut: "active" } },
      orderBy: [{ note: "desc" }, { modereLe: "desc" }],
      take: limite,
      select: { id: true, note: true, texte: true, auteurNom: true, auteurRole: true, ville: true, tenant: { select: { nomBoutique: true, slug: true, pays: true } } },
    });
    return avis.map(({ tenant, ...a }) => ({ ...a, boutique: tenant.nomBoutique, slug: tenant.slug, pays: tenant.pays }));
  } catch (e) {
    console.error("[avis-plateforme] lecture impossible", e);
    return [];
  }
}
