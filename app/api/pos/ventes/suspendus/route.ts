// Paniers mis en attente (un client part chercher son argent, le suivant passe).
// GET  /api/pos/ventes/suspendus — paniers en attente du magasin (droit : vendre).
// POST /api/pos/ventes/suspendus — met un panier en attente (droit : suspendre_panier).
//   Corps : schemaSuspension. Idempotent si une clé est fournie.
// Le contenu est gardé tel que saisi : les prix sont recalculés à la reprise.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleIdempotence, routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { avecIdempotence } from "@/lib/pos/idempotence";
import { schemaSuspension } from "@/lib/pos/schemas";
import { preparerPanier } from "@/lib/pos/vente";

export const GET = routePos(async (ctx) => {
  exigerDroit(ctx, "vendre");
  const paniers = await prisma.panierSuspendu.findMany({
    where: { tenantId: ctx.tenantId, magasinId: ctx.magasinId, statut: "suspendu" },
    orderBy: { createdAt: "desc" }, take: 50,
  });
  return { paniers };
});

export const POST = routePos(async (ctx, req) => {
  exigerDroit(ctx, "suspendre_panier");
  const corps = schemaSuspension.parse(await req.json());
  // Total indicatif (affichage de la liste), recalculé par le serveur.
  const { panier } = await preparerPanier(ctx, { lignes: corps.contenu.lignes, clientId: corps.clientId, remise: corps.contenu.remise, codePromo: corps.contenu.codePromo });
  const creer = async (db: Pick<typeof prisma, "panierSuspendu">) => {
    const p = await db.panierSuspendu.create({
      data: {
        tenantId: ctx.tenantId, magasinId: ctx.magasinId, caisseId: ctx.caisseId, creePar: ctx.userId,
        libelle: corps.libelle || null, clientId: corps.clientId ?? null, contenu: corps.contenu as Prisma.InputJsonValue, total: panier.total,
      },
    });
    return { id: p.id, libelle: p.libelle, total: p.total, createdAt: p.createdAt.toISOString() };
  };
  const cle = cleIdempotence(req, corps);
  if (!cle) return { ok: true, panier: await creer(prisma), rejoue: false };
  const { resultat, rejoue } = await avecIdempotence(ctx.tenantId, cle, "panier.suspendre", creer, { appareilId: ctx.appareilId, userId: ctx.userId });
  return { ok: true, panier: resultat, rejoue };
});
