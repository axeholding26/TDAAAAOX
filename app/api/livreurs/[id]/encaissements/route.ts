import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireNiveau } from "@/lib/permissions-server";
import { auth } from "@/lib/auth";
import { aRemettre } from "@/lib/gains-livreur";

// GET — cash COD collecté par un livreur, non encore remis au marchand.
// Accessible par le livreur lui-même (lecture seule — il ne peut pas se
// marquer remis, voir /api/commandes/remise-cod) ou par le marchand : son propre
// livreur, ou un livreur plateforme qui a livré pour lui (ses commandes seulement).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const userId = (session.user as any)?.id;
  const tenantId = (session.user as any)?.tenantId;

  const livreur = await prisma.livreur.findUnique({ where: { id } });
  if (!livreur) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const estLeLivreur = livreur.userId === userId;
  // Marchand = droit « commandes » sur la boutique (jamais déduit de User.role).
  const estLeMarchand = !estLeLivreur && !!tenantId && !(await requireNiveau(session, "commandes", "lecture"))
    && (livreur.tenantId === tenantId || (livreur.tenantId === null && !!(await prisma.commande.findFirst({ where: { livreurId: id, tenantId }, select: { id: true } }))));
  if (!estLeLivreur && !estLeMarchand) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const commandes = await prisma.commande.findMany({
    where: {
      livreurId: id,
      ...(estLeLivreur ? {} : { tenantId }),
      methodePaiement: { in: ["whatsapp_cod", "direct_cod"] },
      statut: "livree",
      codRemis: false,
    },
    select: {
      id: true, numero: true, clientNom: true, montantTotal: true, devise: true, updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  // Part du livreur gardée sur les espèces : le marchand attend encaissé − gain.
  const gains = new Map((await prisma.gainLivreur.findMany({ where: { commandeId: { in: commandes.map(c => c.id) } }, select: { commandeId: true, montant: true } })).map(g => [g.commandeId, g.montant]));
  const lignes = commandes.map(c => ({ ...c, gainLivreur: gains.get(c.id) ?? 0, aRemettre: aRemettre(c.montantTotal, gains.get(c.id) ?? 0) }));

  // Jamais d'addition de devises différentes.
  const totaux: Record<string, { encaisse: number; gainLivreur: number; aRemettre: number }> = {};
  for (const c of lignes) {
    const t = (totaux[c.devise] ??= { encaisse: 0, gainLivreur: 0, aRemettre: 0 });
    t.encaisse += c.montantTotal; t.gainLivreur += c.gainLivreur; t.aRemettre += c.aRemettre;
  }

  return NextResponse.json({ commandes: lignes, totaux, livreur: { id: livreur.id, nom: livreur.nom } });
}
