import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id: postId } = await params;
  const { optionIndex } = await req.json();

  const post = await prisma.postSocial.findUnique({ where: { id: postId } });
  if (!post || post.type !== "sondage") return NextResponse.json({ error: "Sondage introuvable" }, { status: 404 });

  const votes = [...post.sondageVotes];
  if (optionIndex < 0 || optionIndex >= votes.length) return NextResponse.json({ error: "Index invalide" }, { status: 400 });
  votes[optionIndex] = (votes[optionIndex] || 0) + 1;

  const updated = await prisma.postSocial.update({ where: { id: postId }, data: { sondageVotes: votes } });
  return NextResponse.json({ sondageVotes: updated.sondageVotes });
}
