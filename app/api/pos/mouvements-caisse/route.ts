// Mouvements de caisse hors ventes (retrait, dépôt, dépense, correction).
// GET  /api/pos/mouvements-caisse?sessionCaisseId= — mouvements d'une session
//   (défaut : la session ouverte de la caisse de travail) et noms des personnes.
//   Droit : voir_caisse (toute session) ; sinon mouvement_caisse, fermer_caisse
//   ou ouvrir_caisse pour une session de sa propre caisse.
// POST /api/pos/mouvements-caisse — droit : mouvement_caisse.
//   Corps : { type, montant, motif, categorie?, cle }. Montant positif, signé
//   pour une correction. Une dépense crée aussi une charge d'exploitation.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { enregistrerMouvementCaisse, nomsUtilisateurs, schemaMouvementCaisse } from "@/lib/pos/caisse/mouvements";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "voir_caisse", "mouvement_caisse", "fermer_caisse", "ouvrir_caisse");
  const id = new URL(req.url).searchParams.get("sessionCaisseId") ?? ctx.sessionCaisseId;
  if (!id) return { session: null, mouvements: [], noms: {} };
  const session = await prisma.sessionCaisse.findFirst({
    where: { id, tenantId: ctx.tenantId, ...(aDroit(ctx, "voir_caisse") ? {} : { caisseId: ctx.caisseId }) },
    select: { id: true, statut: true, ouvertePar: true, fermeePar: true, mouvements: { orderBy: { createdAt: "desc" } } },
  });
  if (!session) throw new ErreurPos("introuvable", 404, "Cette session de caisse est introuvable.");
  const noms = await nomsUtilisateurs(ctx.tenantId, [session.ouvertePar, session.fermeePar, ...session.mouvements.map((m) => m.creePar)]);
  return { session: { id: session.id, statut: session.statut, ouvertePar: session.ouvertePar, fermeePar: session.fermeePar }, mouvements: session.mouvements, noms };
});

export const POST = routePos(async (ctx, req) => {
  const corps = await req.json();
  const demande = schemaMouvementCaisse.parse({ ...corps, cle: cleIdempotence(req, corps) });
  const mouvement = await enregistrerMouvementCaisse(ctx, demande);
  return NextResponse.json(
    { ok: true, mouvement, rejoue: mouvement.rejoue, ...(mouvement.rejoue ? { message: "Ce mouvement de caisse a déjà été enregistré. Aucun doublon n'a été créé." } : {}) },
    { status: mouvement.rejoue ? 200 : 201 },
  );
});
