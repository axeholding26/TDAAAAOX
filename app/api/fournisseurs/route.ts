// Fournisseurs de la boutique. GET : liste simple (sélecteurs, import CSV) ;
// la recherche notée et comparée est dans /api/fournisseurs/intelligence.
// POST : création — tout ce qui est saisi ici est « déclaré », jamais vérifié.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accesSourcing, reponseErreur } from "@/lib/sourcing/acces";
import { recalculer, schemaFournisseur } from "@/lib/sourcing/fournisseurs/service";

export async function GET() {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const fournisseurs = await prisma.fournisseur.findMany({
    where: { tenantId: acces.tenantId },
    include: { _count: { select: { produits: true, offres: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ fournisseurs });
}

export async function POST(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    const data = schemaFournisseur.parse(await req.json());
    const fournisseur = await prisma.fournisseur.create({ data: { ...data, tenantId: acces.tenantId } });
    await recalculer(acces.tenantId, fournisseur.id);
    return NextResponse.json({ fournisseur }, { status: 201 });
  } catch (e) {
    return reponseErreur(e);
  }
}
