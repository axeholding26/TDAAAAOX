// Annonces de la bannière « Ma boutique » à montrer à la boutique active (dates + ciblage, lib/annonces.ts).
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { annoncesVisibles } from "@/lib/annonces";

export async function GET() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  if (!tenantId) return NextResponse.json({ annonces: [] }, { status: 401 });
  const [boutique, annonces] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { pays: true, planType: true } }),
    prisma.annonce.findMany({ where: { active: true }, orderBy: [{ ordre: "asc" }, { createdAt: "asc" }] }),
  ]);
  if (!boutique) return NextResponse.json({ annonces: [] });
  return NextResponse.json({
    annonces: annoncesVisibles(annonces, boutique).map(({ id, marque, titre, texte, cta, lien, logo, fond, accent }) => ({ id, marque, titre, texte, cta, lien, logo, fond, accent })),
  });
}
