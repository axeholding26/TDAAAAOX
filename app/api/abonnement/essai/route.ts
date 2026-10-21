import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { boutiquesDuCompte } from "@/lib/tenant";
import { demarrerEssai, repondreEssai } from "@/lib/essai";

// Essai Illimité de 7 jours (lib/essai.ts) : démarrer, refuser, ou fenêtre de fin vue.
// Décision du propriétaire seul, comme tout changement d'abonnement.
export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!session || !tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { proprietaire } = await boutiquesDuCompte((session.user as any).id);
  if (!proprietaire.includes(tenantId)) return NextResponse.json({ error: "Seul le propriétaire peut gérer l'essai" }, { status: 403 });

  const { action } = await req.json().catch(() => ({}));
  if (action === "demarrer") {
    const finLe = await demarrerEssai(tenantId);
    return finLe
      ? NextResponse.json({ succes: true, finLe })
      : NextResponse.json({ error: "L'essai gratuit a déjà été utilisé sur ce compte" }, { status: 409 });
  }
  if (action === "refuser" || action === "fin_vue") {
    await repondreEssai(tenantId, action === "refuser" ? "refuse" : "fin_vue");
    return NextResponse.json({ succes: true });
  }
  return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
}
