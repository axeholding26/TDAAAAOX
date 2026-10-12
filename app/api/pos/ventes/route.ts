// Ventes en caisse.
// POST /api/pos/ventes — enregistre une vente (droit : vendre). Corps : schemaVente.
//   Idempotente sur `cle` : rejouée, elle rend la vente d'origine avec
//   `rejoue: true` et le message « Cette vente a déjà été enregistrée… ».
// GET  /api/pos/ventes?curseur=&limite=&sessionCaisseId=&q= — dernières ventes
//   (droit : vendre → celles de sa caisse ; voir_caisse → toutes).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CANAL } from "@/lib/commandes";
import { quotaCommandesAtteint } from "@/lib/abonnement";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { schemaVente } from "@/lib/pos/schemas";
import { enregistrerVente } from "@/lib/pos/vente";

export const POST = routePos(async (ctx, req) => {
  const demande = schemaVente.parse(await req.json());
  // Même règle que l'ancienne caisse tant que le propriétaire n'a pas tranché
  // (le quota du palier gratuit compte les ventes en caisse — lib/abonnement.ts).
  if (await quotaCommandesAtteint(ctx.tenantId)) {
    throw new ErreurPos("quota_atteint", 403, "Le nombre de commandes du palier gratuit est atteint pour ce mois. Passez à un palier supérieur pour continuer à vendre en caisse.");
  }
  const vente = await enregistrerVente(ctx, demande);
  return NextResponse.json(
    { ...vente, ok: true, ...(vente.rejoue ? { message: "Cette vente a déjà été enregistrée. Aucun doublon n'a été créé." } : {}) },
    { status: vente.rejoue ? 200 : 201 },
  );
});

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "vendre", "voir_caisse");
  const p = new URL(req.url).searchParams;
  const limite = Math.min(Math.max(Number(p.get("limite")) || 30, 1), 100);
  const q = p.get("q")?.trim();
  const ventes = await prisma.commande.findMany({
    where: {
      tenantId: ctx.tenantId, canal: CANAL.POS,
      ...(aDroit(ctx, "voir_caisse") ? {} : { caisseId: ctx.caisseId }),
      ...(p.get("sessionCaisseId") ? { sessionCaisseId: p.get("sessionCaisseId") } : {}),
      ...(q ? { OR: [{ numero: { contains: q, mode: "insensitive" } }, { clientNom: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limite + 1,
    ...(p.get("curseur") ? { cursor: { id: p.get("curseur")! }, skip: 1 } : {}),
    select: {
      id: true, numero: true, createdAt: true, statut: true, clientId: true, clientNom: true, devise: true,
      montantTotal: true, montantPaye: true, montantReduction: true, methodePaiement: true,
      magasinId: true, caisseId: true, sessionCaisseId: true, vendeurId: true,
      _count: { select: { lignes: true } },
    },
  });
  const page = ventes.slice(0, limite);
  return { ventes: page, curseurSuivant: ventes.length > limite ? page[page.length - 1].id : null };
});
