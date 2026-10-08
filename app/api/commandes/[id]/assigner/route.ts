import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireNiveau } from "@/lib/permissions-server";
import { assignerLivreurCommande } from "@/lib/cycle-livraison";

// Logique partagée avec AXIA et les agents : lib/cycle-livraison.ts
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  // Droits d'équipe (module Commandes en écriture) plutôt que les seuls rôles owner/editeur :
  // un gérant autorisé doit pouvoir assigner, un membre en lecture seule non.
  const refus = await requireNiveau(session, "commandes", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  const { id } = await params;
  const { livreurId } = await req.json();
  const r = await assignerLivreurCommande({ commandeId: id, tenantId: (session.user as any)?.tenantId, livreurId: livreurId || null, source: "interface" });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json({ success: true, livreurNom: r.livreurNom, whatsappLivreurUrl: r.whatsappLivreurUrl, whatsappClientUrl: r.whatsappClientUrl });
}
