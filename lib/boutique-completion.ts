// Source unique de vérité pour savoir si une boutique a le minimum requis
// pour passer de "brouillon" à "active" (publiée, visible sur /{slug}).
// Utilisé par PATCH /api/tenants (garde-fou serveur) et par l'outil Axia
// publier_boutique — les deux doivent toujours s'accorder sur les mêmes critères.
import { prisma } from "@/lib/prisma";

export interface CriterePublication {
  cle: string;
  label: string;
  ok: boolean;
}

export interface EvaluationPublication {
  prete: boolean;
  criteres: CriterePublication[];
}

export async function evaluerPublication(tenantId: string): Promise<EvaluationPublication> {
  const [tenant, nbProduitsActifs] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nomBoutique: true, whatsapp: true, pays: true, description: true },
    }),
    prisma.produit.count({ where: { tenantId, actif: true } }),
  ]);

  const criteres: CriterePublication[] = [
    { cle: "nomBoutique", label: "Nom de la boutique", ok: !!tenant?.nomBoutique?.trim() },
    { cle: "whatsapp", label: "Numéro WhatsApp (reçoit les commandes)", ok: !!tenant?.whatsapp?.trim() },
    { cle: "pays", label: "Pays de la boutique", ok: !!tenant?.pays?.trim() },
    { cle: "description", label: "Description de la boutique", ok: !!tenant?.description?.trim() },
    { cle: "produits", label: "Au moins un produit actif", ok: nbProduitsActifs > 0 },
  ];

  return { prete: criteres.every(c => c.ok), criteres };
}
