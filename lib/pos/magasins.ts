// Magasins et caisses d'une boutique. SERVEUR uniquement.
//
// Organisation : boutique (Tenant) → magasins → caisses. Un magasin vend le
// stock de SON entrepôt (Magasin.entrepotId). Une boutique qui n'a encore rien
// configuré reçoit, à sa première vente, « Magasin principal » + « Caisse 1 »
// adossés à son entrepôt principal : le petit commerçant n'a rien à régler.
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";
import { ErreurPos } from "./erreurs";

type Db = Prisma.TransactionClient | PrismaClient;

const estDoublon = (e: unknown) => (e as any)?.code === "P2002";

/** Entrepôt principal : celui marqué « principal », sinon le plus ancien entrepôt actif. */
export async function entrepotPrincipal(db: Db, tenantId: string): Promise<{ id: string } | null> {
  return db.entrepot.findFirst({
    where: { tenantId, actif: true },
    orderBy: [{ principal: "desc" }, { createdAt: "asc" }],
    select: { id: true },
  });
}

/** Entrepôt d'un magasin de la boutique (lève 404 si le magasin n'est pas à elle). */
export async function entrepotDuMagasin(db: Db, tenantId: string, magasinId: string): Promise<string> {
  const m = await db.magasin.findFirst({ where: { id: magasinId, tenantId }, select: { entrepotId: true } });
  if (!m) throw new ErreurPos("introuvable", 404, "Ce magasin est introuvable dans cette boutique.");
  return m.entrepotId;
}

/**
 * Premier magasin et première caisse de la boutique, créés s'ils manquent.
 * Sans danger en cas d'appels simultanés : les clés uniques (boutique + nom du
 * magasin, magasin + nom de la caisse) font retomber le second sur le premier.
 */
export async function assurerMagasinParDefaut(tenantId: string): Promise<{ magasinId: string; caisseId: string; entrepotId: string }> {
  const existant = await prisma.caisse.findFirst({
    where: { tenantId, actif: true, magasin: { actif: true } },
    orderBy: { createdAt: "asc" },
    select: { id: true, magasinId: true, magasin: { select: { entrepotId: true } } },
  });
  if (existant) return { magasinId: existant.magasinId, caisseId: existant.id, entrepotId: existant.magasin.entrepotId };

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { pays: true, adresse: true, telephone: true } });
  if (!tenant) throw new ErreurPos("introuvable", 404, "Cette boutique est introuvable.");

  let magasin = await prisma.magasin.findFirst({ where: { tenantId, actif: true }, orderBy: { createdAt: "asc" } });
  if (!magasin) {
    const entrepot = (await entrepotPrincipal(prisma, tenantId))
      ?? (await prisma.entrepot.create({ data: { tenantId, nom: "Entrepôt principal", pays: tenant.pays, principal: true }, select: { id: true } }));
    magasin = await prisma.magasin
      .create({ data: { tenantId, nom: "Magasin principal", entrepotId: entrepot.id, pays: tenant.pays, adresse: tenant.adresse, telephone: tenant.telephone } })
      .catch(async (e) => {
        if (!estDoublon(e)) throw e;
        return prisma.magasin.findFirstOrThrow({ where: { tenantId, nom: "Magasin principal" } });
      });
  }
  const magasinId = magasin.id;
  const caisse = await prisma.caisse
    .create({ data: { tenantId, magasinId, nom: "Caisse 1" }, select: { id: true } })
    .catch(async (e) => {
      if (!estDoublon(e)) throw e;
      return prisma.caisse.findFirstOrThrow({ where: { magasinId, nom: "Caisse 1" }, select: { id: true } });
    });
  return { magasinId, caisseId: caisse.id, entrepotId: magasin.entrepotId };
}

/**
 * Caisse sur laquelle travaille une requête : celle demandée (vérifiée : même
 * boutique, active, magasin autorisé au membre), sinon la première caisse
 * autorisée, sinon la caisse par défaut. `magasinIds` vide = tous les magasins.
 */
export async function resoudreCaisse(tenantId: string, p: { caisseId?: string | null; magasinIds?: string[] }): Promise<{ magasinId: string; caisseId: string }> {
  const limites = p.magasinIds?.length ? p.magasinIds : null;
  if (p.caisseId) {
    const c = await prisma.caisse.findFirst({ where: { id: p.caisseId, tenantId, actif: true }, select: { id: true, magasinId: true } });
    if (!c) throw new ErreurPos("introuvable", 404, "Cette caisse est introuvable ou a été désactivée.");
    if (limites && !limites.includes(c.magasinId)) throw new ErreurPos("non_autorise", 403, "Vous n'êtes pas affecté à ce magasin. Demandez à un responsable.");
    return { magasinId: c.magasinId, caisseId: c.id };
  }
  if (limites) {
    const c = await prisma.caisse.findFirst({
      where: { tenantId, actif: true, magasinId: { in: limites }, magasin: { actif: true } },
      orderBy: { createdAt: "asc" }, select: { id: true, magasinId: true },
    });
    if (!c) throw new ErreurPos("non_autorise", 403, "Aucune caisse n'est ouverte à votre compte dans vos magasins. Demandez à un responsable.");
    return { magasinId: c.magasinId, caisseId: c.id };
  }
  const d = await assurerMagasinParDefaut(tenantId);
  return { magasinId: d.magasinId, caisseId: d.caisseId };
}

/** Magasins de la boutique avec leurs caisses et la session ouverte de chacune. */
export async function listerMagasins(tenantId: string, magasinIds?: string[]) {
  const magasins = await prisma.magasin.findMany({
    where: { tenantId, ...(magasinIds?.length ? { id: { in: magasinIds } } : {}) },
    orderBy: { createdAt: "asc" },
    include: {
      entrepot: { select: { id: true, nom: true, principal: true } },
      caisses: { orderBy: { createdAt: "asc" } },
    },
  });
  const ouvertes = await prisma.sessionCaisse.findMany({
    where: { tenantId, statut: "ouverte" },
    select: { id: true, caisseId: true, ouvertePar: true, ouverteAt: true },
  });
  return magasins.map((m) => ({
    ...m,
    caisses: m.caisses.map((c) => ({ ...c, sessionOuverte: ouvertes.find((s) => s.caisseId === c.id) ?? null })),
  }));
}
