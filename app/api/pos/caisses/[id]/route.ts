// Modification d'une caisse.
// PATCH /api/pos/caisses/:id — droit : gerer_magasins. Corps : { nom?, actif? }.
// Une caisse ouverte ne peut pas être désactivée.
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { sessionOuverte } from "@/lib/pos/session-caisse";
import { schemaCaisseModif } from "@/lib/pos/schemas";

export const PATCH = routePos<{ id: string }>(async (ctx, req, { id }) => {
  exigerDroit(ctx, "gerer_magasins");
  const d = schemaCaisseModif.parse(await req.json());
  const avant = await prisma.caisse.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!avant) throw new ErreurPos("introuvable", 404, "Cette caisse est introuvable dans cette boutique.");
  if (d.actif === false && (await sessionOuverte(id))) {
    throw new ErreurPos("conflit", 409, "Cette caisse est ouverte. Fermez sa session avant de la désactiver.");
  }
  try {
    const caisse = await prisma.$transaction(async (tx) => {
      const c = await tx.caisse.update({ where: { id }, data: d });
      await journaliserAudit(tx, ctx, { action: "caisse.modifiee", entite: "Caisse", entiteId: id, avant, apres: c });
      return c;
    });
    return { ok: true, caisse };
  } catch (e) {
    if ((e as any)?.code === "P2002") throw new ErreurPos("conflit", 409, `Ce magasin a déjà une caisse « ${d.nom} ». Choisissez un autre nom.`);
    throw e;
  }
});
