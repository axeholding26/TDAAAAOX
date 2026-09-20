import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quotaCommandesAtteint } from "@/lib/abonnement";

function genNumero(tenantId: string, count: number) {
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `FAC-${year}-${seq}`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const commandeId = searchParams.get("commandeId");

  if (commandeId) {
    const facture = await prisma.facture.findFirst({ where: { tenantId, commandeId } });
    return NextResponse.json({ facture });
  }

  const factures = await prisma.facture.findMany({
    where: { tenantId },
    orderBy: { emiseAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ factures });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  if (await quotaCommandesAtteint(tenantId)) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à gérer vos commandes.", code: "quota_atteint" }, { status: 403 });
  }

  const body = await req.json();
  const { commandeId } = body;
  if (!commandeId) return NextResponse.json({ error: "commandeId requis" }, { status: 400 });

  // Check if invoice already exists
  const existing = await prisma.facture.findFirst({ where: { commandeId } });
  if (existing) return NextResponse.json({ facture: existing });

  const commande = await prisma.commande.findFirst({
    where: { id: commandeId, tenantId },
    include: { lignes: true },
  });
  if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const tauxTVA = (tenant as any)?.tauxTVA ?? 0;

  const lignes = commande.lignes.map((l) => ({
    nom: l.nom,
    quantite: l.quantite,
    prixHT: tauxTVA > 0 ? l.prix / (1 + tauxTVA) : l.prix,
    tauxTVA,
    prixTTC: l.prix,
    variante: l.variante ?? null,
  }));

  const montantHT = tauxTVA > 0 ? commande.montantSousTotal / (1 + tauxTVA) : commande.montantSousTotal;
  const montantTVA = commande.montantSousTotal - montantHT;

  const count = await prisma.facture.count({ where: { tenantId } });
  const numero = genNumero(tenantId, count);

  const facture = await prisma.facture.create({
    data: {
      tenantId,
      commandeId,
      numero,
      clientNom: commande.clientNom,
      clientEmail: commande.clientEmail,
      clientAdresse: commande.adresseLivraison,
      lignes,
      montantHT,
      tauxTVA,
      montantTVA,
      montantTTC: commande.montantTotal,
      devise: commande.devise,
      statut: commande.paiementStatut === "paid" ? "payee" : "emise",
    },
  });

  return NextResponse.json({ facture }, { status: 201 });
}
