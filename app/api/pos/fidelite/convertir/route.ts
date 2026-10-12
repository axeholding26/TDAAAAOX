// Utilisation des points à la caisse : des points deviennent un AVOIR.
// POST /api/pos/fidelite/convertir — droit : vendre.
// Corps : { clientId, points, cle }.
// Réponse : { ok, avoirId, code, montant, points, pointsRestants, modeAvoirActif, rejoue }.
// L'avoir se dépense ensuite dans la vente par le moyen de paiement « avoir »
// (référence = `code`). `modeAvoirActif` faux = ce moyen n'est pas encore proposé
// dans les réglages de la caisse : l'avoir existe, mais ne pourra être utilisé qu'après.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { erreurs } from "@/lib/pos/erreurs";
import { journaliserAudit } from "@/lib/pos/audit";
import { lireReglagesPos } from "@/lib/pos/flags";
import { avecIdempotence, avecRepriseCollision } from "@/lib/pos/idempotence";
import { convertirPoints } from "@/lib/pos/fidelite";
import { arrondir, decimalesDevise } from "@/lib/pos/tarification";

const schema = z.object({
  clientId: z.string().trim().min(1).max(64),
  points: z.number().int().min(1).max(10_000_000),
  cle: z.string().trim().min(8).max(200).optional(),
});

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "vendre");
  const corps = await req.json();
  const d = schema.parse(corps);
  const cle = cleIdempotence(req, corps);
  if (!cle) throw erreurs.invalide("La demande n'a pas d'identifiant. Rechargez la page puis réessayez.");
  const [{ reglages }, tenant] = await Promise.all([
    lireReglagesPos(ctx.tenantId),
    prisma.tenant.findUniqueOrThrow({ where: { id: ctx.tenantId }, select: { devise: true } }),
  ]);
  const dec = decimalesDevise(tenant.devise);
  // Collision du code de l'avoir (tiré au hasard) : la transaction est rejouée avec un autre code.
  const { resultat, rejoue } = await avecRepriseCollision(() => avecIdempotence(ctx.tenantId, cle, "fidelite.convertir", async (tx) => {
    const r = await convertirPoints(tx, ctx, { clientId: d.clientId, points: d.points, reglages: reglages.fidelite, arrondir: (m) => arrondir(m, dec) });
    await journaliserAudit(tx, ctx, { action: "fidelite.points_convertis", entite: "Client", entiteId: d.clientId, avant: { points: r.pointsRestants + r.points }, apres: { points: r.pointsRestants, avoir: r.code, montant: r.montant } });
    return r;
  }, { userId: ctx.userId, appareilId: ctx.appareilId }));
  return { ok: true, ...resultat, modeAvoirActif: reglages.paiements.modes.includes("avoir"), rejoue };
});
