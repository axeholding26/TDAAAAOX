// Transferts de stock entre entrepôts / magasins (§32).
// GET  /api/pos/transferts?statut=&curseur=&limite= — statut : all | en_cours | brouillon | demande | approuve |
//   en_preparation | expedie | partiellement_recu | recu | annule.
//   Réponse : { transferts, curseurSuivant, lieux, lieuCourant, droits: { creer, approuver, recevoir } }.
//   Droit : voir_stock ou l'un des droits de transfert.
// POST /api/pos/transferts — crée un transfert (brouillon, ou demandé si `demander`). Aucun stock ne bouge.
//   Corps : schemaTransfert { cle, entrepotSourceId, entrepotDestinationId, lignes: [{ produitId, varianteId?, quantite }], notes?, demander? }.
//   Réponse 201 : { ok, transfertId, numero, statut, rejoue }. Droit : transfert_creer. Audité.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { entrepotDuMagasin } from "@/lib/pos/magasins";
import { lieuxBoutique } from "@/lib/pos/operations/fiche";
import { creerTransfert, listerTransferts, schemaTransfert } from "@/lib/pos/operations/transferts";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "voir_stock", "transfert_creer", "transfert_approuver", "transfert_recevoir");
  const p = new URL(req.url).searchParams;
  const [liste, lieux, lieuCourant] = await Promise.all([
    listerTransferts(ctx, { statut: p.get("statut"), curseur: p.get("curseur"), limite: Number(p.get("limite")) || undefined }),
    lieuxBoutique(ctx.tenantId),
    entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId),
  ]);
  return { ...liste, lieux, lieuCourant, droits: { creer: aDroit(ctx, "transfert_creer"), approuver: aDroit(ctx, "transfert_approuver"), recevoir: aDroit(ctx, "transfert_recevoir") } };
});

export const POST = routePos(async (ctx, req) => {
  const corps = await req.json();
  const r = await creerTransfert(ctx, schemaTransfert.parse({ ...corps, cle: cleIdempotence(req, corps) }));
  return NextResponse.json({ ok: true, ...r }, { status: r.rejoue ? 200 : 201 });
});
