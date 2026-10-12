// Inventaires (§26).
// GET  /api/pos/inventaire?statut=&curseur=&limite= — statut : all | ouverts | en_cours | a_valider | valide | annule.
//   Réponse : { inventaires, curseurSuivant, lieux, lieuCourant, droits: { compter, valider } }. Droit : voir_stock ou inventaire_compter.
// POST /api/pos/inventaire — démarre un inventaire (un seul ouvert par lieu).
//   Corps : schemaInventaire { cle, type: complet | partiel | rayon | categorie | produit | cyclique, entrepotId?,
//   perimetre: { categories?, produitIds?, nombre? }, notes? }.
//   Réponse 201 : { ok, comptageId, lignes, rejoue }. 409 « inventaire_ouvert » (details.comptageId). Droit : inventaire_compter. Audité.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { entrepotDuMagasin } from "@/lib/pos/magasins";
import { lieuxBoutique } from "@/lib/pos/operations/fiche";
import { creerInventaire, listerInventaires, schemaInventaire } from "@/lib/pos/operations/inventaire";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "voir_stock", "inventaire_compter", "inventaire_valider");
  const p = new URL(req.url).searchParams;
  const [liste, lieux, lieuCourant] = await Promise.all([
    listerInventaires(ctx, { statut: p.get("statut"), curseur: p.get("curseur"), limite: Number(p.get("limite")) || undefined }),
    lieuxBoutique(ctx.tenantId),
    entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId),
  ]);
  return { ...liste, lieux, lieuCourant, droits: { compter: aDroit(ctx, "inventaire_compter"), valider: aDroit(ctx, "inventaire_valider") } };
});

export const POST = routePos(async (ctx, req) => {
  const corps = await req.json();
  const r = await creerInventaire(ctx, schemaInventaire.parse({ ...corps, cle: cleIdempotence(req, corps) }));
  return NextResponse.json({ ok: true, ...r }, { status: r.rejoue ? 200 : 201 });
});
