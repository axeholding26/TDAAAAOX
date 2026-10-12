// Itinéraire proposé pour une commande (lib/sourcing/routage.ts).
import { NextResponse } from "next/server";
import { accesSourcing, erreur, reponseErreur } from "@/lib/sourcing/acces";
import { routerCommande } from "@/lib/sourcing/routage";

// GET ?commandeId=…
export async function GET(req: Request) {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  const commandeId = new URL(req.url).searchParams.get("commandeId");
  if (!commandeId) return erreur("commandeId requis");
  try {
    const route = await routerCommande(acces.tenantId, commandeId);
    return route ? NextResponse.json(route) : erreur("Commande introuvable", 404);
  } catch (e) {
    return reponseErreur(e);
  }
}
