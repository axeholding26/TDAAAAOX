import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireNiveau } from "@/lib/permissions-server";
import { marquerEspecesRemises } from "@/lib/cycle-livraison";

// PATCH — le marchand confirme avoir reçu le cash COD remis par un livreur.
// Logique partagée avec AXIA : lib/cycle-livraison.ts
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const refus = await requireNiveau(session, "commandes", "ecriture");
  if (refus) return NextResponse.json({ error: refus.error }, { status: refus.status });

  const { commandeIds } = await req.json();
  if (!Array.isArray(commandeIds) || commandeIds.length === 0) {
    return NextResponse.json({ error: "commandeIds requis" }, { status: 400 });
  }
  const user = session.user as any;
  const r = await marquerEspecesRemises({ tenantId: user.tenantId, userId: user.id, commandeIds });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json({ ok: true, count: r.count });
}
