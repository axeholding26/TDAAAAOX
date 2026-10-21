// Retraits des livreurs (lib/gains-livreur.ts) : même circuit manuel que les retraits marchands —
// Axso fait le transfert dans NotchPay puis clôture ici (Admin › Finances).
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, getAdminSessionPour, estAdminComplet } from "@/lib/admin-auth";
import { journaliser } from "@/lib/command-center/serveur";
import { cloturerRetraitLivreur } from "@/lib/gains-livreur";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAdminSessionPour("finances");
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const retraits = await prisma.retraitLivreur.findMany({
    where: { statut: "en_attente" },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { livreur: { select: { nom: true, tenant: { select: { nomBoutique: true } } } } },
  });
  // Même forme que /api/admin/wallet/retraits pour AdminRetraitsManuels.
  return NextResponse.json({
    retraits: retraits.map(({ livreur, ...r }) => ({
      ...r, methode: "mobile_money",
      nomBoutique: `${livreur.nom} · ${livreur.tenant ? `livreur de ${livreur.tenant.nomBoutique}` : "livreur plateforme"}`,
    })),
  });
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
    const r = await cloturerRetraitLivreur(id, action === "payer");
    await journaliser(session, `retrait_livreur.${action}`, "RetraitLivreur", id, { statut: "en_attente", montant: r.montant, devise: r.devise, livreurId: r.livreurId }, { statut: action === "payer" ? "paye" : "refuse" });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Erreur" }, { status: 400 });
  }
}
