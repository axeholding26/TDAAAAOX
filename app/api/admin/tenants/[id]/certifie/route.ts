import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { certifierBoutique, reponseErreur } from "@/lib/admin-actions";
import { prisma } from "@/lib/prisma";
import { journaliser } from "@/lib/command-center/serveur";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — action réservée au super-admin" }, { status: 403 });

  const { id } = await params;
  const { certifie } = await req.json().catch(() => ({}));
  try {
    const avant = await prisma.tenant.findUnique({ where: { id }, select: { certifie: true } });
    const r = await certifierBoutique(id, certifie);
    await journaliser(session, "boutique.certifie", "Tenant", id, avant, r);
    return NextResponse.json({ success: true, ...r });
  } catch (err) {
    return reponseErreur(err);
  }
}
