// Journal d'audit de la caisse — LECTURE SEULE (droit : voir_audit).
// GET /api/pos/audit?action=&userId=&caisseId=&entite=&entiteId=&debut=&fin=&curseur=&limite=
//   Lignes de la plus récente à la plus ancienne, avec l'état avant / après.
//   `curseur` = `seq` de la dernière ligne reçue. `filtres` liste les actions,
//   entités, personnes et caisses présentes dans le journal de la boutique.
// Aucune écriture n'existe sur cette route : le journal ne se modifie pas.
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "voir_audit");
  const p = new URL(req.url).searchParams;
  const limite = Math.min(Math.max(Number(p.get("limite")) || 50, 1), 200);
  const texte = (cle: string) => p.get(cle)?.trim() || undefined;
  const date = (cle: string) => { const d = p.get(cle) ? new Date(p.get(cle)!) : null; return d && !Number.isNaN(d.getTime()) ? d : undefined; };
  const curseur = Number(p.get("curseur"));
  const debut = date("debut"), fin = date("fin");

  const [entrees, actions, entites, personnes, caisses] = await Promise.all([
    prisma.journalAudit.findMany({
      where: {
        tenantId: ctx.tenantId,
        action: texte("action"), userId: texte("userId"), caisseId: texte("caisseId"), entite: texte("entite"), entiteId: texte("entiteId"),
        ...(debut || fin ? { createdAt: { gte: debut, lte: fin } } : {}),
        ...(Number.isInteger(curseur) && curseur > 0 ? { seq: { lt: curseur } } : {}),
      },
      orderBy: { seq: "desc" }, take: limite + 1,
    }),
    prisma.journalAudit.groupBy({ by: ["action"], where: { tenantId: ctx.tenantId }, _count: { _all: true } }),
    prisma.journalAudit.groupBy({ by: ["entite"], where: { tenantId: ctx.tenantId } }),
    prisma.journalAudit.groupBy({ by: ["userId", "userNom"], where: { tenantId: ctx.tenantId, userId: { not: null } } }),
    prisma.caisse.findMany({ where: { tenantId: ctx.tenantId }, select: { id: true, nom: true, magasin: { select: { nom: true } } } }),
  ]);
  const page = entrees.slice(0, limite);
  const utilisateurs = new Map<string, string>();
  for (const x of personnes) if (x.userId) utilisateurs.set(x.userId, x.userNom ?? utilisateurs.get(x.userId) ?? "Utilisateur");
  return {
    entrees: page,
    curseurSuivant: entrees.length > limite ? page[page.length - 1].seq : null,
    filtres: {
      actions: actions.map((a) => ({ action: a.action, nombre: a._count._all })).sort((a, b) => a.action.localeCompare(b.action)),
      entites: entites.map((e) => e.entite).sort(),
      utilisateurs: [...utilisateurs].map(([id, nom]) => ({ id, nom })),
      caisses: caisses.map((c) => ({ id: c.id, nom: `${c.magasin.nom} — ${c.nom}` })),
    },
  };
});
