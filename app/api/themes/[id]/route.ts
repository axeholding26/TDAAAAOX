import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    const body = await req.json();
    const { nom, description, config, effetId, badge, actif } = body;

    const theme = await prisma.theme.update({
      where: { id, tenantId },
      data: {
        ...(nom !== undefined && { nom }),
        ...(description !== undefined && { description }),
        ...(config !== undefined && { config }),
        ...(effetId !== undefined && { effetId }),
        ...(badge !== undefined && { badge }),
        ...(actif !== undefined && { actif }),
      },
    });

    return NextResponse.json({ theme });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const tenantId = (session.user as any)?.tenantId;
    const { id } = await params;

    await prisma.theme.delete({ where: { id, tenantId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
