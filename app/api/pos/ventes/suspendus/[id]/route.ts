// Reprise ou abandon d'un panier en attente.
// PATCH /api/pos/ventes/suspendus/:id — droit : vendre. Corps : { action: "reprendre" | "abandonner" }.
// Un panier ne se reprend qu'une fois : la seconde caisse qui le demande reçoit un conflit.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";

const schema = z.object({ action: z.enum(["reprendre", "abandonner"]) });

export const PATCH = routePos<{ id: string }>(async (ctx, req, { id }) => {
  exigerDroit(ctx, "vendre");
  const { action } = schema.parse(await req.json());
  const pris = await prisma.panierSuspendu.updateMany({
    // Membre limité à certains magasins : seulement leurs paniers.
    where: { id, tenantId: ctx.tenantId, statut: "suspendu", ...(ctx.magasinIds?.length ? { magasinId: { in: ctx.magasinIds } } : {}) },
    data: { statut: action === "reprendre" ? "repris" : "abandonne", reprisAt: new Date() },
  });
  if (pris.count === 0) throw new ErreurPos("conflit", 409, "Ce panier a déjà été repris ou abandonné sur une autre caisse.");
  return { ok: true, panier: await prisma.panierSuspendu.findUnique({ where: { id } }) };
});
