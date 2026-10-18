import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, getAdminSessionPour, estAdminComplet } from "@/lib/admin-auth";
import { journaliser } from "@/lib/command-center/serveur";
import { getPlatformTenantId } from "@/lib/wallet";
import { publierPostAxsocial, reponseErreur } from "@/lib/admin-actions";

export async function GET() {
  const session = await getAdminSessionPour("axsocial");
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const platformTenantId = await getPlatformTenantId();
  const posts = await prisma.postSocial.findMany({
    where: { tenantId: platformTenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { _count: { select: { reactions: true, commentaires: true } } },
  });

  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Réservé au super-admin" }, { status: 403 });

  const { contenu, type } = await req.json().catch(() => ({}));
  try {
    const post = await publierPostAxsocial(contenu, type);
    await journaliser(session, "axsocial.publier", "PostSocial", post.id, undefined, { type: post.type, contenu: post.contenu });
    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (err) {
    return reponseErreur(err);
  }
}
