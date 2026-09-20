import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notifierLivreurAssigneWhatsApp } from "@/lib/whatsapp";
import { quotaCommandesAtteint } from "@/lib/abonnement";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  const role = (session.user as any)?.role;

  if (role !== "owner" && role !== "editeur") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à gérer vos commandes.", code: "quota_atteint" }, { status: 403 });
  }

  const { id } = await params;
  const { livreurId } = await req.json();

  const commande = await prisma.commande.findUnique({
    where: { id },
    include: { tenant: { select: { nomBoutique: true, slug: true } } },
  });
  if (!commande || commande.tenantId !== tenantId) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  let livreur: { id: string; nom: string; telephone: string } | null = null;
  if (livreurId) {
    // Accept both tenant livreurs and platform-wide livreurs (tenantId null)
    livreur = await prisma.livreur.findFirst({
      where: { id: livreurId, actif: true },
      select: { id: true, nom: true, telephone: true },
    });
    if (!livreur) {
      return NextResponse.json({ error: "Livreur introuvable" }, { status: 404 });
    }
  }

  const ancienLivreurId = commande.livreurId;

  const updated = await prisma.commande.update({
    where: { id },
    data: {
      livreurId: livreurId || null,
      livreurNom: livreur?.nom ?? null,
      livreurTelephone: livreur?.telephone ?? null,
    },
    include: { livreur: true },
  });

  // Create notification for newly assigned livreur
  if (livreurId && livreurId !== ancienLivreurId) {
    await prisma.notification.create({
      data: {
        livreurId,
        type: "nouvelle_commande",
        titre: "Nouvelle livraison assignée",
        message: `Commande #${commande.numero} — ${commande.adresseLivraison}, ${commande.ville}`,
        commandeId: id,
      },
    }).catch(() => {});

    // Notifier le client par WhatsApp qu'un livreur a été assigné
    if (commande.clientTelephone) {
      await notifierLivreurAssigneWhatsApp({
        telephone: commande.clientTelephone,
        numero: commande.numero,
        boutique: commande.tenant.nomBoutique,
        slug: commande.tenant.slug,
        trackingToken: commande.trackingToken,
        livreurNom: livreur!.nom,
        tenantId: commande.tenantId,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true, commande: updated });
}
