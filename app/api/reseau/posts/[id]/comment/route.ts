import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  const { id: postId } = await params;
  const { contenu } = await req.json();
  if (!contenu?.trim()) return NextResponse.json({ error: "Contenu requis" }, { status: 400 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { nomBoutique: true } });
  const comment = await prisma.commentaireSocial.create({
    data: { postId, tenantId, auteur: tenant?.nomBoutique || "Boutique", contenu: contenu.trim() },
  });
  return NextResponse.json(comment, { status: 201 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: postId } = await params;
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");

  const comments = await prisma.commentaireSocial.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    take: 30,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
  const nextCursor = comments.length === 30 ? comments[comments.length - 1].id : null;
  return NextResponse.json({ comments, nextCursor });
}
