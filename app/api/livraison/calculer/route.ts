import { NextResponse } from "next/server";
import { calculerOptionsLivraison, poidsPanier } from "@/lib/livraison";
import { codePays } from "@/lib/devise-convert";

// POST /api/livraison/calculer
// Body: { tenantId, pays, zone?, items?: [{ produitId, quantite }], montantCommande }
// Options de livraison applicables au pays (et quartier) du client, triées par prix.
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { tenantId, pays, zone, items, montantCommande = 0 } = body;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requis" }, { status: 400 });
  }

  // Poids lu en base depuis le panier (les règles au poids n'étaient jamais appliquées : poids toujours 0).
  const poids = Array.isArray(items) ? await poidsPanier(tenantId, items.slice(0, 50)) : 0;
  const options = await calculerOptionsLivraison({ tenantId, pays: codePays(pays), zone, poids, montantCommande });

  return NextResponse.json({ options });
}
