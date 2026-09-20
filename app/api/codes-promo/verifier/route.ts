// API — Vérifier un code promo (storefront)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const slug = searchParams.get("slug");

  if (!code || !slug) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const codePromo = await prisma.codePromo.findFirst({
    where: {
      tenantId: tenant.id,
      code: code.toUpperCase(),
      actif: true,
    },
  });

  if (!codePromo) {
    return NextResponse.json({ error: "Code invalide" }, { status: 404 });
  }

  if (codePromo.maxUtilisations && codePromo.utilisations >= codePromo.maxUtilisations) {
    return NextResponse.json({ error: "Code épuisé" }, { status: 400 });
  }

  if (codePromo.dateExpiration && new Date() > codePromo.dateExpiration) {
    return NextResponse.json({ error: "Code expiré" }, { status: 400 });
  }

  return NextResponse.json({
    type: codePromo.type,
    valeur: codePromo.valeur,
    reduction: codePromo.valeur,
  });
}
