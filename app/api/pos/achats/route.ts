// Bons de commande fournisseur.
// GET  /api/pos/achats?statut=&curseur= — droit : achat_creer, achat_valider ou reception.
//   Réponse : { bons, curseurSuivant, fournisseurs, entrepots, entrepotId, droits: { creer, valider, recevoir } }.
// POST /api/pos/achats — droit : achat_creer. Corps : schemaBon + cle.
//   Crée un bon EN BROUILLON. Réponse : 201 { ok, bon, rejoue }.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { entrepotDuMagasin } from "@/lib/pos/magasins";
import { creerBons, lireBon, listerBons, schemaBon } from "@/lib/pos/achats/bons";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "achat_creer", "achat_valider", "reception");
  const q = new URL(req.url).searchParams;
  const [liste, fournisseurs, entrepots, entrepotId] = await Promise.all([
    listerBons(ctx.tenantId, { statut: q.get("statut"), curseur: q.get("curseur") }),
    prisma.fournisseur.findMany({ where: { tenantId: ctx.tenantId, actif: true }, orderBy: { nom: "asc" }, select: { id: true, nom: true, email: true, telephone: true } }),
    prisma.entrepot.findMany({ where: { tenantId: ctx.tenantId, actif: true }, orderBy: [{ principal: "desc" }, { createdAt: "asc" }], select: { id: true, nom: true } }),
    entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId),
  ]);
  return { ...liste, fournisseurs, entrepots, entrepotId, droits: { creer: aDroit(ctx, "achat_creer"), valider: aDroit(ctx, "achat_valider"), recevoir: aDroit(ctx, "reception") } };
});

export const POST = routePos(async (ctx, req) => {
  const corps = await req.json();
  const r = await creerBons(ctx, [schemaBon.parse(corps)], "manuel", cleIdempotence(req, corps));
  return NextResponse.json(
    { ok: true, bon: await lireBon(ctx.tenantId, r.bons[0].id), rejoue: r.rejoue, ...(r.rejoue ? { message: "Ce bon de commande a déjà été créé. Aucun doublon n'a été créé." } : {}) },
    { status: r.rejoue ? 200 : 201 },
  );
});
