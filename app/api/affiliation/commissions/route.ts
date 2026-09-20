// Commissions d'affiliation reçues ou générées par le tenant connecté
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;

  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role") ?? "affilieur"; // affilieur | vendeur

  const where = role === "vendeur" ? { tenantId } : { affilieurId: tenantId };

  const commissions = await prisma.affiliationCommission.findMany({
    where,
    include: {
      lien: {
        include: {
          produit: { select: { nom: true, images: true } },
          tenant: { select: { nomBoutique: true } },
        },
      },
      commande: { select: { numero: true, montantTotal: true, devise: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const totaux = commissions.reduce(
    (acc, c) => ({
      total: acc.total + c.montantGagne,
      pending: acc.pending + (c.statut === "pending" ? c.montantGagne : 0),
      captured: acc.captured + (c.statut === "capturee" ? c.montantGagne : 0),
    }),
    { total: 0, pending: 0, captured: 0 }
  );

  return NextResponse.json({ commissions, totaux });
}
