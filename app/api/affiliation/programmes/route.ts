import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — liste des programmes du tenant
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Pas de boutique" }, { status: 400 });

    const programmes = await prisma.programmeAffiliation.findMany({
      where: { tenantId },
      include: { affilies: { select: { id: true, statut: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ programmes });
  } catch (err) {
    console.error("[PROGRAMMES/GET]", err);
    return NextResponse.json({ programmes: [] });
  }
}

// POST — créer un programme
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Pas de boutique" }, { status: 400 });

  const body = await req.json();
  const {
    nom, description, typeCommission, valeurCommission,
    dureeCookie, seuilPaiement, tousLesProduits, produitIds,
    tiersActifs, tier1Nom, tier1Max, tier1Commission,
    tier2Nom, tier2Max, tier2Commission, tier3Nom, tier3Commission,
    multiNiveauActif, tauxSousAffilies, autoApprobation,
  } = body;

  if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const programme = await prisma.programmeAffiliation.create({
    data: {
      tenantId,
      nom,
      description: description || null,
      typeCommission: typeCommission || "pourcentage",
      valeurCommission: Number(valeurCommission) || 10,
      dureeCookie: Number(dureeCookie) || 30,
      seuilPaiement: Number(seuilPaiement) || 5000,
      tousLesProduits: Boolean(tousLesProduits ?? true),
      produitIds: Array.isArray(produitIds) ? produitIds : [],
      tiersActifs: Boolean(tiersActifs),
      tier1Nom: tier1Nom || "Bronze",
      tier1Max: Number(tier1Max) || 10,
      tier1Commission: Number(tier1Commission) || 5,
      tier2Nom: tier2Nom || "Argent",
      tier2Max: Number(tier2Max) || 50,
      tier2Commission: Number(tier2Commission) || 8,
      tier3Nom: tier3Nom || "Or",
      tier3Commission: Number(tier3Commission) || 12,
      multiNiveauActif: Boolean(multiNiveauActif),
      tauxSousAffilies: Number(tauxSousAffilies) || 2,
      autoApprobation: autoApprobation === undefined ? true : Boolean(autoApprobation),
    },
  });

  return NextResponse.json({ programme }, { status: 201 });
}

// PATCH — modifier un programme
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Pas de boutique" }, { status: 400 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const programme = await prisma.programmeAffiliation.findFirst({ where: { id, tenantId } });
  if (!programme) return NextResponse.json({ error: "Programme introuvable" }, { status: 404 });

  const cleanUpdates: any = {};
  const allowed = [
    "nom", "description", "typeCommission", "valeurCommission", "dureeCookie",
    "seuilPaiement", "tousLesProduits", "produitIds", "tiersActifs",
    "tier1Nom", "tier1Max", "tier1Commission", "tier2Nom", "tier2Max", "tier2Commission",
    "tier3Nom", "tier3Commission", "multiNiveauActif", "tauxSousAffilies", "actif", "autoApprobation",
  ];
  for (const key of allowed) {
    if (updates[key] !== undefined) cleanUpdates[key] = updates[key];
  }

  const updated = await prisma.programmeAffiliation.update({ where: { id }, data: cleanUpdates });
  return NextResponse.json({ programme: updated });
}

// DELETE — supprimer un programme
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Pas de boutique" }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const programme = await prisma.programmeAffiliation.findFirst({ where: { id, tenantId } });
  if (!programme) return NextResponse.json({ error: "Programme introuvable" }, { status: 404 });

  // Désaffecter les affiliés avant suppression
  await prisma.affilie.updateMany({
    where: { programmeId: id },
    data: { programmeId: null },
  });

  await prisma.programmeAffiliation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
