import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { retirerWalletPlateforme, reponseErreur } from "@/lib/admin-actions";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — retrait réservé au super-admin" }, { status: 403 });

  const { montant, methode, destinataire, operateur, notes } = await req.json();
  try {
    const retrait = await retirerWalletPlateforme({ montant, methode, destinataire, operateur, notes });
    return NextResponse.json({ success: true, retrait });
  } catch (err) {
    return reponseErreur(err);
  }
}
