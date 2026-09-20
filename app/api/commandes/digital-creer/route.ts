import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererNumeroCommande } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { tenantId, client, items, total, devise, codeAffiliation } = await req.json();

    if (!tenantId || !items?.length || !client?.nom || !client?.email) {
      return NextResponse.json({ error: "Nom et email obligatoires" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.statut !== "active") {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    // Refuse la commande avant paiement si un produit digital ne peut plus être
    // livré — limite d'exemplaires atteinte (fichier) ou plus de clé disponible
    // (licence). Mieux vaut bloquer ici que faire payer un client pour rien.
    const produits = await prisma.produit.findMany({
      where: { id: { in: items.map((i: any) => i.produitId) } },
      select: {
        id: true, nom: true, type: true,
        produitFichier: { select: { limitAchats: true } },
        licenceProduit: { select: { id: true, cles: { where: { statut: "disponible" }, select: { id: true }, take: 1 } } },
      },
    });
    for (const p of produits) {
      if (p.type === "fichier" && p.produitFichier?.limitAchats != null) {
        const ventes = await prisma.commande.count({
          where: { paiementStatut: "completed", lignes: { some: { produitId: p.id } } },
        });
        if (ventes >= p.produitFichier.limitAchats) {
          return NextResponse.json({ error: `"${p.nom}" a atteint sa limite d'exemplaires disponibles` }, { status: 409 });
        }
      }
      if (p.type === "licence" && p.licenceProduit && p.licenceProduit.cles.length === 0) {
        return NextResponse.json({ error: `"${p.nom}" est en rupture de clés de licence — contactez le vendeur` }, { status: 409 });
      }
    }

    // Upsert client par email (clé naturelle pour les achats digitaux)
    let clientRecord = await prisma.client.findFirst({
      where: { tenantId, email: client.email },
    });
    if (!clientRecord) {
      clientRecord = await prisma.client.create({
        data: {
          tenantId,
          nom: client.nom,
          email: client.email,
          telephone: client.telephone || null,
          pays: client.pays || null,
        },
      });
    }

    const commande = await prisma.commande.create({
      data: {
        tenantId,
        numero: genererNumeroCommande(),
        clientId: clientRecord.id,
        clientNom: client.nom,
        clientEmail: client.email,
        clientTelephone: client.telephone || "",
        adresseLivraison: "Digital",
        ville: "Digital",
        pays: client.pays || "—",
        montantSousTotal: total,
        montantTotal: total,
        devise,
        statut: "en_attente",
        paiementStatut: "pending",
        methodePaiement: "en_attente",
        codeAffiliation: codeAffiliation || null,
        lignes: {
          create: items.map((item: any) => ({
            produitId: item.produitId,
            nom: item.nom,
            prix: item.prix,
            quantite: item.quantite,
            imageUrl: item.imageUrl || null,
            variante: item.variante || null,
          })),
        },
      },
    });

    return NextResponse.json({ commandeId: commande.id, numero: commande.numero });
  } catch (err) {
    console.error("[digital-creer]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
