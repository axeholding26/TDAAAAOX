// Une charge d'exploitation. Droit : voir_couts ou rapprochement.
// PATCH  /api/pos/charges/:id — { statut?, montant?, description?, dateEcheance?, notes? }
// DELETE /api/pos/charges/:id — erreur de saisie.
// Une dépense sortie d'une caisse (sessionCaisseId renseigné) ne change plus de
// montant et ne se supprime pas ici : l'argent est sorti du tiroir, la session
// en garde le mouvement. Elle se corrige par un mouvement de caisse « correction ».
// Modification de montant et suppression sont tracées dans le journal d'audit.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import type { ContextePos } from "@/lib/pos/types";

const schemaModif = z.object({
  statut: z.enum(["payee", "en_attente", "en_retard"]).optional(),
  montant: z.coerce.number().finite().positive().max(1e12).optional(),
  description: z.string().trim().min(1).max(300).optional(),
  dateEcheance: z.preprocess((v) => (v ? new Date(v as string) : null), z.date().nullable()).optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

async function chargeDe(ctx: ContextePos, id: string) {
  exigerUnDroit(ctx, "voir_couts", "rapprochement");
  const charge = await prisma.chargeExploitation.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!charge) throw new ErreurPos("introuvable", 404, "Cette charge est introuvable dans cette boutique.");
  return charge;
}

const DE_CAISSE = "Cette dépense est sortie d'une caisse : son montant fait partie du comptage de la session. Corrigez-la par un mouvement de caisse « correction ».";

export const PATCH = routePos<{ id: string }>(async (ctx, req, { id }) => {
  const charge = await chargeDe(ctx, id);
  const data = schemaModif.parse(await req.json());
  if (charge.sessionCaisseId && data.montant !== undefined && data.montant !== charge.montant) throw new ErreurPos("conflit", 409, DE_CAISSE);
  const miseAJour = await prisma.$transaction(async (tx) => {
    const c = await tx.chargeExploitation.update({ where: { id: charge.id }, data });
    await journaliserAudit(tx, ctx, {
      action: "charge.modifiee", entite: "ChargeExploitation", entiteId: c.id,
      avant: { statut: charge.statut, montant: charge.montant, description: charge.description },
      apres: { statut: c.statut, montant: c.montant, description: c.description },
    });
    return c;
  });
  return { charge: miseAJour };
});

export const DELETE = routePos<{ id: string }>(async (ctx, _req, { id }) => {
  const charge = await chargeDe(ctx, id);
  if (charge.sessionCaisseId) throw new ErreurPos("conflit", 409, DE_CAISSE);
  await prisma.$transaction(async (tx) => {
    await tx.chargeExploitation.delete({ where: { id: charge.id } });
    await journaliserAudit(tx, ctx, { action: "charge.supprimee", entite: "ChargeExploitation", entiteId: charge.id, avant: { categorie: charge.categorie, description: charge.description, montant: charge.montant, statut: charge.statut } });
  });
  return { ok: true };
});
