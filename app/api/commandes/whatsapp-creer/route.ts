// Créer une commande physique (paiement à la livraison) + générer lien WhatsApp + tokens tracking/facture
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererNumeroCommande, formatMontant } from "@/lib/utils";
import { notifierMarchand } from "@/lib/notifications-marchand";
import { envoyerConfirmationCommande, envoyerAlerteNouvelleCommande } from "@/lib/email";
import { fraisLivraisonServeur } from "@/lib/livraison";
import { enregistrerConversionAffiliation } from "@/lib/affiliation";
import { randomBytes } from "crypto";

function genToken() { return randomBytes(20).toString("hex"); }

export async function POST(req: NextRequest) {
  try {
    const { tenantId, slug, client, items, total, devise, codePromo, localisation, canal, champPersonnalise, zone, codeAffiliation } = await req.json();
    const viaWhatsapp = canal !== "direct";

    if (!tenantId || !items?.length || !client?.nom || !client?.telephone) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.statut !== "active") {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const produitIds = items.map((i: any) => i.produitId).filter(Boolean);
    if (produitIds.length > 0) {
      const produits = await prisma.produit.findMany({ where: { id: { in: produitIds } }, select: { type: true } });
      if (produits.some(p => p.type === "digital")) {
        return NextResponse.json({ error: "Les produits digitaux nécessitent un paiement en ligne" }, { status: 400 });
      }
    }

    let clientRecord = await prisma.client.findFirst({ where: { tenantId, telephone: client.telephone } });
    if (!clientRecord) {
      clientRecord = await prisma.client.create({
        data: {
          tenantId, nom: client.nom,
          email: client.email || `${client.telephone.replace(/\D/g, "")}@axso.com`,
          telephone: client.telephone, ville: client.ville || null, pays: client.pays || null,
        },
      });
    }

    const trackingToken = genToken();
    const livreurToken  = genToken();
    const mapsLien = localisation?.lat
      ? `https://www.google.com/maps?q=${localisation.lat},${localisation.lng}`
      : null;

    // Frais de livraison calculés côté serveur — jamais confiance en un
    // montant envoyé par le client (le seul champ client-fourni utilisé
    // ici est `zone`, un texte utilisé pour matcher une ReglePort active).
    const montantLivraison = await fraisLivraisonServeur({ tenantId, zone, montantCommande: total });
    const montantTotalAvecLivraison = total + montantLivraison;

    const commande = await prisma.commande.create({
      data: {
        tenantId, numero: genererNumeroCommande(),
        clientId: clientRecord.id,
        clientNom: client.nom,
        clientEmail: client.email || clientRecord.email,
        clientTelephone: client.telephone,
        adresseLivraison: localisation?.adresseExacte || client.adresse || "À préciser",
        ville: zone || client.ville || "—",
        pays: client.pays || "—",
        montantSousTotal: total,
        montantLivraison,
        montantTotal: montantTotalAvecLivraison,
        devise,
        statut: "en_attente",
        paiementStatut: "pending",
        methodePaiement: viaWhatsapp ? "whatsapp_cod" : "direct_cod",
        codeAffiliation: codeAffiliation || null,
        trackingToken,
        livreurToken,
        latitudeClient: localisation?.lat ?? null,
        longitudeClient: localisation?.lng ?? null,
        adresseExacte: localisation?.adresseExacte || client.adresse || null,
        mapsLienClient: mapsLien,
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
      include: { lignes: true },
    });

    // Programme d'affiliation B2C — enregistrée "pending", capturée (payable)
    // seulement à la livraison confirmée (voir statut/route.ts), puisque le
    // COD n'est acquis qu'à ce moment-là.
    if (codeAffiliation) {
      await enregistrerConversionAffiliation({
        commande: {
          id: commande.id,
          tenantId,
          clientEmail: commande.clientEmail,
          clientTelephone: commande.clientTelephone,
          montantTotal: montantTotalAvecLivraison,
          codeAffiliation,
        },
        lignes: items.map((i: any) => ({ produitId: i.produitId, prix: i.prix, quantite: i.quantite })),
      }).catch(() => {});
    }

    // Auto-routing dropshipping
    try {
      const dropItems = items.filter((i: any) => i.fournisseurId);
      if (dropItems.length > 0) {
        const fournisseurIds = [...new Set(dropItems.map((i: any) => i.fournisseurId as string))];
        for (const fId of fournisseurIds) {
          const lf = dropItems.filter((i: any) => i.fournisseurId === fId);
          const montantFournisseur = lf.reduce((s: number, i: any) => s + ((i.prixFournisseur ?? i.prix * 0.5) * i.quantite), 0);
          await (prisma as any).commandeFournisseur.create({
            data: { tenantId: tenant.id, commandeId: commande.id, fournisseurId: fId, montantFournisseur, statut: "envoye", envoiAuto: true },
          }).catch(() => null);
        }
      }
    } catch {}

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axso.vercel.app";
    const factureUrl  = `${appUrl}/${slug}/facture/${trackingToken}`;
    const trackingUrl = `${appUrl}/${slug}/tracking/${trackingToken}`;
    const adresseLivraison = [localisation?.adresseExacte || client.adresse, client.ville, client.pays].filter(Boolean).join(", ");

    const lignesTexte = items.map((i: any) =>
      `• ${i.nom}${i.variante ? ` (${i.variante})` : ""} × ${i.quantite} — ${formatMontant(i.prix * i.quantite, devise)}`
    ).join("\n");

    // Message WhatsApp marchand (nouvelle commande)
    const messageMarchand = [
      `🛍️ *Nouvelle commande — ${tenant.nomBoutique}*`,
      `📋 N° *${commande.numero}*`,
      ``,
      `👤 *Client :* ${client.nom}`,
      `📞 *Tél :* ${client.telephone}`,
      adresseLivraison ? `📍 *Adresse :* ${adresseLivraison}` : null,
      mapsLien ? `🗺️ *Google Maps :* ${mapsLien}` : null,
      champPersonnalise?.valeur ? `📝 *${champPersonnalise.label} :* ${champPersonnalise.valeur}` : null,
      ``,
      `🛒 *Articles :*`,
      lignesTexte,
      ``,
      montantLivraison > 0 ? `🚚 *Livraison (${zone}) :* ${formatMontant(montantLivraison, devise)}` : null,
      `💰 *Total à percevoir :* ${formatMontant(montantTotalAvecLivraison, devise)}`,
      codePromo ? `🏷️ Code promo : ${codePromo}` : null,
      ``,
      `📄 Facture : ${factureUrl}`,
      `🚚 Tracking : ${trackingUrl}`,
    ].filter(Boolean).join("\n");

    const numero = (tenant.whatsappNumero || (tenant as any).whatsapp || "").replace(/\D/g, "");
    const whatsappUrl = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(messageMarchand)}` : null;

    // Notification dashboard — toujours créée, quel que soit le canal choisi par l'acheteur
    await notifierMarchand({
      tenantId,
      type: viaWhatsapp ? "commande_whatsapp" : "nouvelle_commande",
      titre: `Nouvelle commande #${commande.numero}`,
      message: `${client.nom} · ${items.length} article(s) · ${formatMontant(montantTotalAvecLivraison, devise)}${champPersonnalise?.valeur ? ` · ${champPersonnalise.label}: ${champPersonnalise.valeur}` : ""}`,
      lien: `/dashboard/commandes/${commande.id}`,
      commandeId: commande.id,
    });

    if (tenant.email) {
      await envoyerAlerteNouvelleCommande({
        email: tenant.email,
        numeroCommande: commande.numero,
        montantTotal: montantTotalAvecLivraison,
        devise,
        clientNom: client.nom,
        boutique: tenant.nomBoutique,
        lien: `${appUrl}/dashboard/commandes/${commande.id}`,
      }).catch(() => {});
    }
    // client.email brut uniquement — commande.clientEmail peut être un placeholder
    // généré (téléphone@axso.com) quand le client n'a pas fourni de vraie adresse.
    if (client.email) {
      await envoyerConfirmationCommande({
        email: client.email,
        nom: client.nom,
        numeroCommande: commande.numero,
        montantTotal: montantTotalAvecLivraison,
        devise,
        produits: items.map((i: any) => ({ nom: i.nom, quantite: i.quantite, prix: i.prix })),
        boutique: tenant.nomBoutique,
      }).catch(() => {});
    }

    // Message WhatsApp client (confirmation automatique)
    const telClient = client.telephone.replace(/\D/g, "");
    const messageClient = [
      `✅ *Commande confirmée — ${tenant.nomBoutique}*`,
      ``,
      `Bonjour ${client.nom} ! 🙏`,
      `Votre commande *#${commande.numero}* a bien été reçue.`,
      ``,
      `📋 *${items.length} article(s)* — Total : *${formatMontant(montantTotalAvecLivraison, devise)}*`,
      montantLivraison > 0 ? `🚚 dont livraison : ${formatMontant(montantLivraison, devise)}` : null,
      `💳 Paiement à la livraison`,
      ``,
      `📄 *Votre facture :*`,
      factureUrl,
      ``,
      `🚚 *Suivre votre livraison :*`,
      trackingUrl,
      ``,
      `Nous vous contacterons pour la livraison. Merci ! 🎉`,
    ].filter(Boolean).join("\n");

    const whatsappClientUrl = telClient ? `https://wa.me/${telClient}?text=${encodeURIComponent(messageClient)}` : null;

    return NextResponse.json({
      commandeId: commande.id,
      numero: commande.numero,
      viaWhatsapp,
      whatsappUrl,
      whatsappClientUrl,
      trackingToken,
      factureUrl,
      trackingUrl,
      montantLivraison,
      montantTotal: montantTotalAvecLivraison,
    });

  } catch (err) {
    console.error("[whatsapp-creer]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
