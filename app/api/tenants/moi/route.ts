import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      nomBoutique: true,
      description: true,
      categorie: true,
      pays: true,
      devise: true,
      email: true,
      telephone: true,
      adresse: true,
      whatsapp: true,
      logoUrl: true,
      bannerUrl: true,
      themeId: true,
      themeConfig: true,
      metaTitle: true,
      metaDescription: true,
      socialLinks: true,
      parametresLivraison: true,
      parametresPaiement: true,
      customDomain: true,
      statut: true,
      planType: true,
      commissionRate: true,
      createdAt: true,
      _count: { select: { produits: true, commandes: true, clients: true } },
    },
  });

  if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

  return NextResponse.json({ tenant });
}
