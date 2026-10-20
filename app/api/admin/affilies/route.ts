// Commissions d'affiliés à verser (circuit manuel, voir lib/affiliation.ts) : Axso fait le
// transfert dans NotchPay puis clôture ici. Même format que /api/admin/wallet/retraits.
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, getAdminSessionPour, estAdminComplet } from "@/lib/admin-auth";
import { journaliser } from "@/lib/command-center/serveur";
import { cloturerCommissionManuelle } from "@/lib/affiliation";
import { operateurCameroun } from "@/lib/wallet";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSessionPour("affilies");
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const paiements = await prisma.paiementCommission.findMany({ where: { statut: "en_attente", reference: null }, orderBy: { createdAt: "asc" }, take: 100 });
  const [tenants, affilies] = await Promise.all([
    prisma.tenant.findMany({ where: { id: { in: paiements.map((p) => p.tenantId) } }, select: { id: true, nomBoutique: true, devise: true } }),
    prisma.affilie.findMany({ where: { id: { in: paiements.map((p) => p.affilieurId) } }, select: { id: true, nom: true, email: true } }),
  ]);
  const t = new Map(tenants.map((x) => [x.id, x]));
  const a = new Map(affilies.map((x) => [x.id, x]));
  return NextResponse.json({
    retraits: paiements.map((p) => ({
      id: p.id, nomBoutique: t.get(p.tenantId)?.nomBoutique ?? "", montant: p.montant, devise: t.get(p.tenantId)?.devise ?? "XAF",
      methode: "mobile_money", destinataire: p.telephone ?? "", operateur: operateurCameroun(p.telephone)?.toUpperCase(),
      notes: `Affilié : ${a.get(p.affilieurId)?.nom ?? "?"}${a.get(p.affilieurId)?.email ? ` (${a.get(p.affilieurId)!.email})` : ""}`,
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!estAdminComplet(session)) return NextResponse.json({ error: "Lecture seule — réservé au super-admin" }, { status: 403 });

  const { id, action } = await req.json().catch(() => ({}));
  if (typeof id !== "string" || !["payer", "refuser"].includes(action)) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  try {
    const avant = await prisma.paiementCommission.findUnique({ where: { id }, select: { statut: true, montant: true, tenantId: true, affilieurId: true } });
    await cloturerCommissionManuelle(id, action === "payer");
    await journaliser(session, `commission.${action}`, "PaiementCommission", id, avant, { statut: action === "payer" ? "traite" : "echec" });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erreur" }, { status: 400 });
  }
}
