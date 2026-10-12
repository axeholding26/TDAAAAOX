// Tableau de bord profit + alertes, calculés sur les données réelles de la boutique.
import { NextResponse } from "next/server";
import { accesSourcing, reponseErreur } from "@/lib/sourcing/acces";
import { tableauDeBord } from "@/lib/sourcing/profit";
import { previsionsStock } from "@/lib/sourcing/stocks";
import { alertesSourcing } from "@/lib/sourcing/alertes";

// GET ?jours=7|30|90
export async function GET(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    const jours = [7, 30, 90].find((j) => String(j) === new URL(req.url).searchParams.get("jours")) ?? 30;
    const [tdb, stocks] = await Promise.all([tableauDeBord(acces.tenantId, jours), previsionsStock(acces.tenantId)]);
    return NextResponse.json({ ...tdb, alertes: await alertesSourcing(acces.tenantId, tdb, stocks) });
  } catch (e) {
    return reponseErreur(e);
  }
}
