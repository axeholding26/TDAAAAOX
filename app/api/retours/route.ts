import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quotaCommandesAtteint } from "@/lib/abonnement";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const statut = searchParams.get("statut");

  const retours = await prisma.retourRMA.findMany({
    where: {
      tenantId,
      ...(statut ? { statut } : {}),
    },
    include: {
      commande: {
        select: { numero: true, montantTotal: true, devise: true, createdAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const stats = {
    total: await prisma.retourRMA.count({ where: { tenantId } }),
    ouverts: await prisma.retourRMA.count({ where: { tenantId, statut: "ouvert" } }),
    enCours: await prisma.retourRMA.count({ where: { tenantId, statut: "en_cours" } }),
    acceptes: await prisma.retourRMA.count({ where: { tenantId, statut: "accepte" } }),
  };

  return NextResponse.json({ retours, stats });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à gérer vos commandes.", code: "quota_atteint" }, { status: 403 });
  }

  const body = await req.json();
  const { commandeId, clientNom, clientEmail, raison, description, type, montant, preuveUrls } = body;

  if (!commandeId || !clientNom || !clientEmail || !raison) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  // Verify the order belongs to this tenant
  const commande = await prisma.commande.findFirst({ where: { id: commandeId, tenantId } });
  if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  const retour = await prisma.retourRMA.create({
    data: {
      tenantId,
      commandeId,
      clientNom,
      clientEmail,
      raison,
      description: description ?? null,
      type: type ?? "remboursement",
      montant: montant ?? commande.montantTotal,
      preuveUrls: preuveUrls ?? [],
    },
  });

  return NextResponse.json({ retour }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à gérer vos commandes.", code: "quota_atteint" }, { status: 403 });
  }

  const body = await req.json();
  const { id, statut, notes, montant } = body;
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const existing = await prisma.retourRMA.findFirst({ where: { id, tenantId } });
  if (!existing) return NextResponse.json({ error: "Retour introuvable" }, { status: 404 });

  const retour = await prisma.retourRMA.update({
    where: { id },
    data: {
      ...(statut ? { statut } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(montant !== undefined ? { montant } : {}),
    },
  });

  // If accepted and refund: restore stock for items in the order
  if (statut === "accepte" && existing.type === "remboursement") {
    const lignes = await prisma.ligneCommande.findMany({ where: { commandeId: existing.commandeId } });
    for (const ligne of lignes) {
      await prisma.produit.update({
        where: { id: ligne.produitId },
        data: { stock: { increment: ligne.quantite } },
      }).catch(() => null);
    }
    // Marquer la commande en retour (Commande.statut garde sa valeur légitime
    // — livrée/expédiée — le "remboursee" n'existe dans aucune des transitions
    // valides de statut/route.ts et cassait le state machine ; on utilise
    // livraisonStatut, prévu pour ce cas)
    await prisma.commande.update({
      where: { id: existing.commandeId },
      data: { livraisonStatut: "retour" },
    }).catch(() => null);
  }

  return NextResponse.json({ retour });
}
