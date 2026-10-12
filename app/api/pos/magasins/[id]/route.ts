// Modification d'un magasin.
// PATCH /api/pos/magasins/:id — droit : gerer_magasins. Corps : schemaMagasinModif.
// Un magasin dont une caisse est ouverte ne peut pas être désactivé.
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { schemaMagasinModif } from "@/lib/pos/schemas";

export const PATCH = routePos<{ id: string }>(async (ctx, req, { id }) => {
  exigerDroit(ctx, "gerer_magasins");
  const d = schemaMagasinModif.parse(await req.json());
  const avant = await prisma.magasin.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!avant) throw new ErreurPos("introuvable", 404, "Ce magasin est introuvable dans cette boutique.");
  if (d.actif === false && (await prisma.sessionCaisse.count({ where: { magasinId: id, statut: "ouverte" } })) > 0) {
    throw new ErreurPos("conflit", 409, "Une caisse de ce magasin est encore ouverte. Fermez-la avant de désactiver le magasin.");
  }
  try {
    const magasin = await prisma.$transaction(async (tx) => {
      const m = await tx.magasin.update({ where: { id }, data: d });
      await journaliserAudit(tx, ctx, { action: "magasin.modifie", entite: "Magasin", entiteId: id, avant, apres: m });
      return m;
    });
    return { ok: true, magasin };
  } catch (e) {
    if ((e as any)?.code === "P2002") throw new ErreurPos("conflit", 409, `Un magasin s'appelle déjà « ${d.nom} ». Choisissez un autre nom.`);
    throw e;
  }
});
