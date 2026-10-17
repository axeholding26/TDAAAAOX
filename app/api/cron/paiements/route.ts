// Réconciliation quotidienne des paiements NotchPay (lib/reconciliation-paiements.ts).
// Protégée par CRON_SECRET comme les autres tâches planifiées.
import { NextResponse } from "next/server";
import { reconcilierPaiements } from "@/lib/reconciliation-paiements";

export const maxDuration = 60;

function autorise(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && (req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(req: Request) {
  if (!autorise(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const bilan = await reconcilierPaiements();
  console.log("[cron/paiements]", bilan);
  return NextResponse.json(bilan);
}
