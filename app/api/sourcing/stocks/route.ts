// Prévisions de rupture et quantités à recommander (lib/sourcing/stocks.ts).
import { NextResponse } from "next/server";
import { accesSourcing, reponseErreur } from "@/lib/sourcing/acces";
import { previsionsStock } from "@/lib/sourcing/stocks";

export async function GET() {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    return NextResponse.json({ previsions: await previsionsStock(acces.tenantId) });
  } catch (e) {
    return reponseErreur(e);
  }
}
