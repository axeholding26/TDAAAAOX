import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ varianteId: string }> };

// GET /api/v/[varianteId] — public: résout une variante de prix pour le storefront
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { varianteId } = await params;

    const variante = await prisma.variantePrix.findUnique({
      where: { id: varianteId },
      include: {
        produit: {
          select: {
            id: true, nom: true, slug: true, images: true, type: true,
            tenant: { select: { slug: true, nomBoutique: true, devise: true } },
          },
        },
      },
    });

    if (!variante) return NextResponse.json({ error: "Variante introuvable" }, { status: 404 });
    if (!variante.actif) return NextResponse.json({ error: "Cette offre n'est plus disponible" }, { status: 410 });

    return NextResponse.json({ variante });
  } catch (err) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
