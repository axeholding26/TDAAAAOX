// Sessions de caisse.
// GET  /api/pos/sessions?limite= — session ouverte de la caisse de travail
//   (avec le détail du montant attendu pour qui peut fermer ou voir la caisse)
//   et dernières sessions : celles de sa caisse, ou toutes avec « voir_caisse ».
// POST /api/pos/sessions — ouvre la caisse (droit : ouvrir_caisse).
//   Corps : { fondsInitial, cle? }. Une seule session ouverte par caisse.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { schemaOuverture } from "@/lib/pos/schemas";
import { detailAttendu, ouvrirSession } from "@/lib/pos/session-caisse";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "vendre", "ouvrir_caisse", "fermer_caisse", "voir_caisse");
  const limite = Math.min(Math.max(Number(new URL(req.url).searchParams.get("limite")) || 20, 1), 100);
  const voirTout = aDroit(ctx, "voir_caisse");
  const [ouverte, recentes] = await Promise.all([
    ctx.sessionCaisseId ? prisma.sessionCaisse.findUnique({ where: { id: ctx.sessionCaisseId } }) : null,
    prisma.sessionCaisse.findMany({
      where: { tenantId: ctx.tenantId, ...(voirTout ? {} : { caisseId: ctx.caisseId }) },
      orderBy: { ouverteAt: "desc" }, take: limite,
      include: { caisse: { select: { nom: true, magasin: { select: { nom: true } } } } },
    }),
  ]);
  // Le montant attendu ne se montre qu'à qui ferme ou supervise la caisse.
  const detail = ouverte && (voirTout || aDroit(ctx, "fermer_caisse")) ? await detailAttendu(prisma, ouverte.id) : null;
  return { ouverte: ouverte ? { ...ouverte, detail } : null, recentes, caisseId: ctx.caisseId, magasinId: ctx.magasinId };
});

export const POST = routePos(async (ctx, req) => {
  const corps = schemaOuverture.parse(await req.json());
  const session = await ouvrirSession(ctx, corps.fondsInitial, cleIdempotence(req, corps));
  return NextResponse.json(
    { ok: true, session, rejoue: session.rejoue, ...(session.rejoue ? { message: "Cette caisse était déjà ouverte par cette demande. Aucune seconde session n'a été créée." } : {}) },
    { status: session.rejoue ? 200 : 201 },
  );
});
