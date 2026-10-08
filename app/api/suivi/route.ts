import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleTelephone } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const numero = searchParams.get("numero")?.trim();
  // Même numéro saisi avec ou sans indicatif (+237, 00237…)
  const tel = cleTelephone(searchParams.get("telephone"));

  if (!numero || tel.length < 9) {
    return NextResponse.json({ error: "Numéro de commande et téléphone requis" }, { status: 400 });
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
      // Jamais trackingToken : /api/tracking/[token] montre le code de livraison au client,
      // et le livreur connaît numéro + téléphone. La carte part de ces champs-ci.
      clientTelephone: true,
      livreurNom: true,
      livreurPosition: true,
      latitudeClient: true,
      longitudeClient: true,
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

  // Même réponse si le téléphone ne correspond pas : pas de parcours des numéros pour lire les adresses
  if (!commande || cleTelephone(commande.clientTelephone) !== tel) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const { clientTelephone, ...reste } = commande;
  return NextResponse.json({ commande: reste });
}
