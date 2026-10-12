// Programme de fidélité de la boutique.
// GET   /api/pos/fidelite?clientId= — droits : gerer_fidelite ou gerer_clients.
//   Réponse : { regles, peutGerer, moteurPromotions, modeAvoirActif, niveaux (répartition),
//   classement (50 premiers), historique (50 derniers mouvements, ou ceux du client), avantages }.
//   `avantages` = promotions « prix_membre » : ce sont elles qui donnent une remise par niveau.
// PATCH /api/pos/fidelite — droit : gerer_fidelite. Corps partiel :
//   { active?, montantParPoint?, valeurPoint?, seuils?: { silver, gold, vip } }.
//   Changer les seuils recalcule le niveau des clients. Tracé dans le journal d'audit.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerDroit, exigerUnDroit } from "@/lib/pos/droits";
import { erreurs } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { enregistrerReglagesPos, lireReglagesPos } from "@/lib/pos/flags";
import { niveauPour } from "@/lib/pos/fidelite";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "gerer_fidelite", "gerer_clients");
  const clientId = new URL(req.url).searchParams.get("clientId")?.trim() || null;
  const [r, niveaux, classement, mouvements, avantages] = await Promise.all([
    lireReglagesPos(ctx.tenantId),
    prisma.client.groupBy({ by: ["niveauFidelite"], where: { tenantId: ctx.tenantId, pointsFidelite: { gt: 0 } }, _count: { _all: true } }),
    prisma.client.findMany({
      where: { tenantId: ctx.tenantId, pointsFidelite: { gt: 0 } }, orderBy: [{ pointsFidelite: "desc" }, { nom: "asc" }], take: 50,
      select: { id: true, nom: true, telephone: true, pointsFidelite: true, niveauFidelite: true, totalDepense: true },
    }),
    prisma.mouvementFidelite.findMany({ where: { tenantId: ctx.tenantId, ...(clientId ? { clientId } : {}) }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.promotion.findMany({ where: { tenantId: ctx.tenantId, type: "prix_membre" }, select: { id: true, nom: true, regles: true, actif: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const [noms, numeros] = await Promise.all([
    prisma.client.findMany({ where: { tenantId: ctx.tenantId, id: { in: [...new Set(mouvements.map((m) => m.clientId))] } }, select: { id: true, nom: true } }),
    prisma.commande.findMany({ where: { tenantId: ctx.tenantId, id: { in: mouvements.flatMap((m) => (m.commandeId ? [m.commandeId] : [])) } }, select: { id: true, numero: true } }),
  ]);
  const nom = new Map(noms.map((c) => [c.id, c.nom])), numero = new Map(numeros.map((c) => [c.id, c.numero]));
  return {
    regles: r.reglages.fidelite,
    peutGerer: aDroit(ctx, "gerer_fidelite"),
    moteurPromotions: r.flags.smart_promotions,
    /** Les points se dépensent par un avoir : le moyen de paiement « avoir » doit être proposé en caisse. */
    modeAvoirActif: r.reglages.paiements.modes.includes("avoir"),
    niveaux: Object.fromEntries(niveaux.map((n) => [n.niveauFidelite, n._count._all])),
    classement: classement.map((c) => ({ id: c.id, nom: c.nom, telephone: c.telephone, points: c.pointsFidelite, niveau: c.niveauFidelite, totalDepense: c.totalDepense })),
    historique: mouvements.map((m) => ({ id: m.id, clientId: m.clientId, client: nom.get(m.clientId) ?? "Client supprimé", type: m.type, points: m.points, vente: m.commandeId ? numero.get(m.commandeId) ?? null : null, motif: m.motif, date: m.createdAt.toISOString() })),
    avantages: avantages.map((a) => ({ id: a.id, nom: a.nom, actif: a.actif, niveaux: ((a.regles as Record<string, unknown> | null)?.niveaux ?? {}) as Record<string, number> })),
  };
});

const schemaRegles = z.object({
  active: z.boolean(),
  montantParPoint: z.number().finite().positive().max(1e9),
  valeurPoint: z.number().finite().min(0).max(1e9),
  seuils: z.object({ silver: z.number().int().min(1), gold: z.number().int().min(1), vip: z.number().int().min(1) }),
}).partial().refine((d) => Object.keys(d).length > 0, "Aucune modification envoyée.");

export const PATCH = routePos(async (ctx, req) => {
  exigerDroit(ctx, "gerer_fidelite");
  const modif = schemaRegles.parse(await req.json());
  if (modif.seuils && !(modif.seuils.silver < modif.seuils.gold && modif.seuils.gold < modif.seuils.vip)) {
    throw erreurs.invalide("Les seuils doivent être croissants : Silver, puis Gold, puis VIP.");
  }
  const regles = await prisma.$transaction(async (tx) => {
    const { avant, apres } = await enregistrerReglagesPos(ctx.tenantId, { reglages: { fidelite: modif } }, tx);
    if (modif.seuils) {
      // Le niveau se lit sur les points acquis (tout le journal sauf les utilisations) : on le remet d'accord avec les nouveaux seuils.
      // ponytail: une mise à jour par niveau sur tous les clients à points ; à passer en SQL si une boutique dépasse ~50 000 membres.
      const acquis = await tx.mouvementFidelite.groupBy({ by: ["clientId"], where: { tenantId: ctx.tenantId, type: { not: "utilisation" } }, _sum: { points: true } });
      for (const niveau of ["bronze", "silver", "gold", "vip"] as const) {
        const ids = acquis.filter((a) => niveauPour(Math.max(0, a._sum.points ?? 0), modif.seuils!) === niveau).map((a) => a.clientId);
        if (ids.length) await tx.client.updateMany({ where: { tenantId: ctx.tenantId, id: { in: ids }, niveauFidelite: { not: niveau } }, data: { niveauFidelite: niveau } });
      }
    }
    await journaliserAudit(tx, ctx, { action: "fidelite.regles_modifiees", entite: "ReglagesPos", entiteId: ctx.tenantId, avant: avant.reglages.fidelite, apres: apres.reglages.fidelite });
    return apres.reglages.fidelite;
  }, { maxWait: 10_000, timeout: 30_000 });
  return { ok: true, regles };
});
