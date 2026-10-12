// Lecture et mise en forme d'un client pour la caisse — partagé par les routes
// /api/pos/clients. Fichier privé (préfixe « _ ») : ce n'est pas une route.
import type { Prisma } from "@prisma/client";
import { verrouBoutique } from "@/lib/pos/audit";
import { segmentClient } from "@/lib/pos/promotions/segments";

/** Préfixe du QR de la carte client : le QR contient « AXSO-CLIENT:<code> ». */
export const PREFIXE_QR = "AXSO-CLIENT:";

export const SELECTION_CLIENT = {
  id: true, nom: true, telephone: true, email: true, codeClient: true, segment: true, totalCommandes: true, totalDepense: true,
  pointsFidelite: true, niveauFidelite: true, creditPlafond: true, creditUtilise: true, creditBloque: true, creditEcheanceJours: true, createdAt: true,
} satisfies Prisma.ClientSelect;
export type ClientLu = Prisma.ClientGetPayload<{ select: typeof SELECTION_CLIENT }>;

/** Client tel que la caisse l'affiche : segment effectif (manuel ou calculé) et crédit disponible. */
export function resumeClient(c: ClientLu, dernierAchat: Date | null) {
  const s = segmentClient(c, dernierAchat);
  return {
    id: c.id, nom: c.nom, telephone: c.telephone, email: c.email, codeClient: c.codeClient,
    qr: c.codeClient ? PREFIXE_QR + c.codeClient : null,
    segment: s.segment, segmentManuel: s.manuel, segmentRaison: s.raison,
    totalCommandes: c.totalCommandes, totalDepense: c.totalDepense, dernierAchat: dernierAchat?.toISOString() ?? null,
    points: c.pointsFidelite, niveau: c.niveauFidelite,
    credit: { plafond: c.creditPlafond, utilise: c.creditUtilise, disponible: Math.max(0, c.creditPlafond - c.creditUtilise), bloque: c.creditBloque, echeanceJours: c.creditEcheanceJours },
    createdAt: c.createdAt.toISOString(),
  };
}
export type ResumeClient = ReturnType<typeof resumeClient>;

/**
 * Code client libre dans la boutique. La base n'impose pas l'unicité de
 * Client.codeClient : elle est tenue ici, sous le verrou de la boutique (deux
 * créations simultanées passent l'une après l'autre).
 */
export async function nouveauCodeClient(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  await verrouBoutique(tx, tenantId);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    const code = "C" + Array.from(crypto.getRandomValues(new Uint8Array(7)), (o) => alphabet[o % alphabet.length]).join("");
    if (!(await tx.client.findFirst({ where: { tenantId, codeClient: code }, select: { id: true } }))) return code;
  }
}

/** Le client « pos@local » de l'ancienne caisse n'est pas une personne : jamais proposé. */
export const HORS_CLIENT_FICTIF: Prisma.ClientWhereInput = { OR: [{ email: null }, { email: { not: "pos@local" } }] };
