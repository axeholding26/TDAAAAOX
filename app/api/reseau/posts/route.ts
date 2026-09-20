import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant manquant" }, { status: 400 });

  const body = await req.json();
  const { type = "post", contenu, mediaUrls = [], produitId, produitNom, produitPrix, produitImg, scoreValeur, scoreLabel, sondageOptions } = body;

  if (!contenu?.trim() && !mediaUrls.length && !produitId && !scoreLabel) {
    return NextResponse.json({ error: "Contenu requis" }, { status: 400 });
  }

  const expireAt = type === "story" ? new Date(Date.now() + 24 * 3600 * 1000) : null;

  const post = await prisma.postSocial.create({
    data: {
      tenantId, type,
      contenu: contenu?.slice(0, 2000),
      mediaUrls,
      produitId, produitNom, produitPrix, produitImg,
      scoreValeur, scoreLabel,
      sondageOptions: sondageOptions || [],
      sondageVotes:   sondageOptions?.map(() => 0) || [],
      expireAt,
    },
    include: {
      tenant: { select: { nomBoutique: true, logoUrl: true, slug: true } },
      _count: { select: { reactions: true, commentaires: true } },
    },
  });

  return NextResponse.json(post, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  const { id } = await req.json();

  const post = await prisma.postSocial.findUnique({ where: { id } });
  if (!post || post.tenantId !== tenantId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  await prisma.postSocial.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
