// Caisses de la boutique.
// GET  /api/pos/caisses?magasinId= — caisses (toutes, ou celles d'un magasin) avec leur session ouverte.
// POST /api/pos/caisses — droit : gerer_magasins. Corps : { magasinId, nom }.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { droitsUtilisateur, routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { listerMagasins } from "@/lib/pos/magasins";
import { schemaCaisse } from "@/lib/pos/schemas";

export const GET = routePos(async (ctx, req) => {
  const magasinId = new URL(req.url).searchParams.get("magasinId");
  const limites = ctx.appareilId ? [ctx.magasinId] : (await droitsUtilisateur(ctx.tenantId, ctx.userId))?.magasinIds ?? [];
  const magasins = await listerMagasins(ctx.tenantId, limites);
  return {
    caisses: magasins
      .filter((m) => !magasinId || m.id === magasinId)
      .flatMap((m) => m.caisses.map((c) => ({ ...c, magasinNom: m.nom }))),
    caisseId: ctx.caisseId,
  };
});

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "gerer_magasins");
  const d = schemaCaisse.parse(await req.json());
  const magasin = await prisma.magasin.findFirst({ where: { id: d.magasinId, tenantId: ctx.tenantId }, select: { id: true, nom: true } });
  if (!magasin) throw new ErreurPos("introuvable", 404, "Ce magasin est introuvable dans cette boutique.");
  try {
    const caisse = await prisma.$transaction(async (tx) => {
      const c = await tx.caisse.create({ data: { tenantId: ctx.tenantId, magasinId: magasin.id, nom: d.nom } });
      await journaliserAudit(tx, ctx, { action: "caisse.creee", entite: "Caisse", entiteId: c.id, apres: { nom: c.nom, magasin: magasin.nom } });
      return c;
    });
    return NextResponse.json({ ok: true, caisse }, { status: 201 });
  } catch (e) {
    if ((e as any)?.code === "P2002") throw new ErreurPos("conflit", 409, `Ce magasin a déjà une caisse « ${d.nom} ». Choisissez un autre nom.`);
    throw e;
  }
});
