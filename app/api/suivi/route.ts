import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const numero = searchParams.get("numero")?.trim();

  if (!numero) {
    return NextResponse.json({ error: "Numéro de commande manquant" }, { status: 400 });
  }

  const commande = await prisma.commande.findUnique({
    where: { numero },
    select: {
      id: true,
      numero: true,
      statut: true,
      paiementStatut: true,
      adresseLivraison: true,
      ville: true,
      pays: true,
      montantTotal: true,
      devise: true,
      numeroSuivi: true,
      transporteur: true,
      trackingToken: true,
      createdAt: true,
      updatedAt: true,
      tenant: {
        select: { nomBoutique: true, whatsapp: true, slug: true },
      },
      livreur: {
        select: { nom: true, telephone: true, disponible: true },
      },
      lignes: {
        select: { nom: true, quantite: true, prix: true, imageUrl: true, variante: true },
      },
    },
  });

  if (!commande) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  return NextResponse.json({ commande });
}
