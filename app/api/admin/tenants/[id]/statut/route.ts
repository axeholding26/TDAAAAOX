import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { changerStatutBoutique, reponseErreur } from "@/lib/admin-actions";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/command-center/serveur";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — action réservée au super-admin" }, { status: 403 });

  const { id } = await params;
  const { statut } = await req.json().catch(() => ({}));
  try {
    const avant = await prisma.tenant.findUnique({ where: { id }, select: { statut: true } });
    const r = await changerStatutBoutique(id, statut);
    await journaliser(session, "boutique.statut", "Tenant", id, avant, r);
    return NextResponse.json({ success: true, ...r });
  } catch (err) {
    return reponseErreur(err);
  }
}
