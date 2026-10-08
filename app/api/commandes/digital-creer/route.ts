import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererNumeroCommande } from "@/lib/utils";
import { prixClient, reductionPromo } from "@/lib/pricing";
import { fraisLivraisonServeur } from "@/lib/livraison";
import { codePays } from "@/lib/devise-convert";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  try {
    // Prix, total et devise NE viennent JAMAIS du navigateur : recalculés depuis la
    // base (même formule que la vitrine) — sinon on pouvait payer le prix de son choix.
    // Commande payée en ligne : produits digitaux et dropshipping (expédié par le fournisseur).
    const { tenantId, client, items, codeAffiliation, codePromo: codeSaisi, zone } = await req.json();

    if (!tenantId || !items?.length || !client?.nom?.trim() || !client?.email?.trim() || !client?.telephone?.trim()) {
      return NextResponse.json({ error: "Nom, email et téléphone obligatoires" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.statut !== "active") {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    // Refuse la commande avant paiement si un produit digital ne peut plus être
    // livré — limite d'exemplaires atteinte (fichier) ou plus de clé disponible
    // (licence). Mieux vaut bloquer ici que faire payer un client pour rien.
    const produits = await prisma.produit.findMany({
      where: { id: { in: items.map((i: any) => String(i.produitId)) }, tenantId, actif: true },
      select: {
        id: true, nom: true, type: true, prix: true, images: true,
        produitFichier: { select: { limitAchats: true } },
        licenceProduit: { select: { id: true, cles: { where: { statut: "disponible" }, select: { id: true }, take: 1 } } },
      },
    });
    if (produits.length !== new Set(items.map((i: any) => String(i.produitId))).size) {
      return NextResponse.json({ error: "Produit introuvable dans cette boutique" }, { status: 400 });
    }
    if (produits.some((p) => p.type === "physique")) {
      return NextResponse.json({ error: "Ce produit se paie à la livraison" }, { status: 400 });
    }
    // Dropshipping : une vraie adresse de livraison est obligatoire.
    const aExpedier = produits.some((p) => p.type === "dropshipping");
    if (aExpedier && (!client?.adresse?.trim() || !(zone || client?.ville)?.trim())) {
      return NextResponse.json({ error: "Adresse et ville de livraison obligatoires" }, { status: 400 });
    }
    const taux = tenant.commissionRate ?? 0.06;
    const lignes = items.map((item: any) => {
      const p = produits.find((x) => x.id === String(item.produitId))!;
      return { produitId: p.id, nom: p.nom, prix: prixClient(p.prix, taux, p.type), quantite: Math.min(Math.max(Math.floor(Number(item.quantite) || 1), 1), 10), imageUrl: p.images[0] ?? null, variante: item.variante || null };
    });
    const sousTotal = lignes.reduce((s: number, l: { prix: number; quantite: number }) => s + l.prix * l.quantite, 0);
    const promo = codeSaisi ? await prisma.codePromo.findFirst({ where: { tenantId, code: String(codeSaisi).toUpperCase(), actif: true } }) : null;
    const reduction = reductionPromo(promo, sousTotal);
    const montantLivraison = aExpedier ? await fraisLivraisonServeur({ tenantId, pays: codePays(client?.pays), zone, montantCommande: sousTotal - reduction }) : 0;
    const total = sousTotal - reduction + montantLivraison;
    const devise = tenant.devise;

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
        adresseLivraison: aExpedier ? client.adresse.trim() : "Digital",
        ville: aExpedier ? (zone || client.ville).trim() : "Digital",
        montantLivraison,
        // Suivi de l'expédition (page /tracking) et facture, comme une commande physique.
        trackingToken: aExpedier ? randomBytes(20).toString("hex") : null,
        pays: client.pays || "—",
        montantSousTotal: sousTotal,
        montantReduction: reduction,
        codePromoId: promo && reduction > 0 ? promo.id : null,
        montantTotal: total,
        devise,
        statut: "en_attente",
        paiementStatut: "pending",
        methodePaiement: "en_attente",
        codeAffiliation: codeAffiliation || null,
        lignes: { create: lignes },
      },
    });

    return NextResponse.json({ commandeId: commande.id, numero: commande.numero, total, montantLivraison, devise });
  } catch (err) {
    console.error("[digital-creer]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
