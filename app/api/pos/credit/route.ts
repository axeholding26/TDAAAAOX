// Crédit client (ardoises) de la boutique.
// GET   /api/pos/credit?clientId= — droits : gerer_credit ou vente_credit.
//   Réponse : { regles, peutGerer, peutEncaisser, boutique, modes (moyens de remboursement proposés),
//   caisse: { sessionOuverte, sessionObligatoire }, encours, enRetard, clients[] }
//   + avec clientId : { detail: { echeances, mouvements } }.
// PATCH /api/pos/credit — droit : gerer_credit. Corps partiel : { actif?, plafondDefaut?, echeanceJours? }.
//   Le plafond et le blocage d'UN client se règlent par PATCH /api/pos/clients/[id].
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerDroit, exigerUnDroit } from "@/lib/pos/droits";
import { journaliserAudit } from "@/lib/pos/audit";
import { enregistrerReglagesPos, lireReglagesPos, sessionObligatoire } from "@/lib/pos/flags";
import { MODES_PAIEMENT } from "@/lib/pos/paiements";
import { MODES_REMBOURSEMENT, echeancesCredit } from "@/lib/pos/credit";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "gerer_credit", "vente_credit");
  const clientId = new URL(req.url).searchParams.get("clientId")?.trim() || null;
  const [r, boutique, clients, total] = await Promise.all([
    lireReglagesPos(ctx.tenantId),
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { nomBoutique: true, devise: true, telephone: true } }),
    prisma.client.findMany({
      where: { tenantId: ctx.tenantId, OR: [{ creditUtilise: { gt: 0 } }, { creditPlafond: { gt: 0 } }, { creditBloque: true }] },
      select: { id: true, nom: true, telephone: true, creditPlafond: true, creditUtilise: true, creditBloque: true, creditEcheanceJours: true },
      orderBy: [{ creditUtilise: "desc" }, { nom: "asc" }], take: 300,
    }),
    prisma.client.aggregate({ where: { tenantId: ctx.tenantId, creditUtilise: { gt: 0 } }, _sum: { creditUtilise: true }, _count: { _all: true } }),
  ]);
  const echeances = await echeancesCredit(prisma, ctx.tenantId);
  const parClient = new Map<string, typeof echeances>();
  for (const e of echeances) parClient.set(e.clientId, [...(parClient.get(e.clientId) ?? []), e]);

  let detail = null;
  if (clientId && (await prisma.client.findFirst({ where: { id: clientId, tenantId: ctx.tenantId }, select: { id: true } }))) {
    const mouvements = await prisma.mouvementCredit.findMany({ where: { tenantId: ctx.tenantId, clientId }, orderBy: { createdAt: "desc" }, take: 50 });
    const siennes = parClient.get(clientId) ?? [];
    const numeros = new Map((await prisma.commande.findMany({
      where: { tenantId: ctx.tenantId, id: { in: [...siennes.map((e) => e.commandeId), ...mouvements.flatMap((m) => (m.commandeId ? [m.commandeId] : []))] } },
      select: { id: true, numero: true },
    })).map((c) => [c.id, c.numero]));
    detail = {
      echeances: siennes.map((e) => ({ commandeId: e.commandeId, numero: numeros.get(e.commandeId) ?? null, reste: e.reste, echeance: e.echeanceAt?.toISOString() ?? null, enRetard: e.enRetard, joursRetard: e.joursRetard })),
      mouvements: mouvements.map((m) => ({ id: m.id, type: m.type, montant: m.montant, soldeApres: m.soldeApres, vente: m.commandeId ? numeros.get(m.commandeId) ?? null : null, echeance: m.echeanceAt?.toISOString() ?? null, date: m.createdAt.toISOString() })),
    };
  }

  return {
    regles: r.reglages.credit,
    peutGerer: aDroit(ctx, "gerer_credit"),
    peutEncaisser: aDroit(ctx, "encaisser"),
    boutique: { nom: boutique.nomBoutique, telephone: boutique.telephone },
    modes: MODES_REMBOURSEMENT.filter((m) => r.reglages.paiements.modes.includes(m)).map((m) => MODES_PAIEMENT[m]),
    caisse: { sessionOuverte: !!ctx.sessionCaisseId, sessionObligatoire: sessionObligatoire(r) },
    encours: total._sum.creditUtilise ?? 0,
    debiteurs: total._count._all,
    enRetard: echeances.filter((e) => e.enRetard).reduce((s, e) => s + e.reste, 0),
    clients: clients.map((c) => {
      const siennes = parClient.get(c.id) ?? [];
      const retard = siennes.filter((e) => e.enRetard);
      return {
        id: c.id, nom: c.nom, telephone: c.telephone,
        plafond: c.creditPlafond, utilise: c.creditUtilise, disponible: Math.max(0, c.creditPlafond - c.creditUtilise),
        bloque: c.creditBloque, echeanceJours: c.creditEcheanceJours,
        enRetard: retard.reduce((s, e) => s + e.reste, 0), joursRetard: retard[0]?.joursRetard ?? 0,
        /** Vente à crédit refusée d'office tant que le retard n'est pas réglé. */
        bloqueAuto: retard.length > 0,
        prochaineEcheance: siennes[0]?.echeanceAt?.toISOString() ?? null,
      };
    }),
    detail,
  };
});

const schemaRegles = z.object({
  actif: z.boolean(),
  plafondDefaut: z.number().finite().min(0).max(1e12),
  echeanceJours: z.number().int().min(1).max(365),
}).partial().refine((d) => Object.keys(d).length > 0, "Aucune modification envoyée.");

export const PATCH = routePos(async (ctx, req) => {
  exigerDroit(ctx, "gerer_credit");
  const modif = schemaRegles.parse(await req.json());
  const regles = await prisma.$transaction(async (tx) => {
    const { avant, apres } = await enregistrerReglagesPos(ctx.tenantId, { reglages: { credit: modif } }, tx);
    await journaliserAudit(tx, ctx, { action: "credit.regles_modifiees", entite: "ReglagesPos", entiteId: ctx.tenantId, avant: avant.reglages.credit, apres: apres.reglages.credit });
    return apres.reglages.credit;
  });
  return { ok: true, regles };
});
