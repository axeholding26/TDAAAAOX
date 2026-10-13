// Lots de traçabilité (§14).
// GET  /api/pos/lots?statut=&alerte=&q=&curseur=&limite=
//   statut : all | actif | bloque | epuise | perime | rappele ; alerte : expire | expire_bientot | bloque.
//   Réponse : { lots, curseurSuivant, stats: { actifs, bloques, expires, expirantBientot }, seuilJours, coutsVisibles }.
//   Le coût d'un lot est null sans le droit voir_couts. Droit : voir_stock.
// GET  /api/pos/lots?vue=alertes — { seuilJours, expires, expirentBientot, bloques, total } (alertesLots). Droit : voir_stock.
// POST /api/pos/lots — réception d'un lot : crée le lot et crédite le stock de son entrepôt.
//   Corps : schemaLot { cle, produitId, varianteId?, codeLot, quantite, cout?, fournisseurId?, fournisseurNom?,
//   fournisseurRef?, entrepotId?, dateReception?, dateExpiration?, certification?, notes? }.
//   Réponse 201 : { ok, lotId, codeLot, stock, rejoue }. Droit : reception ou ajuster_stock.
import { NextResponse } from "next/server";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { alertesLots, listerLots, recevoirLot, schemaLot } from "@/lib/pos/operations/lots";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "voir_stock");
  const p = new URL(req.url).searchParams;
  if (p.get("vue") === "alertes") return alertesLots(ctx.tenantId);
  return listerLots(ctx, { statut: p.get("statut"), alerte: p.get("alerte"), q: p.get("q"), curseur: p.get("curseur"), limite: Number(p.get("limite")) || undefined });
});

export const POST = routePos(async (ctx, req) => {
  const corps = (await req.json()) ?? {};
  // Clé envoyée par l'écran : un renvoi (réseau coupé, double clic) ne recrédite pas le stock.
  const lot = await recevoirLot(ctx, schemaLot.parse({ ...corps, cle: cleIdempotence(req, corps) }));
  return NextResponse.json(
    { ok: true, ...lot, ...(lot.rejoue ? { message: "Ce lot a déjà été enregistré. Aucun doublon n'a été créé." } : {}) },
    { status: lot.rejoue ? 200 : 201 },
  );
});
