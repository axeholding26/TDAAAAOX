import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notifierClientWhatsApp } from "@/lib/whatsapp";
import { TRANSITIONS_VALIDES, livraisonStatutPour } from "@/lib/commandes";
import { capturerCommissionAffiliation } from "@/lib/affiliation";
import { quotaCommandesAtteint } from "@/lib/abonnement";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { statut, echecRaison } = await req.json();
  const role = (session.user as any)?.role;
  const tenantId = (session.user as any)?.tenantId;

  const commande = await prisma.commande.findUnique({
    where: { id },
    include: { escrow: true, commission: true, tenant: { select: { id: true, slug: true, nomBoutique: true, commissionRate: true } } },
  });

  if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  if (await quotaCommandesAtteint(commande.tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à gérer vos commandes.", code: "quota_atteint" }, { status: 403 });
  }

  if (role === "livreur") {
    const livreur = await prisma.livreur.findFirst({
      where: { userId: (session.user as any)?.id, tenantId: commande.tenantId },
    });
    if (!livreur || commande.livreurId !== livreur.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (statut !== "livree" && statut !== "tentative_echouee") {
      return NextResponse.json({ error: "Le livreur peut seulement marquer comme livré ou signaler un échec" }, { status: 403 });
    }
  } else {
    if (commande.tenantId !== tenantId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const statutsValides = TRANSITIONS_VALIDES[commande.statut] || [];
  if (!statutsValides.includes(statut)) {
    return NextResponse.json({ error: `Transition invalide : ${commande.statut} → ${statut}` }, { status: 400 });
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // dejaVente : paiement en ligne déjà reçu (wallet crédité dans le webhook)
  const dejaVente = commande.paiementStatut === "completed";
  // dejaCommission : livraison déjà traitée (analytics déjà enregistrée)
  const dejaCommission = commande.commission?.statut === "captured";

  await prisma.$transaction(async (tx) => {
    await tx.commande.update({
      where: { id },
      data: {
        statut,
        livraisonStatut: livraisonStatutPour(statut),
        // COD : marquer le paiement complété à la livraison
        ...(statut === "livree" && !dejaVente ? { paiementStatut: "completed" } : {}),
        ...(statut === "tentative_echouee" ? { echecRaison: echecRaison || null, echecCount: { increment: 1 } } : {}),
        updatedAt: now,
      },
    });

    if (statut === "livree") {
      // Libérer l'escrow si existant (produits digitaux avec retenue)
      if (commande.escrow && commande.escrow.statut !== "released") {
        await tx.escrow.update({
          where: { commandeId: id },
          data: { statut: "released", releasedAt: now },
        });
      }
      // Capturer la commission si existante
      if (commande.commission && commande.commission.statut !== "captured") {
        await tx.commission.update({
          where: { commandeId: id },
          data: { statut: "captured", capturedAt: now },
        });
      }
      // Enregistrer la vente dans le CA à chaque livraison confirmée
      // (garde via dejaCommission pour éviter les doublons)
      if (!dejaCommission) {
        await tx.analytics.create({
          data: {
            tenantId: commande.tenantId,
            type: "purchase",
            date: today,
            valeur: commande.montantTotal / 10000,
            metadata: { commandeId: id, source: "marchand_livree" },
          },
        });
      }
    }
  });

  if (statut === "livree") {
    await capturerCommissionAffiliation(id).catch(() => {});
  }

  // Pas de crédit wallet pour les commandes COD : le client paie le marchand
  // directement (espèces/mobile money à la livraison), Axso ne reçoit jamais
  // cet argent via NotchPay — le wallet retirable ne doit refléter QUE l'argent
  // réellement encaissé par Axso (voir lib/wallet.ts). La vente reste comptée
  // dans les analytics/CA ci-dessus, mais jamais dans le solde retirable.

  const { envoyeAuto, whatsappUrl } = await notifierClientWhatsApp({
    telephone: commande.clientTelephone,
    statut,
    numero: commande.numero,
    boutique: commande.tenant.nomBoutique,
    slug: commande.tenant.slug,
    trackingToken: commande.trackingToken,
    tenantId: commande.tenantId,
  });

  return NextResponse.json({ success: true, statut, envoyeAuto, whatsappUrl });
}
