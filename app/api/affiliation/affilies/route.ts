import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { genererCodeParrainageUnique } from "@/lib/affiliation";

// GET — liste des affiliés du tenant avec leurs stats
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) return NextResponse.json({ error: "Pas de boutique" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const statut = searchParams.get("statut");
    const search = searchParams.get("search");

    const where: any = { tenantId };
    if (statut && statut !== "all") where.statut = statut;
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { codeParrainage: { contains: search, mode: "insensitive" } },
      ];
    }

    const affilies = await prisma.affilie.findMany({
      where,
      include: {
        programme: { select: { nom: true, valeurCommission: true, typeCommission: true } },
        commissions: {
          select: { montantCommission: true, statut: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ affilies });
  } catch (err) {
    console.error("[AFFILIES/GET]", err);
    return NextResponse.json({ affilies: [] });
  }
}

// POST — créer un affilié
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Pas de boutique" }, { status: 400 });

  const body = await req.json();
  const { nom, email, telephone, programmeId, notes, autoApprove } = body;

  if (!nom || !email) {
    return NextResponse.json({ error: "Nom et email requis" }, { status: 400 });
  }

  // Vérifier si l'affilié existe déjà
  const existing = await prisma.affilie.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
  if (existing) {
    return NextResponse.json({ error: "Cet email est déjà affilié" }, { status: 409 });
  }

  // Vérifier si le programme existe
  if (programmeId) {
    const prog = await prisma.programmeAffiliation.findFirst({
      where: { id: programmeId, tenantId },
    });
    if (!prog) return NextResponse.json({ error: "Programme introuvable" }, { status: 404 });
  }

  // Générer un code de parrainage unique
  const code = await genererCodeParrainageUnique(nom);

  // Vérifier les paramètres d'auto-approbation
  let statut = "en_attente";
  if (autoApprove) {
    statut = "actif";
  } else if (programmeId) {
    const prog = await prisma.programmeAffiliation.findUnique({ where: { id: programmeId }, select: { autoApprobation: true } });
    if (prog?.autoApprobation) statut = "actif";
  }

  const affilie = await prisma.affilie.create({
    data: {
      tenantId,
      nom,
      email,
      telephone: telephone || null,
      programmeId: programmeId || null,
      codeParrainage: code,
      notes: notes || null,
      statut,
    },
  });

  return NextResponse.json({ affilie }, { status: 201 });
}

// PATCH — mettre à jour le statut d'un affilié ou réinitialiser son code
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Pas de boutique" }, { status: 400 });

  const body = await req.json();
  const { id, statut, programmeId, resetCode, notes } = body;

  if (!id) return NextResponse.json({ error: "ID requis" }, { status: 400 });

  const affilie = await prisma.affilie.findFirst({ where: { id, tenantId } });
  if (!affilie) return NextResponse.json({ error: "Affilié introuvable" }, { status: 404 });

  const data: any = {};
  if (statut) data.statut = statut;
  if (programmeId !== undefined) data.programmeId = programmeId || null;
  if (notes !== undefined) data.notes = notes;

  if (resetCode) {
    data.codeParrainage = await genererCodeParrainageUnique(affilie.nom);
  }

  const updated = await prisma.affilie.update({ where: { id }, data });
  return NextResponse.json({ affilie: updated });
}
