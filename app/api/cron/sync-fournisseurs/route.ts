// Sync automatique des prix/stocks fournisseurs dropshipping — tâche planifiée,
// protégée par CRON_SECRET (elle touche toutes les boutiques). AXIA appelle
// directement synchroniserFournisseurs() pour la boutique du marchand.
import { NextResponse } from "next/server";
import { synchroniserFournisseurs } from "@/lib/sync-fournisseurs";

export const maxDuration = 60;

function autorise(req: Request) {
  const secret = process.env.CRON_SECRET;
  return !!secret && req.headers.get("x-cron-secret") === secret;
}

export async function POST(req: Request) {
  if (!autorise(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await synchroniserFournisseurs(body.tenantId));
}

export async function GET(req: Request) {
  if (!autorise(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json(await synchroniserFournisseurs(new URL(req.url).searchParams.get("tenantId") ?? undefined));
}
