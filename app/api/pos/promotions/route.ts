// Promotions de la caisse.
// GET  /api/pos/promotions — droits : gerer_promotions (tout) ou vendre (lecture).
//   Réponse : { promotions, moteurActif, peutGerer, peutActiverMoteur, magasins, codesPromo }.
//   `moteurActif` = drapeau smart_promotions : éteint, AUCUNE promotion ne s'applique en caisse.
// POST /api/pos/promotions — droit : gerer_promotions. Corps : schemaPromotion
//   (lib/pos/promotions/schema.ts ; format de `regles` : lib/pos/promotions/moteur.ts).
//   Réponse 201 : { ok, promotion }. Tracé dans le journal d'audit.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerDroit, exigerUnDroit } from "@/lib/pos/droits";
import { journaliserAudit } from "@/lib/pos/audit";
import { flagActif } from "@/lib/pos/flags";
import { schemaPromotion } from "@/lib/pos/promotions/schema";
import { verifierReferences, versReponse } from "./_promotions";

export const GET = routePos(async (ctx) => {
  exigerUnDroit(ctx, "gerer_promotions", "vendre");
  const [promotions, moteurActif, magasins, codesPromo] = await Promise.all([
    prisma.promotion.findMany({ where: { tenantId: ctx.tenantId }, orderBy: [{ actif: "desc" }, { priorite: "desc" }, { createdAt: "desc" }], take: 500 }),
    flagActif(ctx.tenantId, "smart_promotions"),
    prisma.magasin.findMany({ where: { tenantId: ctx.tenantId, actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" } }),
    prisma.codePromo.findMany({ where: { tenantId: ctx.tenantId, actif: true }, select: { id: true, code: true }, orderBy: { code: "asc" }, take: 200 }),
  ]);
  return {
    promotions: promotions.map(versReponse), moteurActif,
    peutGerer: aDroit(ctx, "gerer_promotions"), peutActiverMoteur: aDroit(ctx, "gerer_reglages"),
    magasins, codesPromo,
  };
});

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "gerer_promotions");
  const d = schemaPromotion.parse(await req.json());
  await verifierReferences(ctx, d);
  const promotion = await prisma.$transaction(async (tx) => {
    const p = await tx.promotion.create({ data: { tenantId: ctx.tenantId, ...d, valeur: d.valeur ?? null, dateDebut: d.dateDebut ?? null, dateFin: d.dateFin ?? null, codePromoId: d.codePromoId ?? null } });
    await journaliserAudit(tx, ctx, { action: "promotion.creee", entite: "Promotion", entiteId: p.id, apres: versReponse(p) });
    return p;
  });
  return NextResponse.json({ ok: true, promotion: versReponse(promotion) }, { status: 201 });
});
