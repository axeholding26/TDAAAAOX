// Bus temps réel de la caisse : une table d'événements (EvenementPos) lue par
// curseur. SERVEUR uniquement.
//
// - Écriture : `publierEvenement(tx, …)` DANS la transaction du fait métier
//   (scan, vente, ouverture de caisse) : pas d'événement sans le fait, pas de
//   fait sans son événement.
// - Lecture : `lireEvenements({ apresSeq })` rend ce qui suit le curseur. Le
//   flux SSE (/api/pos/flux, lot scanner) boucle dessus ; `EventSource` renvoie
//   le dernier `seq` reçu à la reconnexion : ni perte ni doublon.
// - `seq` est un BigInt : il voyage en CHAÎNE dans le JSON.
// - L'écriture prend le verrou de boutique (audit.ts) : les `seq` d'une
//   boutique sont validés dans l'ordre, un lecteur ne peut pas dépasser un
//   événement encore en cours d'écriture.
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { verrouBoutique } from "./audit";
import type { EvenementPosLu, TypeEvenementPos } from "./types";

type Tx = Prisma.TransactionClient;

export type NouvelEvenement = {
  tenantId: string;
  magasinId?: string | null;
  /** null = événement de toute la boutique (stock, alerte) : reçu par toutes ses caisses. */
  caisseId?: string | null;
  type: TypeEvenementPos;
  payload: Record<string, unknown>;
};

/** Publie un événement dans la transaction en cours. Rend son `seq` (chaîne). */
export async function publierEvenement(tx: Tx, e: NouvelEvenement): Promise<{ seq: string }> {
  await verrouBoutique(tx, e.tenantId);
  const cree = await tx.evenementPos.create({
    data: {
      tenantId: e.tenantId, magasinId: e.magasinId ?? null, caisseId: e.caisseId ?? null, type: e.type,
      payload: JSON.parse(JSON.stringify(e.payload, (_c, v) => (typeof v === "bigint" ? v.toString() : v))) as Prisma.InputJsonValue,
    },
    select: { seq: true },
  });
  return { seq: cree.seq.toString() };
}

/**
 * Événements d'une boutique après le curseur, du plus ancien au plus récent.
 * Avec `caisseId` : ceux de cette caisse ET ceux de toute la boutique.
 */
export async function lireEvenements(p: { tenantId: string; caisseId?: string | null; apresSeq?: string | number | bigint | null; limite?: number }): Promise<EvenementPosLu[]> {
  let apres: bigint;
  try { apres = BigInt(p.apresSeq ?? 0); } catch { apres = BigInt(0); }
  const lignes = await prisma.evenementPos.findMany({
    where: {
      tenantId: p.tenantId, seq: { gt: apres },
      ...(p.caisseId ? { OR: [{ caisseId: p.caisseId }, { caisseId: null }] } : {}),
    },
    orderBy: { seq: "asc" },
    take: Math.min(Math.max(p.limite ?? 100, 1), 500),
  });
  return lignes.map((l) => ({
    seq: l.seq.toString(), type: l.type as TypeEvenementPos, magasinId: l.magasinId, caisseId: l.caisseId,
    payload: (l.payload ?? {}) as Record<string, unknown>, createdAt: l.createdAt.toISOString(),
  }));
}

/** Dernier `seq` de la boutique : point de départ d'un flux qui ne veut pas rejouer le passé. */
export async function dernierSeq(tenantId: string): Promise<string> {
  const d = await prisma.evenementPos.findFirst({ where: { tenantId }, orderBy: { seq: "desc" }, select: { seq: true } });
  return (d?.seq ?? BigInt(0)).toString();
}

/** Supprime les événements de plus de `heures` heures (tâche planifiée). Rend le nombre supprimé. */
export async function purgerEvenements(heures = 24): Promise<number> {
  const r = await prisma.evenementPos.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - heures * 3600_000) } } });
  return r.count;
}
