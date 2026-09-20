// POS — Créer une commande en boutique physique
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quotaCommandesAtteint } from "@/lib/abonnement";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = session.user.tenantId;

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à vendre en boutique.", code: "quota_atteint" }, { status: 403 });
  }

  const body = await req.json();
  const { clientNom, clientTelephone, items, methode, montantTotal, montantReduction = 0 } = body;
  if (!items?.length) return NextResponse.json({ error: "Panier vide" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true, slug: true } });
  const devise = tenant?.devise ?? "XAF";

  // Auto-create or find client
  let client = await prisma.client.findFirst({ where: { tenantId, OR: [{ email: "pos@local" }] } });
  if (!client) {
    client = await prisma.client.create({ data: { tenantId, nom: clientNom, email: "pos@local", telephone: clientTelephone } });
  }

  const sousTotal = items.reduce((s: number, i: any) => s + i.prix * i.quantite, 0);
  const count = await prisma.commande.count({ where: { tenantId } });
  const numero = `CMD-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;

  const commande = await prisma.commande.create({
    data: {
      tenantId,
      numero,
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
      paiementStatut: "paid",
      methodePaiement: methode,
      livraisonStatut: "livree",
      lignes: {
        create: items.map((i: any) => ({
          produitId: i.produitId,
          nom: i.nom,
          prix: i.prix,
          quantite: i.quantite,
          imageUrl: i.imageUrl || null,
          variante: i.variante || null,
        })),
      },
    },
  });

  // Déduit le stock + journalise chaque ligne dans StockMouvement (traçabilité)
  // — consomme en FIFO le lot actif le plus ancien du produit s'il en existe,
  // pour pouvoir remonter de toute vente jusqu'à son lot d'origine.
  for (const item of items) {
    try {
      const produit = await prisma.produit.findUnique({ where: { id: item.produitId }, select: { stock: true } });
      if (!produit) continue;
      const stockAvant = produit.stock;
      const stockApres = Math.max(0, stockAvant - item.quantite);

      const lot = await prisma.lotTracabilite.findFirst({
        where: { tenantId, produitId: item.produitId, statut: "actif", quantiteRestante: { gt: 0 } },
        orderBy: { dateReception: "asc" },
      });

      await prisma.$transaction([
        prisma.produit.update({ where: { id: item.produitId }, data: { stock: stockApres, ventes: { increment: item.quantite } } }),
        prisma.stockMouvement.create({
          data: {
            tenantId, produitId: item.produitId, type: "vente",
            quantite: item.quantite, stockAvant, stockApres,
            motif: `Vente caisse #${commande.numero}`, lotId: lot?.id ?? null,
            commandeId: commande.id, creePar: session.user.id,
          },
        }),
        ...(lot
          ? [prisma.lotTracabilite.update({
              where: { id: lot.id },
              data: { quantiteRestante: Math.max(0, lot.quantiteRestante - item.quantite) },
            })]
          : []),
      ]);

      if (lot) {
        await prisma.ligneCommande.updateMany({
          where: { commandeId: commande.id, produitId: item.produitId },
          data: { lotId: lot.id },
        });
      }
    } catch {
      // Ne bloque jamais la vente déjà enregistrée pour un souci de journalisation
    }
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
