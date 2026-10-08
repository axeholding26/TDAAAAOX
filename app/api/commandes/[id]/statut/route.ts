import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireNiveau } from "@/lib/permissions-server";
import { changerStatutCommande } from "@/lib/cycle-livraison";

// Toute la logique (transitions, code de remise, WhatsApp, commission…) vit
// dans lib/cycle-livraison.ts, partagée avec AXIA et les agents.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const { statut, echecRaison, code } = await req.json();
  const user = session.user as any;

  if (user?.role !== "livreur") {
    const refus = await requireNiveau(session, "commandes", "ecriture");
    if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });
  }

  const r = await changerStatutCommande({
    commandeId: id,
    statut,
    echecRaison,
    code,
    acteur: user?.role === "livreur"
      ? { type: "livreur", userId: user.id }
      : { type: "marchand", tenantId: user?.tenantId, source: "interface" },
  });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json({ success: true, statut: r.statut, envoyeAuto: r.envoyeAuto, whatsappUrl: r.whatsappUrl });
}
