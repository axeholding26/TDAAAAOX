// Génère un lien d'affiliation pour un produit/boutique
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { genererCodeAffiliation } from "@/lib/affiliation";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const affilieurId = (session.user as any)?.tenantId;
  if (!affilieurId) return NextResponse.json({ error: "Pas de boutique" }, { status: 400 });

  const { tenantId, produitId } = await req.json();
  if (!tenantId) return NextResponse.json({ error: "tenantId requis" }, { status: 400 });

  // Vérifie que le produit autorise l'affiliation
  if (produitId) {
    const produit = await prisma.produit.findFirst({
      where: { id: produitId, tenantId },
      select: { affiliationActive: true, nom: true },
    });
    if (!produit?.affiliationActive) {
      return NextResponse.json({ error: "Ce produit n'autorise pas l'affiliation" }, { status: 403 });
    }
  }

  // Vérifie si un lien existe déjà
  const existing = await prisma.affiliationLien.findFirst({
    where: { affilieurId, tenantId, produitId: produitId ?? null },
  });
  if (existing) {
    return NextResponse.json({ lien: existing });
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomBoutique: true } });
  let code = genererCodeAffiliation(tenant?.nomBoutique ?? "SHOP");

  // Unicité du code
  let tries = 0;
  while (tries < 5) {
    const exists = await prisma.affiliationLien.findUnique({ where: { code } });
    if (!exists) break;
    code = genererCodeAffiliation(tenant?.nomBoutique ?? "SHOP");
    tries++;
  }

  const lien = await prisma.affiliationLien.create({
    data: { tenantId, affilieurId, produitId: produitId ?? null, code },
  });

  return NextResponse.json({ lien });
}
