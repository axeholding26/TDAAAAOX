// API Route — Dropshipping : Commandes en transit
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Statuts de livraison utilisés pour le dropshipping
// non_expediee → en_attente (à commander)
// commandee    → commandé chez le fournisseur
// expediee     → en transit / expédié
// livree       → livré au client

// ── GET — liste des commandes dropshipping à traiter ──────────────────────
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(request.url);
    const statut = searchParams.get("statut");      // filtre optionnel
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "30");

    // Filtrer les commandes qui contiennent au moins un produit dropshipping
    const where: any = {
      tenantId,
      lignes: {
        some: {
          produit: { type: "dropshipping" },
        },
      },
    };

    // Filtre sur le statut de livraison
    if (statut) {
      where.livraisonStatut = statut;
    } else {
      // Par défaut : exclure les livrées
      where.livraisonStatut = { not: "livree" };
    }

    const [commandes, total] = await Promise.all([
      prisma.commande.findMany({
        where,
        include: {
          lignes: {
            include: {
              produit: {
                select: {
                  id: true,
                  nom: true,
                  type: true,
                  nomFournisseur: true,
                  images: true,
                },
              },
            },
          },
          client: { select: { id: true, nom: true, email: true, telephone: true } },
        },
        // Triées par date croissante (les plus anciennes en premier = priorité)
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.commande.count({ where }),
    ]);

    // Enrichir avec les infos dropshipping
    const commandesEnrichies = commandes.map((cmd) => {
      const lignesDropship = cmd.lignes.filter((l) => l.produit?.type === "dropshipping");
      const fournisseurs = [...new Set(lignesDropship.map((l) => l.produit?.nomFournisseur).filter(Boolean))];

      return {
        ...cmd,
        lignesDropship,
        fournisseurs,
        attenteDays: Math.floor((Date.now() - new Date(cmd.createdAt).getTime()) / 86_400_000),
      };
    });

    return NextResponse.json({ commandes: commandesEnrichies, total, page, limit });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ── POST — confirmer commande auprès du fournisseur ───────────────────────
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const body = await request.json();

    const { commandeId, fournisseur, noteInterne } = body;
    if (!commandeId) return NextResponse.json({ message: "commandeId requis" }, { status: 400 });

    const commande = await prisma.commande.findFirst({
      where: { id: commandeId, tenantId },
    });
    if (!commande) return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });

    const updated = await prisma.commande.update({
      where: { id: commandeId },
      data: {
        livraisonStatut: "commandee",
        transporteur: fournisseur || commande.transporteur || "Fournisseur",
        noteClient: noteInterne || commande.noteClient || undefined,
      },
    });

    return NextResponse.json({ commande: updated });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

// ── PATCH — mettre à jour le numéro de suivi / statut ────────────────────
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const body = await request.json();

    const { commandeId, numeroSuivi, livraisonStatut, transporteur } = body;
    if (!commandeId) return NextResponse.json({ message: "commandeId requis" }, { status: 400 });

    const commande = await prisma.commande.findFirst({
      where: { id: commandeId, tenantId },
    });
    if (!commande) return NextResponse.json({ message: "Commande introuvable" }, { status: 404 });

    const updateData: any = {};
    if (numeroSuivi !== undefined) updateData.numeroSuivi = numeroSuivi;
    if (livraisonStatut !== undefined) updateData.livraisonStatut = livraisonStatut;
    if (transporteur !== undefined) updateData.transporteur = transporteur;

    // Si on ajoute un suivi → passer automatiquement à "expediee"
    if (numeroSuivi && !livraisonStatut) {
      updateData.livraisonStatut = "expediee";
    }

    const updated = await prisma.commande.update({
      where: { id: commandeId },
      data: updateData,
    });

    return NextResponse.json({ commande: updated });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
