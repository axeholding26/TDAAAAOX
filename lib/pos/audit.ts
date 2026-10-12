// Journal d'audit de la caisse (table JournalAudit) — ajout seul. SERVEUR uniquement.
//
// Chaque ligne porte le hachage SHA-256 de son contenu ET du hachage de la
// ligne précédente de la boutique : modifier ou supprimer une ligne casse la
// chaîne à partir d'elle (verifierChaineAudit). Un trigger SQL (migration
// pos_v2, à poser à la main en production) refuse en plus UPDATE et DELETE.
// Limite assumée : un administrateur de la base peut retirer le trigger et
// réécrire toute la chaîne ; la protection vaut contre l'application et les
// accès ordinaires, pas contre le propriétaire de la base.
//
// `journaliserAudit` s'appelle DANS la transaction du fait tracé : la vente et
// sa trace sont écrites ensemble ou pas du tout.
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { ContextePos } from "./types";

type Tx = Prisma.TransactionClient;

/**
 * Verrou de boutique, tenu jusqu'à la fin de la transaction : met en file les
 * écritures du journal et du bus d'événements d'une même boutique, pour que
 * leur ordre (`seq`) soit celui des validations — chaîne sans fourche, flux
 * sans événement « sauté » par un lecteur.
 * ponytail: un verrou par boutique sérialise la fin de ses transactions de
 * caisse (quelques ms chacune) ; passer à un verrou par caisse + une chaîne par
 * caisse si une boutique dépasse la dizaine de ventes par seconde.
 */
export async function verrouBoutique(tx: Tx, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"pos:" + tenantId}))`;
}

/** JSON à clés triées : la base (JSONB) ne conserve pas l'ordre des clés, le hachage ne doit pas en dépendre. */
function canonique(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonique(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

type ChampsHaches = {
  tenantId: string; action: string; entite: string; entiteId: string | null; userId: string | null;
  avant: unknown; apres: unknown; motif: string | null; createdAt: Date; hashPrecedent: string | null;
};

export function hacherEntree(e: ChampsHaches): string {
  return createHash("sha256")
    .update(canonique([e.hashPrecedent, e.tenantId, e.action, e.entite, e.entiteId, e.userId, e.avant ?? null, e.apres ?? null, e.motif, e.createdAt.toISOString()]))
    .digest("hex");
}

/** Dates, undefined, BigInt… → JSON simple, identique avant et après passage par la base. */
const enJson = (v: unknown): Prisma.InputJsonValue | undefined =>
  v === undefined || v === null ? undefined : JSON.parse(JSON.stringify(v, (_c, x) => (typeof x === "bigint" ? x.toString() : x)));

export type EntreeAudit = {
  /** « vente.creee », « caisse.fermee », « stock.ajuste »… (domaine.fait) */
  action: string;
  /** Modèle concerné : Commande, SessionCaisse, Produit… */
  entite: string;
  entiteId?: string | null;
  avant?: unknown;
  apres?: unknown;
  motif?: string | null;
};

/** Écrit une ligne d'audit chaînée, dans la transaction du fait qu'elle trace. */
export async function journaliserAudit(tx: Tx, ctx: Pick<ContextePos, "tenantId"> & Partial<ContextePos>, e: EntreeAudit): Promise<void> {
  await verrouBoutique(tx, ctx.tenantId);
  const precedente = await tx.journalAudit.findFirst({ where: { tenantId: ctx.tenantId }, orderBy: { seq: "desc" }, select: { hash: true } });
  const champs: ChampsHaches = {
    tenantId: ctx.tenantId, action: e.action, entite: e.entite, entiteId: e.entiteId ?? null, userId: ctx.userId ?? null,
    avant: enJson(e.avant) ?? null, apres: enJson(e.apres) ?? null, motif: e.motif ?? null,
    createdAt: new Date(), hashPrecedent: precedente?.hash ?? null,
  };
  await tx.journalAudit.create({
    data: {
      tenantId: champs.tenantId, action: champs.action, entite: champs.entite, entiteId: champs.entiteId,
      userId: champs.userId, userNom: ctx.userNom ?? null,
      magasinId: ctx.magasinId ?? null, caisseId: ctx.caisseId ?? null, appareilId: ctx.appareilId ?? null,
      sessionCaisseId: ctx.sessionCaisseId ?? null, ip: ctx.ip ?? null,
      avant: enJson(e.avant), apres: enJson(e.apres), motif: champs.motif,
      createdAt: champs.createdAt, hashPrecedent: champs.hashPrecedent, hash: hacherEntree(champs),
    },
  });
}

/**
 * Relit la chaîne d'une boutique, de la plus ancienne ligne à la plus récente.
 * `rupture` = `seq` de la première ligne dont le contenu ou le chaînage ne
 * correspond plus (ligne modifiée, ou ligne précédente supprimée).
 */
export async function verifierChaineAudit(tenantId: string, p: { apresSeq?: number; limite?: number } = {}): Promise<{ valide: boolean; verifiees: number; rupture: number | null; dernierSeq: number | null }> {
  const lignes = await prisma.journalAudit.findMany({
    where: { tenantId, ...(p.apresSeq !== undefined ? { seq: { gte: p.apresSeq } } : {}) },
    orderBy: { seq: "asc" }, take: Math.min(p.limite ?? 2000, 10000),
  });
  let precedent: string | null | undefined; // undefined = première ligne lue : son chaînage amont n'est pas vérifiable ici
  for (const l of lignes) {
    const attendu = hacherEntree({ ...l, hashPrecedent: l.hashPrecedent });
    if (attendu !== l.hash || (precedent !== undefined && l.hashPrecedent !== precedent)) {
      return { valide: false, verifiees: lignes.indexOf(l), rupture: l.seq, dernierSeq: l.seq };
    }
    precedent = l.hash;
  }
  return { valide: true, verifiees: lignes.length, rupture: null, dernierSeq: lignes.at(-1)?.seq ?? null };
}
