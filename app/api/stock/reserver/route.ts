import { NextResponse } from "next/server";

// Route désactivée : publique, sans authentification, elle permettait à n'importe qui
// d'augmenter le stock d'un produit (action « liberer »). Aucun appelant dans le code.
// À supprimer (avec la mention dans lib/pos/stock.ts).
export async function POST() {
  return NextResponse.json({ error: "Route supprimée" }, { status: 410 });
}
