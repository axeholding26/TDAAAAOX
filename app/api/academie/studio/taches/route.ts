// File de l'AI Course Studio : le tableau de bord appelle cette route tant que des tâches
// sont en attente (pas de processus permanent, compatible Vercel). Le cron
// /api/cron/automatisations reprend les tâches restantes de toutes les boutiques.
import { NextResponse } from "next/server";
import { tenantDeSession, traiterTaches } from "@/lib/academie/studio";

export const maxDuration = 60;

export async function POST() {
  const tenantId = await tenantDeSession();
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  // Une génération peut durer ~40 s : on n'en démarre plus après 15 s.
  const faites = await traiterTaches({ tenantId, demarrerAvant: Date.now() + 15_000, max: 3 });
  return NextResponse.json({ faites });
}
