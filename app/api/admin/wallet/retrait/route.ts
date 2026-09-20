import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { getPlatformTenantId, initierRetrait } from "@/lib/wallet";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — retrait réservé au super-admin" }, { status: 403 });

  const body = await req.json();
  const { montant, methode, destinataire, operateur, notes } = body;

  if (!montant || montant <= 0) return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  if (!methode || !["mobile_money", "virement_bancaire"].includes(methode)) {
    return NextResponse.json({ error: "Méthode invalide" }, { status: 400 });
  }
  if (!destinataire?.trim()) return NextResponse.json({ error: "Destinataire requis" }, { status: 400 });

  try {
    const platformTenantId = await getPlatformTenantId();
    const retrait = await initierRetrait({
      tenantId: platformTenantId,
      montant: Number(montant),
      devise: "XAF",
      methode,
      destinataire,
      operateur,
      notes,
    });
    return NextResponse.json({ success: true, retrait });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Erreur retrait" }, { status: 400 });
  }
}
