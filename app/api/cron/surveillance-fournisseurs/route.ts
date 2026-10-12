// Surveillance continue des fournisseurs (Supplier Intelligence) — tâche
// planifiée, protégée par CRON_SECRET (elle parcourt toutes les boutiques) :
// expiration des certifications, nouveaux signaux de risque, meilleur
// fournisseur disponible. Voir surveiller() dans lib/sourcing/fournisseurs/service.ts.
import { NextResponse } from "next/server";
import { surveiller } from "@/lib/sourcing/fournisseurs/service";

export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !(req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json(await surveiller(new URL(req.url).searchParams.get("tenantId") ?? undefined));
}

export const POST = GET;
