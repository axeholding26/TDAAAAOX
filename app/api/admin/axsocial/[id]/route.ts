import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { supprimerPostAxsocial, reponseErreur } from "@/lib/admin-actions";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/command-center/serveur";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Réservé au super-admin" }, { status: 403 });

  const { id } = await params;
  try {
    const avant = await prisma.postSocial.findUnique({ where: { id }, select: { type: true, contenu: true } });
    await supprimerPostAxsocial(id);
    await journaliser(session, "axsocial.supprimer", "PostSocial", id, avant, null);
    return NextResponse.json({ success: true });
  } catch (err) {
    return reponseErreur(err);
  }
}
