// API CRUD Campagnes Publicitaires — Meta, Google, TikTok
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schemaCampagne = z.object({
  plateforme: z.enum(["meta", "google", "tiktok"]),
  nom: z.string().min(2),
  objectif: z.enum(["trafic", "conversions", "notoriete", "leads"]).default("conversions"),
  budget: z.number().positive(),
  budgetJour: z.number().positive().optional(),
  devise: z.string().default("XOF"),
  dateDebut: z.string().optional(),
  dateFin: z.string().optional(),
  ciblePays: z.array(z.string()).default([]),
  cibleAge: z.string().default("18-45"),
  cibleInterets: z.array(z.string()).default([]),
  titreAd: z.string().optional(),
  descriptionAd: z.string().optional(),
  imageAdUrl: z.string().url().optional(),
  videoAdUrl: z.string().url().optional(),
  urlDestination: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const { searchParams } = new URL(req.url);
    const plateforme = searchParams.get("plateforme");

    const where: any = { tenantId };
    if (plateforme) where.plateforme = plateforme;

    const campagnes = await prisma.campagne.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { publicites: { take: 3 } },
    });

    // Stats globales
    const stats = {
      totalDepense: campagnes.reduce((s, c) => s + c.depense, 0),
      totalImpressions: campagnes.reduce((s, c) => s + c.impressions, 0),
      totalClics: campagnes.reduce((s, c) => s + c.clics, 0),
      totalConversions: campagnes.reduce((s, c) => s + c.conversions, 0),
      roas: campagnes.length ? campagnes.reduce((s, c) => s + c.roas, 0) / campagnes.length : 0,
    };

    return NextResponse.json({ campagnes, stats });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const body = await req.json();
    const data = schemaCampagne.parse(body);

    const campagne = await prisma.campagne.create({
      data: {
        ...data,
        tenantId,
        dateDebut: data.dateDebut ? new Date(data.dateDebut) : undefined,
        dateFin: data.dateFin ? new Date(data.dateFin) : undefined,
        statut: "brouillon",
      },
    });

    return NextResponse.json({ campagne }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Données invalides", erreurs: err.issues }, { status: 400 });
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    // Seuls les champs que le marchand édite, validés : jamais tenantId, métriques ni identifiants Meta/Google.
    const { id, ...corps } = await req.json();
    const data = schemaCampagne.omit({ plateforme: true }).partial()
      .extend({ statut: z.enum(["brouillon", "active", "pause", "terminee"]).optional() })
      .parse(corps);
    const campagne = await prisma.campagne.findFirst({ where: { id, tenantId } });
    if (!campagne) return NextResponse.json({ message: "Campagne introuvable" }, { status: 404 });

    const updated = await prisma.campagne.update({
      where: { id },
      data: {
        ...data,
        ...(data.dateDebut !== undefined && { dateDebut: data.dateDebut ? new Date(data.dateDebut) : null }),
        ...(data.dateFin !== undefined && { dateFin: data.dateFin ? new Date(data.dateFin) : null }),
      },
    });
    return NextResponse.json({ campagne: updated });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ message: "Données invalides", erreurs: err.issues }, { status: 400 });
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ message: "ID requis" }, { status: 400 });

    const c = await prisma.campagne.findFirst({ where: { id, tenantId } });
    if (!c) return NextResponse.json({ message: "Introuvable" }, { status: 404 });

    await prisma.campagne.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
