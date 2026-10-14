import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normaliserTelephone } from "@/lib/devise-convert";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// Public : limité pour qu'on ne puisse pas essayer des couples numéro/téléphone à la chaîne.
const limite = rateLimit({ windowMs: 15 * 60_000, max: 30, keyPrefix: "suivi" });

export async function GET(req: Request) {
  const rl = limite.check(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);
  const { searchParams } = new URL(req.url);
  const numero = searchParams.get("numero")?.trim();
  // Même numéro saisi avec ou sans indicatif (+237, 00237…), pays à 8 ou 9 chiffres
  const saisi = searchParams.get("telephone");

  if (!numero || (saisi ?? "").replace(/\D/g, "").length < 8) {
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
  if (!commande || !memeTelephone(saisi, commande.clientTelephone, commande.pays)) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  const { clientTelephone, ...reste } = commande;
  return NextResponse.json({ commande: reste });
}

// Comparaison via l'indicatif du pays de la commande ; à défaut (numéro ancien mal
// formé), l'ancienne règle des 9 derniers chiffres.
function memeTelephone(a: string | null, b: string | null, pays: string | null): boolean {
  const na = normaliserTelephone(a, pays), nb = normaliserTelephone(b, pays);
  if (na && nb) return na === nb;
  const da = (a ?? "").replace(/\D/g, "").slice(-9), db = (b ?? "").replace(/\D/g, "").slice(-9);
  return da.length === 9 && da === db;
}
