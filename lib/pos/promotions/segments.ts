// Segments de clients — ce que ciblent les promotions (regles.segments) et ce
// qu'affiche la fiche client. CLIENT-SAFE : aucun import de ../prisma (la
// lecture des derniers achats reçoit son client Prisma en paramètre).
//
// Client.segment = choix FAIT À LA MAIN (null = automatique). Le segment
// automatique se calcule à la lecture, avec une règle qu'on peut dire en une phrase :
//   inactif   : au moins un achat, mais aucun depuis 90 jours
//   fidele    : 10 achats ou plus
//   regulier  : 3 à 9 achats
//   nouveau   : moins de 3 achats
//   grossiste : jamais automatique — c'est un statut commercial, fixé à la main.
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = Prisma.TransactionClient | PrismaClient;

export const SEGMENTS = ["nouveau", "regulier", "fidele", "inactif", "grossiste"] as const;
export type Segment = (typeof SEGMENTS)[number];
export const LIBELLES_SEGMENT: Record<Segment, string> = { nouveau: "Nouveau", regulier: "Régulier", fidele: "Fidèle", inactif: "Inactif", grossiste: "Grossiste" };

export const JOURS_INACTIF = 90;
export const ACHATS_REGULIER = 3;
export const ACHATS_FIDELE = 10;

export type SegmentClient = { segment: Segment; manuel: boolean; raison: string };

/** Segment d'un client : celui fixé à la main, sinon celui que donnent ses achats. PURE. */
export function segmentClient(c: { segment?: string | null; totalCommandes: number }, dernierAchat: Date | string | null, maintenant = new Date()): SegmentClient {
  if (c.segment && (SEGMENTS as readonly string[]).includes(c.segment)) return { segment: c.segment as Segment, manuel: true, raison: "Fixé à la main sur la fiche du client." };
  const n = c.totalCommandes;
  const jours = dernierAchat ? Math.floor((maintenant.getTime() - new Date(dernierAchat).getTime()) / 86400_000) : null;
  if (n > 0 && jours !== null && jours > JOURS_INACTIF) return { segment: "inactif", manuel: false, raison: `Aucun achat depuis ${jours} jours.` };
  if (n >= ACHATS_FIDELE) return { segment: "fidele", manuel: false, raison: `${n} achats (${ACHATS_FIDELE} ou plus).` };
  if (n >= ACHATS_REGULIER) return { segment: "regulier", manuel: false, raison: `${n} achats (de ${ACHATS_REGULIER} à ${ACHATS_FIDELE - 1}).` };
  return { segment: "nouveau", manuel: false, raison: n ? `${n} achat(s) seulement.` : "Aucun achat enregistré." };
}

/** Date du dernier achat (commande non annulée) de chaque client demandé. */
export async function derniersAchats(db: Db, tenantId: string, clientIds: string[]): Promise<Map<string, Date>> {
  if (!clientIds.length) return new Map();
  const groupes = await db.commande.groupBy({
    by: ["clientId"], where: { tenantId, clientId: { in: clientIds }, statut: { not: "annulee" } }, _max: { createdAt: true },
  });
  return new Map(groupes.flatMap((g) => (g.clientId && g._max.createdAt ? [[g.clientId, g._max.createdAt] as const] : [])));
}
