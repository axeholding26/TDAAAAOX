import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const type   = searchParams.get("type"); // post | story | video | produit | milestone

  const now  = new Date();
  const where: any = {
    OR: [
      { expireAt: null },
      { expireAt: { gt: now } },
    ],
  };
  if (type && type !== "tous") where.type = type;

  const posts = await prisma.postSocial.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 20,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    include: {
      tenant: {
        select: {
          id: true, nomBoutique: true, logoUrl: true, pays: true,
          devise: true, slug: true,
          _count: { select: { commandes: true, produits: true } },
        },
      },
      reactions:    { select: { tenantId: true, emoji: true } },
      commentaires: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, auteur: true, contenu: true, createdAt: true },
      },
      _count: { select: { reactions: true, commentaires: true } },
    },
  });

  // Incrémenter les vues
  if (posts.length > 0) {
    await prisma.postSocial.updateMany({
      where: { id: { in: posts.map(p => p.id) } },
      data: { vues: { increment: 1 } },
    }).catch(() => {});
  }

  const nextCursor = posts.length === 20 ? posts[posts.length - 1].id : null;
  return NextResponse.json({ posts, nextCursor });
}
