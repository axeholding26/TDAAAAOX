import { prisma } from "@/lib/prisma";

// Commandes d'une boutique passées avec ce numéro (clé cleTelephone), quel que soit
// le format saisi à la commande — la comparaison se fait sur les chiffres seuls.
export async function commandesParTelephone(tenantId: string, cle: string): Promise<{ id: string; clientTelephone: string; clientNom: string }[]> {
  if (cle.length < 9) return [];
  return prisma.$queryRaw`
    SELECT id, "clientTelephone", "clientNom" FROM "Commande"
    WHERE "tenantId" = ${tenantId} AND right(regexp_replace("clientTelephone", '[^0-9]', '', 'g'), 9) = ${cle}
    ORDER BY "createdAt" DESC LIMIT 200`;
}
