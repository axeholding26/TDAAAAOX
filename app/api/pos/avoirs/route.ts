// Avoirs clients (émis par un retour, utilisables comme moyen de paiement « avoir »).
// GET /api/pos/avoirs?code=  — un avoir par son code exact (avant de l'accepter en paiement).
// GET /api/pos/avoirs?clientId= — avoirs d'un client.
// Pas de liste ni de recherche par début de code : un code d'avoir se dépense comme de l'argent.
// Droit : vendre, encaisser, retour ou voir_caisse.
// `utilisable` : actif, non expiré, solde positif — ce que lib/pos/paiements.ts exigera au paiement.
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { erreurs } from "@/lib/pos/erreurs";

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "vendre", "encaisser", "retour", "voir_caisse");
  const p = new URL(req.url).searchParams;
  const code = p.get("code")?.trim();
  const clientId = p.get("clientId")?.trim();
  if (!code && !clientId) throw erreurs.invalide("Indiquez le code de l'avoir.");
  const avoirs = await prisma.avoirClient.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(code ? { code: { equals: code, mode: "insensitive" } } : {}),
      ...(clientId ? { clientId } : {}),
    },
    orderBy: { createdAt: "desc" }, take: code ? 1 : 50,
  });
  const clients = await prisma.client.findMany({ where: { tenantId: ctx.tenantId, id: { in: avoirs.flatMap((a) => (a.clientId ? [a.clientId] : [])) } }, select: { id: true, nom: true } });
  const maintenant = new Date();
  return {
    avoirs: avoirs.map((a) => ({
      id: a.id, code: a.code, montantInitial: a.montantInitial, solde: a.solde, statut: a.statut, createdAt: a.createdAt, expireAt: a.expireAt,
      clientId: a.clientId, clientNom: clients.find((c) => c.id === a.clientId)?.nom ?? null, retourId: a.retourId,
      utilisable: a.statut === "actif" && a.solde > 0 && (!a.expireAt || a.expireAt > maintenant),
    })),
  };
});
