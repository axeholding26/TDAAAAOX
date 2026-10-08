import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { changerStatutCommande } from "@/lib/cycle-livraison";

export async function GET(req: Request) {
  const session = await auth();
  if (!(session?.user as any)?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session?.user as any)?.tenantId;
  const { searchParams } = new URL(req.url);
  const statut = searchParams.get("statut");

  const where: any = { tenantId };
  if (statut) where.statut = statut;

  const commandes = await (prisma as any).commandeFournisseur.findMany({
    where,
    include: {
      commande: { select: { numero: true, clientNom: true, clientEmail: true, montantTotal: true, devise: true, createdAt: true } },
      fournisseur: { select: { nom: true, pays: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const stats = {
    total: await (prisma as any).commandeFournisseur.count({ where: { tenantId } }),
    en_attente: await (prisma as any).commandeFournisseur.count({ where: { tenantId, statut: "en_attente" } }),
    expedie: await (prisma as any).commandeFournisseur.count({ where: { tenantId, statut: "expedie" } }),
    livre: await (prisma as any).commandeFournisseur.count({ where: { tenantId, statut: "livre" } }),
  };

  return NextResponse.json({ commandes, stats });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!(session?.user as any)?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session?.user as any)?.tenantId;
  const body = await req.json();

  // Verify commande belongs to tenant
  const commande = await prisma.commande.findFirst({
    where: { id: body.commandeId, tenantId },
    include: { lignes: { include: { produit: { select: { fournisseurId: true, prixFournisseur: true } } } } },
  });
  if (!commande) return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });

  // Auto-detect fournisseurId from products if not provided
  const fournisseurId = body.fournisseurId ?? commande.lignes.find((l: any) => l.produit?.fournisseurId)?.produit?.fournisseurId;
  if (!fournisseurId) return NextResponse.json({ error: "Aucun fournisseur associé à cette commande" }, { status: 400 });

  const montantFournisseur = commande.lignes.reduce((s: number, l: any) => {
    return s + ((l.produit?.prixFournisseur ?? l.prix * 0.5) * l.quantite);
  }, 0);

  const cf = await (prisma as any).commandeFournisseur.create({
    data: {
      tenantId,
      commandeId: body.commandeId,
      fournisseurId,
      montantFournisseur,
      delaiEstime: body.delaiEstime,
      notes: body.notes,
      envoiAuto: body.envoiAuto ?? false,
      statut: "envoye",
    },
  });
  return NextResponse.json({ commandeFournisseur: cf });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json();

  const existante = await prisma.commandeFournisseur.findFirst({ where: { id: body.id, tenantId } });
  if (!existante) return NextResponse.json({ error: "Commande fournisseur introuvable" }, { status: 404 });

  const cf = await prisma.commandeFournisseur.update({
    where: { id: existante.id },
    data: {
      statut: body.statut,
      trackingNo: body.trackingNo,
      reference: body.reference,
      notes: body.notes,
    },
  });

  // La commande client suit le cycle de livraison normal (transitions, WhatsApp, CA).
  if (body.trackingNo) {
    await prisma.commande.update({ where: { id: cf.commandeId }, data: { numeroSuivi: body.trackingNo } });
  }
  // « Livré » sans passage par « expédié » : on enchaîne les deux étapes.
  const etapes = body.statut === "expedie" ? ["expediee"] : body.statut === "livre" ? ["expediee", "livree"] : [];
  for (const [i, statut] of etapes.entries()) {
    const commande = await prisma.commande.findUnique({ where: { id: cf.commandeId }, select: { statut: true } });
    if (commande?.statut === statut || (statut === "expediee" && commande?.statut === "livree")) continue;
    const r = await changerStatutCommande({ commandeId: cf.commandeId, statut, acteur: { type: "marchand", tenantId, source: "interface" } });
    if (!r.ok && i === etapes.length - 1) return NextResponse.json({ error: r.error }, { status: r.status });
  }

  return NextResponse.json({ commandeFournisseur: cf });
}
