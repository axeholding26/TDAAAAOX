// Sync automatique des prix/stocks fournisseurs dropshipping
// Appelé par cron ou manuellement depuis le dashboard
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 60;

interface SyncResult {
  produitId: string;
  nom: string;
  action: string;
  ancienPrix?: number;
  nouveauPrix?: number;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tenantId: string | undefined = body.tenantId;

  // Find all active dropshipping products with a supplier
  const where: any = { type: "dropshipping", fournisseurId: { not: null }, actif: true };
  if (tenantId) where.tenantId = tenantId;

  const produits = await prisma.produit.findMany({
    where,
    include: { fournisseur: true },
    take: 200,
  });

  const resultats: SyncResult[] = [];
  let alertesStock = 0;

  for (const p of produits) {
    if (!p.fournisseur || !p.prixFournisseur) continue;

    const margeAuto = p.fournisseur.margeAuto ?? 0.30;

    // Simulate price check — in production this would call supplier API
    // For now: detect if prix de vente is no longer at correct margin
    const prixCible = Math.ceil(p.prixFournisseur * (1 + margeAuto));
    const ecart = Math.abs((p.prix - prixCible) / prixCible);

    // Alert if margin drift > 5%
    if (ecart > 0.05) {
      await prisma.produit.update({
        where: { id: p.id },
        data: { prix: prixCible },
      });
      resultats.push({
        produitId: p.id,
        nom: p.nom,
        action: "prix_recalcule",
        ancienPrix: p.prix,
        nouveauPrix: prixCible,
      });
    }

    // Alert if stock below stockMin
    if (p.stockMin !== null && p.stock <= p.stockMin) {
      alertesStock++;
      resultats.push({
        produitId: p.id,
        nom: p.nom,
        action: "alerte_stock_bas",
      });
    }
  }

  // Check supplier orders with delays
  const maintenant = new Date();
  const commandesEnRetard = await (prisma as any).commandeFournisseur.findMany({
    where: {
      statut: { in: ["envoye", "confirme"] },
      ...(tenantId ? { tenantId } : {}),
      createdAt: { lt: new Date(maintenant.getTime() - 1000 * 60 * 60 * 24 * 7) }, // > 7 jours
    },
    include: {
      fournisseur: { select: { nom: true, delaiLivraison: true } },
      commande: { select: { numero: true, clientNom: true, clientEmail: true } },
    },
    take: 50,
  });

  return NextResponse.json({
    ok: true,
    produitsAnalyses: produits.length,
    majPrix: resultats.filter(r => r.action === "prix_recalcule").length,
    alertesStock,
    commandesEnRetard: commandesEnRetard.length,
    commandesRetardDetail: commandesEnRetard.map((cf: any) => ({
      commandeNumero: cf.commande.numero,
      clientNom: cf.commande.clientNom,
      fournisseur: cf.fournisseur.nom,
      delaiEstime: cf.fournisseur.delaiLivraison,
      joursEcoules: Math.floor((maintenant.getTime() - new Date(cf.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    })),
    resultats,
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");
  return POST(new Request(req.url, {
    method: "POST",
    body: JSON.stringify({ tenantId }),
    headers: { "Content-Type": "application/json" },
  }));
}
