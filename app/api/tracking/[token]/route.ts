import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET — client/marchand poll la position du livreur
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const commande = await prisma.commande.findFirst({
    where: { OR: [{ trackingToken: token }, { livreurToken: token }] },
    select: {
      id: true, numero: true, statut: true, livraisonStatut: true,
      clientNom: true, adresseExacte: true, adresseLivraison: true, ville: true,
      latitudeClient: true, longitudeClient: true, mapsLienClient: true,
      livreurPosition: true, livreurNom: true, livreurTelephone: true,
      trackingToken: true, livreurToken: true,
      lignes: { select: { nom: true, quantite: true, prix: true, imageUrl: true } },
      tenant: { select: { nomBoutique: true, logoUrl: true, slug: true } },
    },
  });
  if (!commande) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Ne pas exposer livreurToken au client (uniquement trackingToken)
  const isLivreurToken = commande.livreurToken === token;

  return NextResponse.json({
    commande: {
      ...commande,
      livreurToken: isLivreurToken ? commande.livreurToken : undefined,
    },
  });
}

// POST — livreur envoie sa position GPS
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const { lat, lng, nom, telephone } = await req.json();
    if (!lat || !lng) return NextResponse.json({ error: "lat/lng requis" }, { status: 400 });

    const commande = await prisma.commande.findFirst({
      where: { livreurToken: token },
    });
    if (!commande) return NextResponse.json({ error: "Token livreur invalide" }, { status: 404 });

    await prisma.commande.update({
      where: { id: commande.id },
      data: {
        livreurPosition: { lat, lng, updatedAt: new Date().toISOString() },
        ...(nom ? { livreurNom: nom } : {}),
        ...(telephone ? { livreurTelephone: telephone } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// PATCH — le livreur s'auto-enregistre (nom/téléphone) via son lien GPS.
// Volontairement limité à ces deux champs : changer statut/livraisonStatut
// doit toujours passer par /api/commandes/[id]/statut, seul endroit qui
// applique TRANSITIONS_VALIDES et les effets de bord (escrow, commission,
// analytics, notification WhatsApp).
export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const body = await req.json();
    const commande = await prisma.commande.findFirst({
      where: { livreurToken: token },
    });
    if (!commande) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    await prisma.commande.update({
      where: { id: commande.id },
      data: {
        livreurNom: body.livreurNom ?? undefined,
        livreurTelephone: body.livreurTelephone ?? undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
