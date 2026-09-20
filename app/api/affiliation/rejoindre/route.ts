import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { genererCodeParrainageUnique } from "@/lib/affiliation";

// POST public — candidature au programme d'affiliation d'un marchand.
// Aucune session requise : n'importe qui peut candidater depuis /rejoindre/[programmeId].
export async function POST(req: Request) {
  try {
    const { programmeId, nom, email, telephone } = await req.json();
    if (!programmeId || !nom || !email) {
      return NextResponse.json({ error: "Nom et email requis" }, { status: 400 });
    }

    const programme = await prisma.programmeAffiliation.findUnique({ where: { id: programmeId } });
    if (!programme || !programme.actif) {
      return NextResponse.json({ error: "Ce programme d'affiliation n'est plus disponible" }, { status: 404 });
    }

    const existant = await prisma.affilie.findUnique({
      where: { tenantId_email: { tenantId: programme.tenantId, email } },
    });
    if (existant) {
      return NextResponse.json({ affilie: { portalToken: existant.portalToken, statut: existant.statut } }, { status: 200 });
    }

    const code = await genererCodeParrainageUnique(nom);
    const affilie = await prisma.affilie.create({
      data: {
        tenantId: programme.tenantId,
        nom, email, telephone: telephone || null,
        programmeId: programme.id,
        codeParrainage: code,
        statut: programme.autoApprobation ? "actif" : "en_attente",
      },
    });

    return NextResponse.json({ affilie: { portalToken: affilie.portalToken, statut: affilie.statut } }, { status: 201 });
  } catch (err) {
    console.error("[affiliation/rejoindre]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
