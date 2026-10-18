// Tâche planifiée des automatisations d'AXSO CONTROL : lance les automatisations horaires
// arrivées à échéance et reprend les exécutions en attente (délai écoulé, nouvel essai, accord
// du marchand donné ou refusé). Protégée par CRON_SECRET, comme les autres tâches (en-tête
// `x-cron-secret`, ou `Authorization: Bearer` que Vercel Cron envoie de lui-même).
//
// Faite pour passer toutes les 5 minutes. vercel.json ne la planifie qu'une fois par jour
// (comme les autres tâches du projet : plusieurs passages par jour demandent le plan Pro de
// Vercel) ; d'ici là, un planificateur externe l'appelle avec `x-cron-secret`, comme
// /api/cron/publications. Un passage en retard n'est jamais perdu, seulement décalé.
import { reprendreImportsEchus } from "@/lib/import-creations/pipeline";
import { NextResponse } from "next/server";
import { passeDuCron } from "@/lib/controle-ia/automatisations";
import { passeRelances } from "@/lib/relances";
import { reconcilierPaiements } from "@/lib/reconciliation-paiements";
import { passeRappelsLive } from "@/lib/live/service";
import { traiterTaches } from "@/lib/academie/studio";

export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !(req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  // Au même passage : relances automatiques (lib/relances.ts) et vérification des paiements NotchPay
  // (lib/reconciliation-paiements.ts) — appelée souvent, elle confirme un paiement sans webhook en minutes.
  const erreur = (e: any) => ({ erreur: String(e?.message ?? e) });
  // Rappels des événements live (lib/live/service.ts) : idempotents, rattrapés au passage suivant.
  const [automatisations, relances, paiements, imports, rappelsLive, studio] = await Promise.all([passeDuCron(), passeRelances().catch(erreur), reconcilierPaiements().catch(erreur), reprendreImportsEchus().catch(erreur), passeRappelsLive().catch(erreur),
    // File de l'AI Course Studio (lib/academie/studio.ts) : reprend les tâches dues de toutes les boutiques.
    traiterTaches({ demarrerAvant: Date.now() + 10_000, max: 2 }).catch(erreur)]);
  return NextResponse.json({ ...automatisations, relances, paiements, imports, rappelsLive, studio });
}

export const POST = GET;
