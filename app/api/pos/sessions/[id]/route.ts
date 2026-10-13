// Détail d'une session de caisse : montant attendu, mouvements, règlements par moyen.
// GET /api/pos/sessions/:id — droit : voir_caisse (toute session), ou
// fermer_caisse / ouvrir_caisse pour une session de sa propre caisse.
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { detailAttendu } from "@/lib/pos/session-caisse";

export const GET = routePos<{ id: string }>(async (ctx, _req, { id }) => {
  exigerUnDroit(ctx, "voir_caisse", "fermer_caisse", "ouvrir_caisse");
  const session = await prisma.sessionCaisse.findFirst({
    where: { id, tenantId: ctx.tenantId, ...(aDroit(ctx, "voir_caisse") ? {} : { caisseId: ctx.caisseId }), ...(ctx.magasinIds?.length ? { magasinId: { in: ctx.magasinIds } } : {}) },
    include: { mouvements: { orderBy: { createdAt: "asc" } }, caisse: { select: { nom: true, magasin: { select: { id: true, nom: true } } } } },
  });
  if (!session) throw new ErreurPos("introuvable", 404, "Cette session de caisse est introuvable.");
  const [detail, paiements, ventes] = await Promise.all([
    detailAttendu(prisma, id),
    prisma.paiementVente.groupBy({ by: ["mode", "declaratif"], where: { sessionCaisseId: id, statut: { in: ["confirme", "rembourse"] } }, _sum: { montant: true }, _count: { _all: true } }),
    prisma.commande.aggregate({ where: { sessionCaisseId: id, statut: { not: "annulee" } }, _sum: { montantTotal: true, montantPaye: true }, _count: { _all: true } }),
  ]);
  return {
    session, detail,
    // `nonVerifie` : total déclaré par les caissiers (Mobile Money, carte…), à rapprocher.
    paiements: paiements.map((p) => ({ mode: p.mode, nonVerifie: p.declaratif, montant: p._sum.montant ?? 0, nombre: p._count._all })),
    ventes: { nombre: ventes._count._all, total: ventes._sum.montantTotal ?? 0, encaisse: ventes._sum.montantPaye ?? 0 },
  };
});
