import { prisma } from "./prisma";

export { XAF_TO, convertirDepuisXAF } from "./devise-convert";

const MAX_TENTATIVES = 3;

/**
 * Enregistre un échec de paiement pour un tenant.
 * Au bout de MAX_TENTATIVES échecs, suspend la boutique.
 */
export async function enregistrerEchecPaiement(tenantId: string): Promise<{
  tentatives: number;
  suspendu: boolean;
}> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { parametresPaiement: true, statut: true },
  });

  if (!tenant || tenant.statut === "suspended") {
    return { tentatives: MAX_TENTATIVES, suspendu: true };
  }

  const params = (tenant.parametresPaiement as any) || {};
  const tentatives = (params.tentativesEchouees ?? 0) + 1;
  const suspendu = tentatives >= MAX_TENTATIVES;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      parametresPaiement: {
        ...params,
        tentativesEchouees: tentatives,
        dernierEchecAt: new Date().toISOString(),
      },
      ...(suspendu ? { statut: "suspended" } : {}),
    },
  });

  return { tentatives, suspendu };
}

/**
 * Réinitialise le compteur d'échecs après un paiement réussi.
 */
export async function reinitialiserEchecsPaiement(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { parametresPaiement: true },
  });
  if (!tenant) return;
  const params = (tenant.parametresPaiement as any) || {};
  if (!params.tentativesEchouees) return;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      parametresPaiement: { ...params, tentativesEchouees: 0 },
    },
  });
}

