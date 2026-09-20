import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { slug } = await req.json();

  const commande = await prisma.commande.findUnique({
    where: { id },
    include: { tenant: { select: { id: true, slug: true, commissionRate: true } } },
  });

  if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  if (commande.tenant.slug !== slug) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  if (commande.statut === "annulee") return NextResponse.json({ error: "Commande annulée" }, { status: 400 });
  if (commande.statut === "livree") return NextResponse.json({ ok: true, dejaDone: true });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Paiement en ligne : wallet déjà crédité dans le webhook → éviter le double crédit
  const dejaVente = commande.paiementStatut === "completed";

  await prisma.$transaction(async (tx) => {
    await tx.commande.update({
      where: { id },
      data: {
        statut: "livree",
        ...(dejaVente ? {} : { paiementStatut: "completed" }),
        updatedAt: now,
      },
    });

    // Enregistrer la vente dans le CA (s'applique qu'au COD ou au premier passage)
    await tx.analytics.create({
      data: {
        tenantId: commande.tenantId,
        type: "purchase",
        date: today,
        valeur: commande.montantTotal / 10000,
        metadata: { commandeId: id, source: "client_confirmation" },
      },
    });
  });

  // Pas de crédit wallet pour les commandes COD : le client paie le marchand
  // directement, Axso ne reçoit jamais cet argent via NotchPay — le solde
  // retirable ne doit refléter QUE l'argent réellement encaissé par Axso.

  return NextResponse.json({ ok: true });
}
