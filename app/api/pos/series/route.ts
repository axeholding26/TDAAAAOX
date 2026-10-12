// Numéros de série et IMEI (§12).
// GET  /api/pos/series?q=&statut=&produitId=&curseur=&limite=
//   Recherche par numéro ou IMEI (entier ou partiel). Réponse : { series, curseurSuivant, stats: { [statut]: nombre } }.
//   Chaque numéro : statut, article, entrepôt, vente, client, date d'achat, fin et état de garantie. Droit : voir_stock.
// POST /api/pos/series — enregistre des numéros pour un article (à la réception ou à la main). N'ajoute pas de stock.
//   Corps : schemaSeries { cle, produitId, varianteId?, numeros[], entrepotId?, lotId?, coutAchat?, activerSuivi?, garantieMois? }.
//   Réponse 201 : { ok, enregistres, produitId, rejoue }. 409 « serie_connue » si un numéro existe déjà (rien n'est ajouté).
//   Droit : reception ou ajuster_stock. Audité.
import { NextResponse } from "next/server";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { enregistrerSeries, listerSeries, schemaSeries } from "@/lib/pos/operations/series";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "voir_stock");
  const p = new URL(req.url).searchParams;
  return listerSeries(ctx, { q: p.get("q"), statut: p.get("statut"), produitId: p.get("produitId"), curseur: p.get("curseur"), limite: Number(p.get("limite")) || undefined });
});

export const POST = routePos(async (ctx, req) => {
  const corps = await req.json();
  const r = await enregistrerSeries(ctx, schemaSeries.parse({ ...corps, cle: cleIdempotence(req, corps) }));
  return NextResponse.json({ ok: true, ...r, ...(r.rejoue ? { message: "Ces numéros ont déjà été enregistrés. Aucun doublon n'a été créé." } : {}) }, { status: r.rejoue ? 200 : 201 });
});
