// Circuit manuel des retraits (tous depuis le 20/10/2026, voir lib/wallet.ts) : Axso fait le
// transfert dans NotchPay puis clôture ici.
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, getAdminSessionPour, estAdminComplet } from "@/lib/admin-auth";
import { journaliser } from "@/lib/command-center/serveur";
import { cloturerRetraitManuel } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSessionPour("finances");
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

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
    const avant = await prisma.retrait.findUnique({ where: { id }, select: { statut: true, montant: true, devise: true, tenantId: true } });
    await cloturerRetraitManuel(id, action === "payer");
    await journaliser(session, `retrait.${action}`, "Retrait", id, avant, { statut: action === "payer" ? "paye" : "refuse" });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erreur" }, { status: 400 });
  }
}
