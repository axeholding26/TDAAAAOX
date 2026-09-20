import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prixClient } from "@/lib/pricing";

// GET public — suggestions de recherche instantanée pour la navbar storefront
// (dropdown live sous l'input de recherche, pas de session requise). Reprend
// exactement le même filtre Prisma que /produits (nom/description/categorie,
// insensible à la casse), juste limité à 5 résultats.
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (!q) return NextResponse.json({ produits: [] });

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, statut: true, devise: true, commissionRate: true },
  });
  if (!tenant || tenant.statut !== "active") return NextResponse.json({ produits: [] });

  const taux = tenant.commissionRate ?? 0.06;

  const produits = await prisma.produit.findMany({
    where: {
      tenantId: tenant.id,
      actif: true,
      visibleListage: { not: false },
      OR: [
        { nom: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { categorie: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { ventes: "desc" },
    take: 5,
    select: { id: true, nom: true, prix: true, images: true },
  });

  return NextResponse.json({
    produits: produits.map((p) => ({
      id: p.id,
      nom: p.nom,
      prix: prixClient(p.prix, taux),
      image: p.images[0] ?? null,
    })),
    devise: tenant.devise,
  });
}
