// Système d'escrow (séquestre) — fonds bloqués 48h après livraison
import { prisma } from "@/lib/prisma";

const DELAI_LIBERATION_HEURES = 48;

export async function creerEscrow(
  commandeId: string,
  tenantId: string,
  montant: number
) {
  const releaseAt = new Date();
  releaseAt.setHours(releaseAt.getHours() + DELAI_LIBERATION_HEURES);

  return prisma.escrow.create({
    data: {
      commandeId,
      tenantId,
      montant,
      statut: "held",
      releaseAt,
    },
  });
}

// Libérer les fonds (client confirme réception ou délai expiré)
export async function libererEscrow(commandeId: string) {
  return prisma.escrow.update({
    where: { commandeId },
    data: {
      statut: "released",
      releasedAt: new Date(),
    },
  });
}

// Ouvrir un litige
export async function ouvrirLitige(commandeId: string, raison: string) {
  return prisma.escrow.update({
    where: { commandeId },
    data: {
      statut: "disputed",
      raisonLitige: raison,
    },
  });
}

// Vérifier et libérer automatiquement les escrows expirés
export async function libererEscrowsExpires() {
  const now = new Date();
  const escrowsExpires = await prisma.escrow.findMany({
    where: {
      statut: "held",
      releaseAt: { lte: now },
    },
  });

  for (const escrow of escrowsExpires) {
    await libererEscrow(escrow.commandeId);
  }

  return escrowsExpires.length;
}
