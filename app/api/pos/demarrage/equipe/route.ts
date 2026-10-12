// Droits de caisse des membres de l'équipe (MembreEquipe.droitsPos, magasinIds).
// GET   /api/pos/demarrage/equipe → { membres, actions, magasins }
// PATCH /api/pos/demarrage/equipe { membreId, droitsPos?: { action: true | false | null }, magasinIds?: string[] }
// Droit : gerer_reglages. Audité (equipe.droits_modifies).
//
// `droitsPos` ne contient que des RETOUCHES de la grille du rôle : true ou
// false force le droit, null rend la valeur du rôle. `magasinIds` vide = tous
// les magasins. Personne ne modifie ses propres droits.
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { ACTIONS_POS, LIBELLES_ACTIONS, droitsPour, exigerDroit } from "@/lib/pos/droits";
import { ErreurPos, erreurs } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";

const retouches = (brut: unknown): Record<string, boolean> =>
  Object.fromEntries(Object.entries((brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>).filter(([k, v]) => (ACTIONS_POS as readonly string[]).includes(k) && typeof v === "boolean")) as Record<string, boolean>;

export const GET = routePos(async (ctx) => {
  exigerDroit(ctx, "gerer_reglages");
  const [membres, magasins] = await Promise.all([
    prisma.membreEquipe.findMany({
      where: { tenantId: ctx.tenantId }, orderBy: { nom: "asc" },
      select: { id: true, userId: true, nom: true, email: true, role: true, statut: true, permissions: true, droitsPos: true, magasinIds: true },
    }),
    prisma.magasin.findMany({ where: { tenantId: ctx.tenantId, demo: false }, orderBy: { createdAt: "asc" }, select: { id: true, nom: true, actif: true } }),
  ]);
  return {
    membres: membres.map((m) => ({
      id: m.id, nom: m.nom, email: m.email, role: m.role, statut: m.statut, moi: m.userId === ctx.userId, magasinIds: m.magasinIds,
      retouches: retouches(m.droitsPos),
      /** Ce que donne le rôle seul, puis le résultat une fois les retouches appliquées. */
      droitsRole: droitsPour({ proprietaire: false, role: m.role, permissions: m.permissions }),
      droits: droitsPour({ proprietaire: false, role: m.role, permissions: m.permissions, droitsPos: m.droitsPos }),
    })),
    actions: ACTIONS_POS.map((id) => ({ id, libelle: LIBELLES_ACTIONS[id] })),
    magasins,
  };
});

const schema = z.object({
  membreId: z.string().trim().min(1).max(64),
  droitsPos: z.partialRecord(z.enum(ACTIONS_POS), z.boolean().nullable()).optional(),
  magasinIds: z.array(z.string().trim().min(1).max(64)).max(200).optional(),
});

export const PATCH = routePos(async (ctx, req) => {
  exigerDroit(ctx, "gerer_reglages");
  const d = schema.parse(await req.json());
  const membre = await prisma.membreEquipe.findFirst({ where: { id: d.membreId, tenantId: ctx.tenantId }, select: { id: true, userId: true, nom: true, droitsPos: true, magasinIds: true } });
  if (!membre) throw erreurs.introuvable("Ce membre de l'équipe");
  if (membre.userId === ctx.userId) throw new ErreurPos("non_autorise", 403, "Vous ne pouvez pas modifier vos propres droits. Demandez au propriétaire de la boutique.");

  let magasinIds = membre.magasinIds;
  if (d.magasinIds) {
    magasinIds = [...new Set(d.magasinIds)];
    const connus = await prisma.magasin.count({ where: { tenantId: ctx.tenantId, id: { in: magasinIds } } });
    if (connus !== magasinIds.length) throw erreurs.invalide("Un des magasins choisis n'existe pas dans cette boutique.");
  }
  const droits = retouches(membre.droitsPos);
  for (const [action, valeur] of Object.entries(d.droitsPos ?? {})) {
    if (valeur === null || valeur === undefined) delete droits[action]; else droits[action] = valeur;
  }

  await prisma.$transaction(async (tx) => {
    await tx.membreEquipe.update({ where: { id: membre.id }, data: { droitsPos: droits as Prisma.InputJsonValue, magasinIds } });
    await journaliserAudit(tx, ctx, {
      action: "equipe.droits_modifies", entite: "MembreEquipe", entiteId: membre.id,
      avant: { droitsPos: retouches(membre.droitsPos), magasinIds: membre.magasinIds }, apres: { droitsPos: droits, magasinIds }, motif: membre.nom,
    });
  });
  return { ok: true, membre: { id: membre.id, retouches: droits, magasinIds } };
});
