// Créer une commande physique (paiement à la livraison) + générer lien WhatsApp + tokens tracking/facture.
// Le dropshipping et le digital se paient en ligne (digital-creer) : refusés ici.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererNumeroCommande, formatMontant } from "@/lib/utils";
import { notifierMarchand } from "@/lib/notifications-marchand";
import { envoyerConfirmationCommande, envoyerAlerteNouvelleCommande, emailReel } from "@/lib/email";
import { fraisLivraisonServeur } from "@/lib/livraison";
import { enregistrerConversionAffiliation } from "@/lib/affiliation";
import { randomBytes } from "crypto";
import { prixClient, reductionPromo } from "@/lib/pricing";
import { RuptureStock, sortirStock } from "@/lib/stock";

function genToken() { return randomBytes(20).toString("hex"); }

export async function POST(req: NextRequest) {
  try {
    // Prix, total, remise et devise NE viennent JAMAIS du navigateur : recalculés depuis la base.
    const { tenantId, slug, client, items: itemsClient, codePromo: codeSaisi, localisation, canal, champPersonnalise, zone, codeAffiliation } = await req.json();
    const viaWhatsapp = canal !== "direct";

    if (!tenantId || !itemsClient?.length || !client?.nom || !client?.telephone) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.statut !== "active") {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const produits = await prisma.produit.findMany({
      where: { id: { in: itemsClient.map((i: any) => String(i.produitId)) }, tenantId, actif: true },
      select: { id: true, nom: true, type: true, prix: true, images: true, variantes: { where: { actif: true }, select: { nom: true, valeur: true, prix: true } } },
    });
    const taux = tenant.commissionRate ?? 0.06;
    const items: { produitId: string; nom: string; prix: number; quantite: number; imageUrl: string | null; variante: string | null }[] = [];
    for (const item of itemsClient) {
      const p = produits.find((x) => x.id === String(item.produitId));
      if (!p) return NextResponse.json({ error: "Produit introuvable dans cette boutique" }, { status: 400 });
      if (p.type !== "physique") {
        return NextResponse.json({ error: "Ce produit se paie en ligne" }, { status: 400 });
      }
      const variante = item.variante ? p.variantes.find((v) => `${v.nom}: ${v.valeur}` === item.variante) : null;
      if (item.variante && !variante) return NextResponse.json({ error: `Variante « ${item.variante} » introuvable pour ${p.nom}` }, { status: 400 });
      items.push({
        produitId: p.id, nom: p.nom, prix: prixClient(variante?.prix ?? p.prix, taux, p.type),
        quantite: Math.min(Math.max(Math.floor(Number(item.quantite) || 1), 1), 999),
        imageUrl: p.images[0] ?? null, variante: variante ? item.variante : null,
      });
    }
    const sousTotal = items.reduce((s, i) => s + i.prix * i.quantite, 0);
    const devise = tenant.devise;

    // Code promo revérifié ici (le panier ne fait qu'afficher une estimation).
    const promo = codeSaisi ? await prisma.codePromo.findFirst({ where: { tenantId, code: String(codeSaisi).toUpperCase(), actif: true } }) : null;
    const reduction = reductionPromo(promo, sousTotal);
    const promoValide = promo && reduction > 0;
    const total = sousTotal - reduction;
    const codePromo = promoValide ? promo.code : null;

    let clientRecord = await prisma.client.findFirst({ where: { tenantId, telephone: client.telephone } });
    if (!clientRecord) {
      clientRecord = await prisma.client.create({
        data: {
          tenantId, nom: client.nom,
          email: client.email?.trim() || null, // facultatif : le client se retrouve par son téléphone
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

    // Création + sortie du stock dans la même transaction : une rupture annule tout.
    const commande = await prisma.$transaction(async (tx) => {
      const c = await tx.commande.create({
      data: {
        tenantId, numero: genererNumeroCommande(),
        clientId: clientRecord.id,
        clientNom: client.nom,
        clientEmail: client.email?.trim() || (emailReel(clientRecord.email) ? clientRecord.email : null),
        clientTelephone: client.telephone,
        adresseLivraison: localisation?.adresseExacte || client.adresse || "À préciser",
        ville: zone || client.ville || "—",
        pays: client.pays || "—",
        montantSousTotal: sousTotal,
        montantReduction: reduction,
        codePromoId: promoValide ? promo.id : null,
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
          create: items,
        },
      },
      include: { lignes: true },
      });
      await sortirStock(tx, { tenantId, commandeId: c.id, motif: `Commande #${c.numero}` });
      return c;
    });
    if (promoValide) await prisma.codePromo.update({ where: { id: promo.id }, data: { utilisations: { increment: 1 } } });

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
        lignes: items.map((i) => ({ produitId: i.produitId, prix: i.prix, quantite: i.quantite })),
      }).catch(() => {});
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://axso.vercel.app";
    const factureUrl  = `${appUrl}/${slug}/facture/${trackingToken}`;
    const trackingUrl = `${appUrl}/${slug}/tracking/${trackingToken}`;
    const adresseLivraison = [localisation?.adresseExacte || client.adresse, client.ville, client.pays].filter(Boolean).join(", ");

    const lignesTexte = items.map((i) =>
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
      codePromo ? `🏷️ Code promo : ${codePromo} (−${formatMontant(reduction, devise)})` : null,
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
    // Email saisi à cette commande uniquement (celui d'une fiche ancienne peut être une adresse générée).
    if (client.email) {
      await envoyerConfirmationCommande({
        email: client.email,
        nom: client.nom,
        numeroCommande: commande.numero,
        montantTotal: montantTotalAvecLivraison,
        devise,
        produits: items.map((i) => ({ nom: i.nom, quantite: i.quantite, prix: i.prix })),
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
    if (err instanceof RuptureStock) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[whatsapp-creer]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
