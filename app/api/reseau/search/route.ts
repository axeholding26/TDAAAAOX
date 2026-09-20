import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ posts: [], boutiques: [] });

  const [posts, boutiques] = await Promise.all([
    prisma.postSocial.findMany({
      where: {
        AND: [
          { OR: [
            { contenu: { contains: q, mode: "insensitive" } },
            { produitNom: { contains: q, mode: "insensitive" } },
            { scoreLabel: { contains: q, mode: "insensitive" } },
          ]},
          { OR: [{ expireAt: null }, { expireAt: { gt: new Date() } }] },
        ],
      },
      take: 10, orderBy: { createdAt: "desc" },
      include: {
        tenant: { select: { id: true, nomBoutique: true, logoUrl: true, slug: true } },
        _count: { select: { reactions: true, commentaires: true } },
      },
    }),
    prisma.tenant.findMany({
      where: {
        OR: [
          { nomBoutique: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
        statut: "active",
      },
      take: 5, select: { id: true, nomBoutique: true, logoUrl: true, slug: true, pays: true, _count: { select: { commandes: true } } },
    }),
  ]);

  return NextResponse.json({ posts, boutiques });
}
