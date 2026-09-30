import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { recompenserBoutique, reponseErreur } from "@/lib/admin-actions";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — action réservée au super-admin" }, { status: 403 });

  const { id } = await params;
  const { montant, raison, emoji, titre } = await req.json();
  try {
    await recompenserBoutique(id, { montant, raison, emoji, titre });
    return NextResponse.json({ success: true });
  } catch (err) {
    return reponseErreur(err);
  }
}
