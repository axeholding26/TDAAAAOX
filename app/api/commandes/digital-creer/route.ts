import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererNumeroCommande } from "@/lib/utils";
import { prixClient, reductionPromo, tauxCommande } from "@/lib/pricing";
import { fraisLivraisonServeur, poidsPanier, verifierZone } from "@/lib/livraison";
import { villeCommande } from "@/lib/livraison-reglages";
import { hasNotchPay } from "@/lib/notchpay";
import { paiementEnLigneDisponible } from "@/lib/paiement-pays";
import { codePays } from "@/lib/devise-convert";
import { randomBytes } from "crypto";
import { rateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { COOKIE_XP, noterConversion } from "@/lib/builder/experiences";
import { refusVenteNumerique } from "@/lib/livraison-numerique";

// Formulaire public : limite par IP (partagée avec whatsapp-creer).
const limiteCommande = rateLimit({ windowMs: 60_000, max: 10, keyPrefix: "commande-vitrine" });

export async function POST(req: NextRequest) {
  try {
    const rl = limiteCommande.check(getClientIp(req));
    if (!rl.success) return rateLimitResponse(rl.reset);
    // Prix, total et devise NE viennent JAMAIS du navigateur : recalculés depuis la
    // base (même formule que la vitrine) — sinon on pouvait payer le prix de son choix.
    // Commande payée en ligne : produits digitaux et dropshipping (expédié par le fournisseur).
    const { tenantId, client, items, codeAffiliation, codePromo: codeSaisi, zone } = await req.json();

    if (!tenantId || !Array.isArray(items) || !items.length || items.length > 50 || !client?.nom?.trim() || !client?.email?.trim() || !client?.telephone?.trim()) {
      return NextResponse.json({ error: "Nom, email et téléphone obligatoires" }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || tenant.statut !== "active") {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }
    // Sans paiement en ligne possible, la commande ne serait jamais payable : refusée avant d'être créée.
    if (!hasNotchPay() || !paiementEnLigneDisponible(tenant.devise)) {
      return NextResponse.json({ error: "Le paiement en ligne n'est pas encore disponible pour cette boutique" }, { status: 409 });
    }

    // Refuse la commande avant paiement si un produit digital ne peut plus être
    // livré — limite d'exemplaires atteinte (fichier) ou plus de clé disponible
    // (licence). Mieux vaut bloquer ici que faire payer un client pour rien.
    const produits = await prisma.produit.findMany({
      where: { id: { in: items.map((i: any) => String(i.produitId)) }, tenantId, actif: true },
      select: {
        id: true, nom: true, type: true, prix: true, images: true,
        variantes: { where: { actif: true }, select: { nom: true, valeur: true, prix: true } },
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
    // Un produit à expédier ne se paie pas avec un produit numérique : la finalisation suivrait le
    // chemin numérique (pas de commande fournisseur, livraison comptée dans la commission).
    if (aExpedier && produits.some((p) => p.type !== "dropshipping")) {
      return NextResponse.json({ error: "Commande un produit à expédier séparément de tes produits numériques" }, { status: 400 });
    }
    if (aExpedier &&(!client?.adresse?.trim() || !(zone || client?.ville)?.trim())) {
      return NextResponse.json({ error: "Adresse et ville de livraison obligatoires" }, { status: 400 });
    }
    const taux = tenant.commissionRate ?? 0.1;
    const lignes: { produitId: string; nom: string; prix: number; quantite: number; imageUrl: string | null; variante: string | null }[] = [];
    for (const item of items) {
      const p = produits.find((x) => x.id === String(item.produitId))!;
      // Variante revérifiée et payée à SON prix (sinon une variante plus chère passait au prix de base).
      const variante = item.variante ? p.variantes.find((v) => `${v.nom}: ${v.valeur}` === item.variante) : null;
      if (item.variante && !variante) return NextResponse.json({ error: `Variante « ${item.variante} » introuvable pour ${p.nom}` }, { status: 400 });
      lignes.push({ produitId: p.id, nom: p.nom, prix: prixClient(variante?.prix ?? p.prix, taux, p.type), quantite: Math.min(Math.max(Math.floor(Number(item.quantite) || 1), 1), 10), imageUrl: p.images[0] ?? null, variante: variante ? item.variante : null });
    }
    const sousTotal = lignes.reduce((s: number, l: { prix: number; quantite: number }) => s + l.prix * l.quantite, 0);
    const promo = codeSaisi ? await prisma.codePromo.findFirst({ where: { tenantId, code: String(codeSaisi).toUpperCase(), actif: true } }) : null;
    const reduction = reductionPromo(promo, sousTotal, lignes);
    const erreurZone = aExpedier ? await verifierZone(tenantId, codePays(client?.pays), zone) : null;
    if (erreurZone) return NextResponse.json({ error: erreurZone }, { status: 400 });
    const montantLivraison = aExpedier ? await fraisLivraisonServeur({ tenantId, pays: codePays(client?.pays), zone, poids: await poidsPanier(tenantId, lignes), montantCommande: sousTotal - reduction }) : 0;
    const total = sousTotal - reduction + montantLivraison;
    const devise = tenant.devise;

    const refusVente = await refusVenteNumerique(produits.map((p) => p.id));
    if (refusVente) return NextResponse.json({ error: refusVente }, { status: 409 });

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
        tauxCommission: tauxCommande(lignes.map((l) => ({ ...l, type: produits.find((p) => p.id === l.produitId)?.type })), taux),
        ville: aExpedier ? villeCommande(zone, client.ville) || "—" : "Digital",
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

    // Test A/B en cours : commande attribuée à la variante vue par ce visiteur (lib/builder/experiences.ts).
    await noterConversion(tenantId, req.cookies.get(COOKIE_XP)?.value);
    return NextResponse.json({ commandeId: commande.id, numero: commande.numero, total, montantLivraison, devise });
  } catch (err) {
    console.error("[digital-creer]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
