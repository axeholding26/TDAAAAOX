import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

// Recompute actif + auto-renouvellement d'une variante selon ses dates
async function syncActivation(v: {
  id: string; actif: boolean; dateDebut: Date | null; dateFin: Date | null;
  renouvAuto: boolean; periodeValidite: string | null;
}) {
  const now = new Date();
  let actif = v.actif;
  let dateFin = v.dateFin;

  if (v.dateDebut && now < v.dateDebut) actif = false;
  else if (v.dateFin && now > v.dateFin) {
    if (v.renouvAuto && v.periodeValidite) {
      // Renouveler la fenêtre temporelle
      const dureeMs = periodeEnMs(v.periodeValidite);
      if (dureeMs > 0) {
        dateFin = new Date(v.dateFin.getTime() + dureeMs);
        actif = true;
      } else {
        actif = false;
      }
    } else {
      actif = false;
    }
  } else if (v.dateDebut) {
    actif = true; // dans la fenêtre valide
  }

  // Persister si changement
  if (actif !== v.actif || dateFin !== v.dateFin) {
    await prisma.variantePrix.update({ where: { id: v.id }, data: { actif, dateFin } });
  }
  return { actif, dateFin };
}

function periodeEnMs(periode: string): number {
  const map: Record<string, number> = {
    "7j":    7  * 86_400_000,
    "30j":   30 * 86_400_000,
    "90j":   90 * 86_400_000,
    "1an":  365 * 86_400_000,
  };
  return map[periode] ?? 0;
}

// GET /api/variantesPrix?produitId=xxx — liste avec activation synchronisée
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const produitId = req.nextUrl.searchParams.get("produitId");
    if (!produitId) return NextResponse.json({ error: "produitId requis" }, { status: 400 });

    // Vérifier appartenance
    const produit = await prisma.produit.findFirst({ where: { id: produitId, tenantId } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    const variantes = await prisma.variantePrix.findMany({
      where: { produitId },
      orderBy: { createdAt: "asc" },
    });

    // Sync activation pour chaque variante avec des dates
    await Promise.all(variantes.filter((v) => v.dateDebut || v.dateFin).map(syncActivation));

    const variantesSync = await prisma.variantePrix.findMany({
      where: { produitId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ variantes: variantesSync });
  } catch (err) {
    console.error("[api/variantesPrix GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// POST /api/variantesPrix — créer une variante de prix
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;

    const { produitId, nom, prix, prixPromo, periodeValidite, renouvAuto, autorisePromo, dateDebut, dateFin, slug: slugInput } =
      await req.json();

    if (!produitId || !nom || !prix) {
      return NextResponse.json({ error: "produitId, nom et prix sont requis" }, { status: 400 });
    }

    const produit = await prisma.produit.findFirst({ where: { id: produitId, tenantId } });
    if (!produit) return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });

    // Slug unique par produit
    let slug = slugInput ? slugify(slugInput) : slugify(nom);
    const existant = await prisma.variantePrix.findUnique({ where: { produitId_slug: { produitId, slug } } });
    if (existant) slug = `${slug}-${Date.now().toString(36)}`;

    const variante = await prisma.variantePrix.create({
      data: {
        produitId,
        tenantId,
        nom,
        slug,
        prix,
        prixPromo: prixPromo || null,
        periodeValidite: periodeValidite || null,
        renouvAuto:   renouvAuto   ?? false,
        autorisePromo: autorisePromo ?? true,
        actif:        true,
        dateDebut:    dateDebut ? new Date(dateDebut) : null,
        dateFin:      dateFin   ? new Date(dateFin)   : null,
      },
    });

    return NextResponse.json({ variante }, { status: 201 });
  } catch (err) {
    console.error("[api/variantesPrix POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
