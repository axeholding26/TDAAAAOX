// Circuit manuel des retraits : tout ce que NotchPay ne sait pas envoyer seul
// (autre opérateur que MTN/Orange Cameroun, autre devise, virement bancaire).
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { cloturerRetraitManuel } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const retraits = await prisma.retrait.findMany({
    where: { statut: "en_attente", reference: null },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: retraits.map(r => r.tenantId) } },
    select: { id: true, nomBoutique: true },
  });
  const noms = Object.fromEntries(tenants.map(t => [t.id, t.nomBoutique]));

  return NextResponse.json({ retraits: retraits.map(r => ({ ...r, nomBoutique: noms[r.tenantId] ?? "" })) });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — réservé au super-admin" }, { status: 403 });

  const { id, action } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !["payer", "refuser"].includes(action)) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  try {
    await cloturerRetraitManuel(id, action === "payer");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erreur" }, { status: 400 });
  }
}
