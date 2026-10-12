// Une promotion.
// PATCH  /api/pos/promotions/[id] — droit : gerer_promotions. Corps : tout ou partie
//   de schemaPromotion (ex. { actif: false } pour la désactiver). La promotion
//   complète est revalidée après fusion. Réponse : { ok, promotion }.
// DELETE /api/pos/promotions/[id] — droit : gerer_promotions. Une promotion déjà
//   utilisée par une vente n'est pas supprimée (409) : on la désactive, les ventes
//   passées continuent de la citer.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { ErreurPos, erreurs } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { schemaPromotion } from "@/lib/pos/promotions/schema";
import { verifierReferences, versReponse } from "../_promotions";

type Params = { id: string };

export const PATCH = routePos<Params>(async (ctx, req, { id }) => {
  exigerDroit(ctx, "gerer_promotions");
  const modif = z.record(z.string(), z.unknown()).parse(await req.json());
  const avant = await prisma.promotion.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!avant) throw erreurs.introuvable("Cette promotion");
  const d = schemaPromotion.parse({ ...versReponse(avant), ...modif });
  await verifierReferences(ctx, d);
  const promotion = await prisma.$transaction(async (tx) => {
    await tx.promotion.updateMany({ where: { id, tenantId: ctx.tenantId }, data: { ...d, valeur: d.valeur ?? null, dateDebut: d.dateDebut ?? null, dateFin: d.dateFin ?? null, codePromoId: d.codePromoId ?? null } });
    const p = await tx.promotion.findUniqueOrThrow({ where: { id } });
    await journaliserAudit(tx, ctx, { action: avant.actif !== p.actif ? (p.actif ? "promotion.activee" : "promotion.desactivee") : "promotion.modifiee", entite: "Promotion", entiteId: id, avant: versReponse(avant), apres: versReponse(p) });
    return p;
  });
  return { ok: true, promotion: versReponse(promotion) };
});

export const DELETE = routePos<Params>(async (ctx, _req, { id }) => {
  exigerDroit(ctx, "gerer_promotions");
  await prisma.$transaction(async (tx) => {
    const p = await tx.promotion.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!p) throw erreurs.introuvable("Cette promotion");
    if (p.utilisations > 0 || (await tx.ligneCommande.findFirst({ where: { promotionId: id }, select: { id: true } }))) {
      throw new ErreurPos("conflit", 409, "Cette promotion a déjà servi dans des ventes : elle ne peut pas être supprimée. Désactivez-la.");
    }
    await tx.promotion.deleteMany({ where: { id, tenantId: ctx.tenantId } });
    await journaliserAudit(tx, ctx, { action: "promotion.supprimee", entite: "Promotion", entiteId: id, avant: versReponse(p) });
  });
  return { ok: true };
});
