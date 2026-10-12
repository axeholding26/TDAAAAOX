// Points de passage communs des routes /api/sourcing : session + boutique + palier,
// journal d'audit, contexte de calcul de la boutique. SERVEUR uniquement.
// (Les droits par rôle sont appliqués en amont par proxy.ts — lib/permissions-api.ts.)
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "../auth";
import { prisma } from "../prisma";
import { planActif } from "../abonnement";
import { aAcces, NOMS_PALIERS } from "../plans";
import { tauxDuJour } from "../taux-change";
import { codePays } from "../devise-convert";
import { configPays, estCodePays } from "./pays";
import type { ContexteCalcul, Reglages } from "./produit-source";

export type Acces = { tenantId: string; userId: string | null };

/** Le palier de la boutique ouvre-t-il AXSO Sourcing ? Le menu le cache déjà, mais seul le serveur fait foi. */
export async function sourcingInclus(tenantId: string): Promise<boolean> {
  return aAcces((await planActif(tenantId)).plan, "sourcing_mondial");
}

/** Session du marchand, ou la réponse 401 / 403 à renvoyer telle quelle. */
export async function accesSourcing(): Promise<Acces | NextResponse> {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!(await sourcingInclus(tenantId))) {
    return NextResponse.json({ error: `AXSO Sourcing est réservé au forfait ${NOMS_PALIERS.palier2} — passez à niveau pour y accéder.`, code: "quota_atteint" }, { status: 403 });
  }
  return { tenantId, userId: ((session!.user as any).id as string | undefined) ?? null };
}

export const erreur = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

/** Réponse d'erreur d'une exception : garde le statut des erreurs métier (501 connecteur non branché, 409…), masque le reste. */
export function reponseErreur(e: unknown) {
  const status = (e as any)?.status;
  if (typeof status === "number" && status >= 400 && status < 600) return erreur((e as Error).message, status);
  if ((e as any)?.name === "ZodError") return erreur("Données invalides : " + ((e as any).issues?.[0]?.path?.join(".") ?? "") + " " + ((e as any).issues?.[0]?.message ?? ""), 400);
  console.error("[sourcing]", e);
  return erreur("Erreur serveur", 500);
}

/** Journal d'audit — n'échoue jamais l'action qu'il trace. */
export async function journaliser(acces: Acces, action: string, cible?: string, details?: Prisma.InputJsonValue) {
  await prisma.journalSourcing.create({ data: { tenantId: acces.tenantId, userId: acces.userId, action, cible, details } })
    .catch((e) => console.warn("[journalSourcing]", e?.message));
}

/**
 * Taux de refus réel des commandes payées à la livraison (90 derniers jours) :
 * refusées = annulées après un départ en livraison. Null tant que moins de
 * 10 commandes sont arrivées au bout — en dessous, le chiffre ne veut rien dire.
 */
export async function tauxRefusReel(tenantId: string): Promise<{ taux: number | null; livrees: number; refusees: number }> {
  const depuis = new Date(Date.now() - 90 * 86400_000);
  const cod = { tenantId, createdAt: { gte: depuis }, methodePaiement: { contains: "cod" } };
  const [livrees, refusees] = await Promise.all([
    prisma.commande.count({ where: { ...cod, statut: "livree" } }),
    prisma.commande.count({ where: { ...cod, statut: "annulee", expedieeAt: { not: null } } }),
  ]);
  const total = livrees + refusees;
  return { taux: total >= 10 && refusees < total ? refusees / total : null, livrees, refusees };
}

/** Pays, devise, réglages, taux du jour et taux de refus réel de la boutique. */
export async function contexteCalcul(tenantId: string): Promise<ContexteCalcul> {
  const [tenant, ligne, taux, refus] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { pays: true, devise: true } }),
    prisma.reglagesSourcing.findUnique({ where: { tenantId } }),
    tauxDuJour(),
    tauxRefusReel(tenantId),
  ]);
  const reglages = (ligne?.reglages ?? {}) as Reglages;
  const pays = estCodePays(reglages.pays) ? reglages.pays : configPays(codePays(tenant?.pays)).code;
  return { pays, devise: tenant?.devise ?? configPays(pays).devise, reglages, taux, tauxRefusReel: refus.taux };
}
