import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST — client soumet un avis sur un produit
export async function POST(req: NextRequest) {
  try {
    const { tenantId, produitId, clientEmail, clientNom, note, titre, commentaire } = await req.json();

    if (!tenantId || !produitId || !clientEmail || !note) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }
    if (note < 1 || note > 5) {
      return NextResponse.json({ error: "Note invalide (1-5)" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.statut !== "active") {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const produit = await prisma.produit.findFirst({ where: { id: produitId, tenantId } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    // Upsert client par email
    let client = await prisma.client.findFirst({ where: { tenantId, email: clientEmail } });
    if (!client) {
      client = await prisma.client.create({
        data: { tenantId, nom: clientNom || "Anonyme", email: clientEmail },
      });
    }

    // Un seul avis par client par produit
    const existe = await prisma.avis.findFirst({ where: { tenantId, produitId, clientId: client.id } });
    if (existe) {
      return NextResponse.json({ error: "Vous avez déjà laissé un avis sur ce produit" }, { status: 409 });
    }

    // Vérifier achat (avis vérifié si commande livrée)
    const achat = await prisma.ligneCommande.findFirst({
      where: {
        produitId,
        commande: { tenantId, clientId: client.id, statut: "livree" },
      },
    });

    const avis = await prisma.avis.create({
      data: {
        tenantId,
        produitId,
        clientId: client.id,
        note: Math.round(note),
        titre:       titre?.trim()       || null,
        commentaire: commentaire?.trim() || null,
        verifie:  !!achat,
        approuve: false, // modération par défaut
      },
    });

    return NextResponse.json({ ok: true, avisId: avis.id, verifie: avis.verifie });
  } catch (err) {
    console.error("[api/avis POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
