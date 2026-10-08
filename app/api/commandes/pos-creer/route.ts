// POS — Créer une commande en boutique physique
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PAIEMENT } from "@/lib/commandes";
import { RuptureStock, compterVentes, sortirStock } from "@/lib/stock";
import { genererNumeroCommande } from "@/lib/utils";
import { quotaCommandesAtteint } from "@/lib/abonnement";

export async function POST(req: Request) {
  const session = await auth();
  if (!(session?.user as any)?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session?.user as any)?.tenantId;

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à vendre en boutique.", code: "quota_atteint" }, { status: 403 });
  }

  const body = await req.json();
  const { clientNom, clientTelephone, items: itemsClient, methode } = body;
  if (!itemsClient?.length) return NextResponse.json({ error: "Panier vide" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true, slug: true } });
  const devise = tenant?.devise ?? "XAF";

  // Prix recalculés depuis la base (prix du marchand, sans commission : la vente
  // se fait en main propre) — seule la remise manuelle vient de la caisse.
  const produits = await prisma.produit.findMany({
    where: { id: { in: itemsClient.map((i: any) => String(i.produitId)) }, tenantId },
    select: { id: true, nom: true, prix: true, images: true, variantes: { select: { nom: true, valeur: true, prix: true } } },
  });
  const items: { produitId: string; nom: string; prix: number; quantite: number; imageUrl: string | null; variante: string | null }[] = [];
  for (const i of itemsClient) {
    const p = produits.find((x) => x.id === String(i.produitId));
    if (!p) return NextResponse.json({ error: "Produit introuvable dans cette boutique" }, { status: 400 });
    const variante = i.variante ? p.variantes.find((v) => `${v.nom}: ${v.valeur}` === i.variante) : null;
    if (i.variante && !variante) return NextResponse.json({ error: `Variante « ${i.variante} » introuvable pour ${p.nom}` }, { status: 400 });
    items.push({
      produitId: p.id, nom: p.nom + (variante ? ` — ${i.variante}` : ""), prix: variante?.prix ?? p.prix,
      quantite: Math.max(1, Math.floor(Number(i.quantite) || 1)), imageUrl: p.images[0] ?? null, variante: variante ? i.variante : null,
    });
  }
  const sousTotal = items.reduce((s, i) => s + i.prix * i.quantite, 0);
  const montantReduction = Math.min(Math.max(Number(body.montantReduction) || 0, 0), sousTotal);
  const montantTotal = sousTotal - montantReduction;

  // Auto-create or find client
  let client = await prisma.client.findFirst({ where: { tenantId, OR: [{ email: "pos@local" }] } });
  if (!client) {
    client = await prisma.client.create({ data: { tenantId, nom: clientNom, email: "pos@local", telephone: clientTelephone } });
  }

  let commande;
  try {
    commande = await prisma.$transaction(async (tx) => {
      const c = await tx.commande.create({
        data: {
          tenantId,
          numero: genererNumeroCommande(),
          clientId: client.id,
          clientNom,
          clientEmail: "pos@local",
          clientTelephone,
          adresseLivraison: "Vente en boutique",
          ville: "Local",
          pays: "CM",
          montantSousTotal: sousTotal,
          montantLivraison: 0,
          montantReduction,
          montantTotal,
          devise,
          statut: "livree",
          paiementStatut: PAIEMENT.PAYE,
          methodePaiement: methode,
          livraisonStatut: "livree",
          livreeAt: new Date(),
          lignes: { create: items },
        },
      });
      // Stock (lots FIFO + journal) et compteur de ventes : mêmes règles que la vitrine.
      await sortirStock(tx, { tenantId, commandeId: c.id, motif: `Vente caisse #${c.numero}`, creePar: (session?.user as any)?.id });
      await compterVentes(tx, c.id, 1);
      return c;
    });
  } catch (err) {
    if (err instanceof RuptureStock) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }

  // Generate invoice automatically for POS sales
  try {
    const factureCount = await (prisma as any).facture.count({ where: { tenantId } });
    const numeroFac = `FAC-${new Date().getFullYear()}-${String(factureCount + 1).padStart(4, "0")}`;
    await (prisma as any).facture.create({
      data: {
        tenantId, commandeId: commande.id, numero: numeroFac,
        clientNom, clientEmail: "pos@local", clientAdresse: "Vente en boutique",
        montantHT: montantTotal, tauxTVA: 0, montantTVA: 0, montantTTC: montantTotal, devise,
        lignes: items.map((i: any) => ({ nom: i.nom, quantite: i.quantite, prixHT: i.prix, tauxTVA: 0, prixTTC: i.prix })),
        statut: "payee",
      },
    });
  } catch {}

  return NextResponse.json({ ok: true, commandeId: commande.id, numero: commande.numero });
}
