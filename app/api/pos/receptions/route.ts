// Réceptions de marchandise.
// GET  /api/pos/receptions?bonCommandeId= — droit : reception, achat_creer ou achat_valider.
//   Réponse : { receptions, bon?, fournisseurs, entrepots, entrepotId, peutRecevoir }.
//   Avec bonCommandeId : `bon` (lignes, quantités commandées et déjà reçues) pour préparer la réception.
// POST /api/pos/receptions — droit : reception. Corps : schemaReception + cle.
//   Valide la réception : lots, numéros de série, entrée en stock, coût moyen
//   pondéré, avancement du bon — une seule transaction idempotente
//   (lib/pos/achats/receptions.ts). Réponse : 201 { ok, receptionId, lignes, unites, bon, couts, rejoue }.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { entrepotDuMagasin } from "@/lib/pos/magasins";
import { lireBon } from "@/lib/pos/achats/bons";
import { enregistrerReception, listerReceptions, schemaReception } from "@/lib/pos/achats/receptions";

// Une réception de 200 lignes enchaîne plus d'un millier d'écritures.
export const maxDuration = 60;

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "reception", "achat_creer", "achat_valider");
  const bonCommandeId = new URL(req.url).searchParams.get("bonCommandeId");
  const [receptions, bon, fournisseurs, entrepots, entrepotId] = await Promise.all([
    listerReceptions(ctx.tenantId, { bonCommandeId }),
    bonCommandeId ? lireBon(ctx.tenantId, bonCommandeId) : null,
    prisma.fournisseur.findMany({ where: { tenantId: ctx.tenantId, actif: true }, orderBy: { nom: "asc" }, select: { id: true, nom: true } }),
    prisma.entrepot.findMany({ where: { tenantId: ctx.tenantId, actif: true }, orderBy: [{ principal: "desc" }, { createdAt: "asc" }], select: { id: true, nom: true } }),
    entrepotDuMagasin(prisma, ctx.tenantId, ctx.magasinId),
  ]);
  return { receptions, bon, fournisseurs, entrepots, entrepotId, peutRecevoir: aDroit(ctx, "reception") };
});

export const POST = routePos(async (ctx, req) => {
  const corps = await req.json();
  const r = await enregistrerReception(ctx, schemaReception.parse(corps), cleIdempotence(req, corps));
  return NextResponse.json(
    { ok: true, ...r, ...(r.rejoue ? { message: "Cette réception a déjà été enregistrée. Aucun doublon n'a été créé." } : {}) },
    { status: r.rejoue ? 200 : 201 },
  );
});
