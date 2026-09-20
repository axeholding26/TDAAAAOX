import { NextResponse } from "next/server";
import { calculerOptionsLivraison } from "@/lib/livraison";

// POST /api/livraison/calculer
// Body: { tenantId, zone, poids, montantCommande }
// Returns applicable shipping rules sorted by price
export async function POST(req: Request) {
  const body = await req.json();
  const { tenantId, zone, poids = 0, montantCommande = 0 } = body;

  if (!tenantId || !zone) {
    return NextResponse.json({ error: "tenantId et zone requis" }, { status: 400 });
  }

  const options = await calculerOptionsLivraison({ tenantId, zone, poids, montantCommande });

  return NextResponse.json({ options });
}
