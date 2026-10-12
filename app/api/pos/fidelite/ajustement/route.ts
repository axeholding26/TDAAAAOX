// Ajustement manuel des points d'un client (geste commercial, correction).
// POST /api/pos/fidelite/ajustement — droit : gerer_fidelite.
// Corps : { clientId, points (entier, négatif pour retirer), motif, cle }.
// Réponse : { ok, points, niveau, rejoue }. Motif obligatoire, tracé dans le journal d'audit.
import { z } from "zod";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { erreurs } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { lireReglagesPos } from "@/lib/pos/flags";
import { avecIdempotence } from "@/lib/pos/idempotence";
import { ajusterPoints } from "@/lib/pos/fidelite";

const schema = z.object({
  clientId: z.string().trim().min(1).max(64),
  points: z.number().int().min(-10_000_000).max(10_000_000).refine((n) => n !== 0, "Indiquez un nombre de points."),
  motif: z.string().trim().min(3, "Indiquez la raison de cet ajustement.").max(200),
  cle: z.string().trim().min(8).max(200).optional(),
});

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "gerer_fidelite");
  const corps = await req.json();
  const d = schema.parse(corps);
  const cle = cleIdempotence(req, corps);
  if (!cle) throw erreurs.invalide("La demande n'a pas d'identifiant. Rechargez la page puis réessayez.");
  const { reglages } = await lireReglagesPos(ctx.tenantId);
  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, cle, "fidelite.ajuster", async (tx) => {
    const r = await ajusterPoints(tx, ctx, { clientId: d.clientId, points: d.points, motif: d.motif, reglages: reglages.fidelite });
    await journaliserAudit(tx, ctx, { action: "fidelite.ajustee", entite: "Client", entiteId: d.clientId, motif: d.motif, avant: r.avant, apres: { points: r.points, niveau: r.niveau, ajustement: d.points } });
    return { points: r.points, niveau: r.niveau };
  }, { userId: ctx.userId, appareilId: ctx.appareilId });
  return { ok: true, ...resultat, rejoue };
});
