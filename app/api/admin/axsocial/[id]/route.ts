import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { getPlatformTenantId } from "@/lib/wallet";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Réservé au super-admin" }, { status: 403 });

  const { id } = await params;
  const platformTenantId = await getPlatformTenantId();

  const post = await prisma.postSocial.findUnique({ where: { id } });
  if (!post || post.tenantId !== platformTenantId) {
    return NextResponse.json({ error: "Publication introuvable" }, { status: 404 });
  }

  await prisma.postSocial.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
