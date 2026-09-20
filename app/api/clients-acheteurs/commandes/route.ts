import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/clients-acheteurs/commandes?token=xxx&slug=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");

  if (!token || !slug) return NextResponse.json({ error: "token et slug requis" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });

  const compte = await prisma.compteAcheteur.findFirst({
    where: {
      token,
      tenantId: tenant.id,
      tokenExpire: { gt: new Date() },
    },
  });

  if (!compte) return NextResponse.json({ error: "Session expirée" }, { status: 401 });

  const commandes = await prisma.commande.findMany({
    where: { tenantId: tenant.id, clientEmail: compte.email },
    include: {
      lignes: {
        include: {
          produit: { select: { id: true, nom: true, images: true, type: true, fichierUrl: true } },
        },
      },
      facture: { select: { numero: true, statut: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    compte: { id: compte.id, email: compte.email, nom: compte.nom, telephone: compte.telephone },
    commandes,
  });
}
