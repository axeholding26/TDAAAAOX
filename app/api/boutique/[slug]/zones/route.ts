import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET public — liste des zones de livraison d'une boutique, pour le
// sélecteur de zone au checkout storefront (pas de session requise).
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, parametresLivraison: true },
  });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const zones = ((tenant.parametresLivraison as any)?.zones ?? []) as string[];
  return NextResponse.json({ zones });
}
