import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CATEGORIES_VALIDES = ["loyer", "electricite", "eau", "internet", "fournitures", "equipement", "salaires", "transport", "autre"];
const FREQUENCES_VALIDES = ["ponctuelle", "hebdomadaire", "mensuelle", "annuelle"];

// GET — liste des charges d'exploitation de la boutique physique
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(req.url);
    const debut = searchParams.get("debut");
    const fin = searchParams.get("fin");
    const statut = searchParams.get("statut");

    const where: any = { tenantId };
    if (debut || fin) {
      where.dateEnregistrement = {};
      if (debut) where.dateEnregistrement.gte = new Date(debut);
      if (fin) where.dateEnregistrement.lte = new Date(fin);
    }
    if (statut && statut !== "all") where.statut = statut;

    const charges = await prisma.chargeExploitation.findMany({ where, orderBy: { dateEnregistrement: "desc" }, take: 300 });

    const total = charges.reduce((s, c) => s + c.montant, 0);
    const parCategorie: Record<string, number> = {};
    for (const c of charges) parCategorie[c.categorie] = (parCategorie[c.categorie] || 0) + c.montant;

    return NextResponse.json({
      charges,
      stats: {
        total: Math.round(total * 100) / 100,
        enAttente: charges.filter(c => c.statut === "en_attente").reduce((s, c) => s + c.montant, 0),
        parCategorie,
      },
    });
  } catch (err) {
    console.error("[pos/charges GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — enregistre une nouvelle charge d'exploitation
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const userId = (session.user as any)?.id;

    const body = await req.json();
    const {
      categorie, description, montant, devise, frequence,
      dateEnregistrement, dateEcheance, statut, fournisseur, reference, notes,
    } = body;

    if (!categorie || !description || montant == null) {
      return NextResponse.json({ error: "categorie, description et montant requis" }, { status: 400 });
    }
    if (!CATEGORIES_VALIDES.includes(categorie)) {
      return NextResponse.json({ error: `categorie invalide. Valeurs: ${CATEGORIES_VALIDES.join(", ")}` }, { status: 400 });
    }
    if (Number(montant) <= 0) return NextResponse.json({ error: "Le montant doit être positif" }, { status: 400 });

    const charge = await prisma.chargeExploitation.create({
      data: {
        tenantId,
        categorie,
        description,
        montant: Number(montant),
        devise: devise || "XAF",
        frequence: FREQUENCES_VALIDES.includes(frequence) ? frequence : "ponctuelle",
        dateEnregistrement: dateEnregistrement ? new Date(dateEnregistrement) : new Date(),
        dateEcheance: dateEcheance ? new Date(dateEcheance) : null,
        statut: statut || "payee",
        fournisseur: fournisseur || null,
        reference: reference || null,
        notes: notes || null,
        creePar: userId || null,
      },
    });

    return NextResponse.json({ charge }, { status: 201 });
  } catch (err) {
    console.error("[pos/charges POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
