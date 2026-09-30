import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { certifierBoutique, reponseErreur } from "@/lib/admin-actions";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — action réservée au super-admin" }, { status: 403 });

  const { id } = await params;
  const { certifie } = await req.json();
  try {
    return NextResponse.json({ success: true, ...(await certifierBoutique(id, certifie)) });
  } catch (err) {
    return reponseErreur(err);
  }
}
