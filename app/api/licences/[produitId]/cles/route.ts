import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

type Ctx = { params: Promise<{ produitId: string }> };

// ─── Helpers génération ────────────────────────────────────────────────────────

function genererAlpha(longueur: number, prefixe = ""): string {
  const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // pas O/0/I/1 pour éviter confusion
  let cle = "";
  for (let i = 0; i < longueur; i++) {
    cle += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  // Groupes de 4 pour lisibilité (XXXX-XXXX-XXXX-XXXX)
  const groupes = cle.match(/.{1,4}/g)?.join("-") ?? cle;
  return prefixe ? `${prefixe}${groupes}` : groupes;
}

// GET — liste toutes les clés avec stats d'activation
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { produitId } = await params;

    const licenceProduit = await prisma.licenceProduit.findFirst({
      where: { produitId, produit: { tenantId } },
      include: {
        cles: {
          include: { _count: { select: { activations: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!licenceProduit) return NextResponse.json({ error: "Produit licence introuvable" }, { status: 404 });

    const stats = {
      total:      licenceProduit.cles.length,
      disponible: licenceProduit.cles.filter((c) => c.statut === "disponible").length,
      vendue:     licenceProduit.cles.filter((c) => c.statut === "vendue").length,
      expiree:    licenceProduit.cles.filter((c) => c.statut === "expiree").length,
      revoquee:   licenceProduit.cles.filter((c) => c.statut === "revoquee").length,
    };

    return NextResponse.json({ cles: licenceProduit.cles, stats, config: licenceProduit });
  } catch (err) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST — génère N clés auto OU importe des clés en stock
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { produitId } = await params;

    const licenceProduit = await prisma.licenceProduit.findFirst({
      where: { produitId, produit: { tenantId } },
    });
    if (!licenceProduit) return NextResponse.json({ error: "Produit licence introuvable" }, { status: 404 });

    const body = await req.json();
    const { mode, quantite, clesImportees } = body;
    // mode: "generer" | "importer"

    let nouvelles: string[] = [];

    if (mode === "generer") {
      const n = Math.min(parseInt(quantite) || 1, 500); // max 500 par lot
      for (let i = 0; i < n; i++) {
        let cle: string;
        let tentatives = 0;
        do {
          cle = licenceProduit.formatAuto === "uuid"
            ? randomUUID().toUpperCase()
            : genererAlpha(licenceProduit.longueur, licenceProduit.prefixe || "");
          tentatives++;
        } while (tentatives < 10 && await prisma.cleLicence.findUnique({ where: { cle } }));
        nouvelles.push(cle!);
      }
    } else if (mode === "importer") {
      // clesImportees: string[] déjà parsées et nettoyées côté client
      if (!Array.isArray(clesImportees)) return NextResponse.json({ error: "clesImportees requis" }, { status: 400 });
      // Dédupliquer et valider format basique
      const uniques = [...new Set(clesImportees.map((c: string) => c.trim()).filter((c: string) => c.length >= 4))];
      // Exclure celles qui existent déjà en base
      const existantes = await prisma.cleLicence.findMany({
        where: { cle: { in: uniques } },
        select: { cle: true },
      });
      const existantesSet = new Set(existantes.map((e) => e.cle));
      nouvelles = uniques.filter((c) => !existantesSet.has(c));
    } else {
      return NextResponse.json({ error: "mode doit être 'generer' ou 'importer'" }, { status: 400 });
    }

    if (nouvelles.length === 0) return NextResponse.json({ error: "Aucune clé valide à créer", doublons: true }, { status: 400 });

    await prisma.cleLicence.createMany({
      data: nouvelles.map((cle) => ({
        licenceProduitId: licenceProduit.id,
        cle,
        statut: "disponible",
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ ok: true, creees: nouvelles.length }, { status: 201 });
  } catch (err) {
    console.error("[licences/cles POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
