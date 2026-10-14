// Tâche planifiée des automatisations d'AXSO CONTROL : lance les automatisations horaires
// arrivées à échéance et reprend les exécutions en attente (délai écoulé, nouvel essai, accord
// du marchand donné ou refusé). Protégée par CRON_SECRET, comme les autres tâches (en-tête
// `x-cron-secret`, ou `Authorization: Bearer` que Vercel Cron envoie de lui-même).
//
// Faite pour passer toutes les 5 minutes. vercel.json ne la planifie qu'une fois par jour
// (comme les autres tâches du projet : plusieurs passages par jour demandent le plan Pro de
// Vercel) ; d'ici là, un planificateur externe l'appelle avec `x-cron-secret`, comme
// /api/cron/publications. Un passage en retard n'est jamais perdu, seulement décalé.
import { NextResponse } from "next/server";
import { passeDuCron } from "@/lib/controle-ia/automatisations";

export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !(req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return NextResponse.json(await passeDuCron());
}

export const POST = GET;
