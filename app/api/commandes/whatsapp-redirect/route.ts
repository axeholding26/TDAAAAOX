// API Route — Génération du lien WhatsApp pour commandes physiques/dropshipping
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMontant } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) {
      return NextResponse.json({ message: "Tenant introuvable" }, { status: 400 });
    }

    const body = await request.json();
    const { commandeId } = body as { commandeId: string };

    if (!commandeId) {
      return NextResponse.json({ message: "commandeId requis" }, { status: 400 });
    }

    // Récupérer la commande avec ses lignes, produits et le tenant
    const commande = await prisma.commande.findFirst({
      where: { id: commandeId, tenantId },
      include: {
        lignes: {
          include: {
            produit: { select: { type: true } },
          },
        },
        tenant: {
          select: {
            nomBoutique: true,
            devise: true,
            whatsappNumero: true,
          },
        },
      },
    });

    if (!commande) {
      return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });
    }

    // Vérifier que tous les produits sont physique ou dropshipping
    const typesInvalides = commande.lignes.filter(
      (l) => l.produit.type === "digital"
    );
    if (typesInvalides.length > 0) {
      return NextResponse.json(
        { message: "Cette commande contient des produits digitaux — utilisez le flux escrow." },
        { status: 400 }
      );
    }

    const devise = commande.devise || commande.tenant.devise || "XAF";

    // Construire les lignes du message
    const lignesTexte = commande.lignes
      .map((l) => `• ${l.nom} x${l.quantite} — ${formatMontant(l.prix * l.quantite, devise)}`)
      .join("\n");

    const message = [
      `Bonjour ${commande.tenant.nomBoutique} 👋`,
      ``,
      `Nouvelle commande #${commande.numero} :`,
      lignesTexte,
      ``,
      `Total : ${formatMontant(commande.montantTotal, devise)}`,
      `Client : ${commande.clientNom} (${commande.clientEmail})`,
      `Paiement : À la livraison`,
      ``,
      `Merci !`,
    ].join("\n");

    const messageEncode = encodeURIComponent(message);

    // Utiliser whatsappNumero si disponible, sinon lien générique
    const numero = commande.tenant.whatsappNumero;
    let url: string;

    if (numero) {
      // Nettoyer le numéro : garder uniquement "+" et chiffres
      const numeroNettoye = numero.replace(/[^\d+]/g, "");
      url = `https://wa.me/${numeroNettoye}?text=${messageEncode}`;
    } else {
      url = `https://wa.me/?text=${messageEncode}`;
    }

    return NextResponse.json({ url });
  } catch (err) {
    console.error("[whatsapp-redirect]", err);
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
