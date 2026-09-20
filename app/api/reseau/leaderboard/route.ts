import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const top = await prisma.tenant.findMany({
    where: { statut: "active" },
    orderBy: { commandes: { _count: "desc" } },
    take: 10,
    select: {
      id: true, nomBoutique: true, logoUrl: true, slug: true, pays: true,
      _count: { select: { commandes: true, produits: true } },
    },
  });

  return NextResponse.json({ leaderboard: top });
}
