import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const tenantId = (session.user as any)?.tenantId;
  const { id: postId } = await params;
  const { emoji = "❤️" } = await req.json().catch(() => ({}));

  const existing = await prisma.reactionSociale.findUnique({
    where: { postId_tenantId: { postId, tenantId } },
  });

  if (existing) {
    await prisma.reactionSociale.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  }

  await prisma.reactionSociale.create({ data: { postId, tenantId, emoji } });
  return NextResponse.json({ liked: true });
}
