import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { supprimerPostAxsocial, reponseErreur } from "@/lib/admin-actions";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Réservé au super-admin" }, { status: 403 });

  const { id } = await params;
  try {
    await supprimerPostAxsocial(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return reponseErreur(err);
  }
}
