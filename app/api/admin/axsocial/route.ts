import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { getPlatformTenantId } from "@/lib/wallet";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

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

  const { contenu, type } = await req.json();
  if (!contenu?.trim()) return NextResponse.json({ error: "Contenu requis" }, { status: 400 });

  const platformTenantId = await getPlatformTenantId();
  const post = await prisma.postSocial.create({
    data: {
      tenantId: platformTenantId,
      type: type || "post",
      contenu: contenu.slice(0, 2000),
    },
  });

  return NextResponse.json({ success: true, post }, { status: 201 });
}
