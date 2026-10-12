// Magasins de la boutique (avec leurs caisses et la session ouverte de chacune).
// GET  /api/pos/magasins — tout membre de la caisse ; un membre limité à
//   certains magasins ne voit que les siens. Crée « Magasin principal » +
//   « Caisse 1 » si la boutique n'en a encore aucun.
// POST /api/pos/magasins — droit : gerer_magasins. Corps : schemaMagasin.
//   Crée le magasin, son entrepôt (sauf `entrepotId` fourni) et sa première caisse.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { droitsUtilisateur, routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { assurerMagasinParDefaut, listerMagasins } from "@/lib/pos/magasins";
import { schemaMagasin } from "@/lib/pos/schemas";

export const GET = routePos(async (ctx) => {
  await assurerMagasinParDefaut(ctx.tenantId);
  const limites = ctx.appareilId ? [ctx.magasinId] : (await droitsUtilisateur(ctx.tenantId, ctx.userId))?.magasinIds ?? [];
  return { magasins: await listerMagasins(ctx.tenantId, limites), magasinId: ctx.magasinId, caisseId: ctx.caisseId };
});

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "gerer_magasins");
  const d = schemaMagasin.parse(await req.json());
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { pays: true } });
  if (d.entrepotId && !(await prisma.entrepot.findFirst({ where: { id: d.entrepotId, tenantId: ctx.tenantId }, select: { id: true } }))) {
    throw new ErreurPos("introuvable", 404, "Cet entrepôt est introuvable dans cette boutique.");
  }
  try {
    const magasin = await prisma.$transaction(async (tx) => {
      const entrepotId = d.entrepotId
        ?? (await tx.entrepot.create({ data: { tenantId: ctx.tenantId, nom: d.nom, adresse: d.adresse || null, ville: d.ville || null, pays: d.pays || tenant.pays }, select: { id: true } })).id;
      const m = await tx.magasin.create({
        data: {
          tenantId: ctx.tenantId, nom: d.nom, code: d.code || null, adresse: d.adresse || null, ville: d.ville || null,
          pays: d.pays || tenant.pays, telephone: d.telephone || null, entrepotId, typeCommerce: d.typeCommerce ?? null,
          caisses: { create: { tenantId: ctx.tenantId, nom: "Caisse 1" } },
        },
        include: { caisses: true },
      });
      await journaliserAudit(tx, ctx, { action: "magasin.cree", entite: "Magasin", entiteId: m.id, apres: { nom: m.nom, entrepotId, ville: m.ville } });
      return m;
    });
    return NextResponse.json({ ok: true, magasin }, { status: 201 });
  } catch (e) {
    if ((e as any)?.code === "P2002") throw new ErreurPos("conflit", 409, `Un magasin s'appelle déjà « ${d.nom} ». Choisissez un autre nom.`);
    throw e;
  }
});
