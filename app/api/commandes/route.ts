// API Route — Gestion des commandes
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

    const tenantId = (session.user as any)?.tenantId;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const statut = searchParams.get("statut");

    const where: any = { tenantId };
    if (statut) where.statut = statut;

    const [commandes, total] = await Promise.all([
      prisma.commande.findMany({
        where,
        include: {
          lignes: true,
          client: true,
          commission: true,
          escrow: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.commande.count({ where }),
    ]);

    return NextResponse.json({ commandes, total, page, limit });
  } catch (err) {
    return NextResponse.json({ message: "Erreur serveur" }, { status: 500 });
  }
}
