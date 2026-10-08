import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STATUTS_COURSE_ACTIVE } from "@/lib/commandes";

// Lien livreur (livreurToken) : valable seulement pendant la course. Livrée ou
// annulée, il ne donne plus ni l'adresse du client ni l'envoi de position.
const COURSE_TERMINEE = { error: "Cette course est terminée : ce lien n'est plus actif." };

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
      trackingToken: true, livreurToken: true, codeLivraison: true, expedieeAt: true, livreeAt: true, echecRaison: true,
      lignes: { select: { nom: true, quantite: true, prix: true, imageUrl: true, produitId: true } },
      tenant: { select: { nomBoutique: true, logoUrl: true, slug: true } },
    },
  });
  if (!commande) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  // Ne pas exposer livreurToken au client (uniquement trackingToken)
  const isLivreurToken = commande.livreurToken === token;
  if (isLivreurToken && !STATUTS_COURSE_ACTIVE.includes(commande.statut)) return NextResponse.json(COURSE_TERMINEE, { status: 410 });

  return NextResponse.json({
    commande: {
      ...commande,
      livreurToken: isLivreurToken ? commande.livreurToken : undefined,
      // Le code prouve la remise au client : jamais exposé au lien livreur, et inutile une fois livrée
      codeLivraison: !isLivreurToken && ["expediee", "tentative_echouee"].includes(commande.statut) ? commande.codeLivraison : undefined,
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
    if (!STATUTS_COURSE_ACTIVE.includes(commande.statut)) return NextResponse.json(COURSE_TERMINEE, { status: 410 });

    // Identité affichée au client : jamais réécrite par le lien. Livreur assigné (compte) :
    // elle vient de l'assignation. Livreur externe : sa première déclaration fait foi.
    const externe = !commande.livreurId;
    await prisma.commande.update({
      where: { id: commande.id },
      data: {
        livreurPosition: { lat, lng, updatedAt: new Date().toISOString() },
        ...(externe && nom && !commande.livreurNom ? { livreurNom: String(nom).slice(0, 60) } : {}),
        ...(externe && telephone && !commande.livreurTelephone ? { livreurTelephone: String(telephone).slice(0, 30) } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
