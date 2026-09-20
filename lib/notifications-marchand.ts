import { prisma } from "@/lib/prisma";

export async function notifierMarchand(params: {
  tenantId: string;
  type: string;
  titre: string;
  message: string;
  lien?: string;
  commandeId?: string;
}) {
  try {
    await prisma.notificationMarchand.create({
      data: {
        tenantId: params.tenantId,
        type: params.type,
        titre: params.titre,
        message: params.message,
        lien: params.lien,
        commandeId: params.commandeId,
      },
    });
  } catch (err) {
    console.warn("[notifierMarchand] échec:", (err as any)?.message?.slice(0, 100));
  }
}
