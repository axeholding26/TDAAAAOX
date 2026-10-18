import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { revoquerMembreAdmin, changerRoleMembre, reponseErreur } from "@/lib/admin-actions";
import { journaliser } from "@/lib/command-center/serveur";

async function superAdmin() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Réservé au super-admin" }, { status: 403 });
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await superAdmin();
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  const { role } = await req.json().catch(() => ({}));
  try {
    const r = await changerRoleMembre(id, role, session.userId);
    await journaliser(session, "equipe.role", "User", id, { role: r.avant }, { role: r.apres });
    return NextResponse.json({ success: true, role: r.apres });
  } catch (err) {
    return reponseErreur(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await superAdmin();
  if (session instanceof NextResponse) return session;
  const { id } = await params;
  try {
    const avant = await revoquerMembreAdmin(id, session.userId);
    await journaliser(session, "equipe.revoquer", "User", id, avant, null);
    return NextResponse.json({ success: true });
  } catch (err) {
    return reponseErreur(err);
  }
}
