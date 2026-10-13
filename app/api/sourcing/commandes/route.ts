// Commandes à faire livrer par un fournisseur (lib/sourcing/commandes.ts). La création et le
// changement de statut d'une commande fournisseur restent sur /api/dropshipping/commandes-fournisseur.
import { NextResponse } from "next/server";
import { accesSourcing, reponseErreur } from "@/lib/sourcing/acces";
import { commandesSourcing } from "@/lib/sourcing/commandes";

export async function GET() {
  const acces = await accesSourcing();
  if (acces instanceof NextResponse) return acces;
  try {
    return NextResponse.json({ commandes: await commandesSourcing(acces.tenantId) });
  } catch (e) {
    return reponseErreur(e);
  }
}
