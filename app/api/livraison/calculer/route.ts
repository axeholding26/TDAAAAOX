import { NextResponse } from "next/server";
import { calculerOptionsLivraison } from "@/lib/livraison";
import { codePays } from "@/lib/devise-convert";

// POST /api/livraison/calculer
// Body: { tenantId, pays, zone?, poids?, montantCommande }
// Options de livraison applicables au pays (et quartier) du client, triées par prix.
export async function POST(req: Request) {
  const body = await req.json();
  const { tenantId, pays, zone, poids = 0, montantCommande = 0 } = body;

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requis" }, { status: 400 });
  }

  const options = await calculerOptionsLivraison({ tenantId, pays: codePays(pays), zone, poids, montantCommande });

  return NextResponse.json({ options });
}
