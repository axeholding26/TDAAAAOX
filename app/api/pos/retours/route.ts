// Retours en caisse.
// GET  /api/pos/retours?limite= — derniers retours traités (droit : retour ou voir_caisse).
// POST /api/pos/retours — enregistre un retour (droit : retour ; « rembourser »
//   en plus pour rendre de l'argent ; « vendre » en plus pour un échange).
//   Corps : schemaRetour (lib/pos/retours.ts). Idempotent sur `cle`.
//   Échange : le retour puis la nouvelle vente ; si la vente est refusée, le
//   retour reste acquis et `erreurVente` dit pourquoi (l'avoir reste utilisable).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { enregistrerEchange, enregistrerRetour, listerRetours, messageRetour, schemaRetour } from "@/lib/pos/retours";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "retour", "voir_caisse");
  return { retours: await listerRetours(ctx, Number(new URL(req.url).searchParams.get("limite")) || 30) };
});

export const POST = routePos(async (ctx, req) => {
  const corps = await req.json();
  const demande = schemaRetour.parse({ ...corps, cle: cleIdempotence(req, corps) });
  const retour = demande.type === "echange" ? await enregistrerEchange(ctx, demande) : await enregistrerRetour(ctx, demande);
  const { devise } = await prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } });
  return NextResponse.json(
    { ok: true, retour, rejoue: retour.rejoue, message: retour.rejoue ? "Ce retour a déjà été enregistré. Aucun doublon n'a été créé." : messageRetour(retour, devise) },
    { status: retour.rejoue ? 200 : 201 },
  );
});
