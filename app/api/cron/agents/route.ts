// Cron horaire — déclenche l'orchestration autonome pour tous les tenants actifs
// À appeler via un cron job externe (Vercel Cron, Render Cron, ou cURL toutes les heures)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { orchestrerAutonomie, majProgressObjectif } from "@/lib/orchestrator";
import { traiterTachesEnAttente } from "@/lib/agent-consumer";

export async function GET(req: NextRequest) {
  // Sécurité basique — secret cron
  const cronSecret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const tenants = await prisma.tenant.findMany({
    where: { statut: "active" },
    select: { id: true, nomBoutique: true },
    take: 100,
  });

  const resultats: { tenantId: string; boutique: string; actions: string[]; tachesTraitees: number }[] = [];
  const erreurs: { tenantId: string; erreur: string }[] = [];

  for (const tenant of tenants) {
    try {
      await majProgressObjectif(tenant.id);
      const actions = await orchestrerAutonomie(tenant.id);
      // Exécute réellement les tâches que orchestrerAutonomie vient de publier
      // (auparavant elles restaient en "pending" indéfiniment — voir
      // lib/agent-consumer.ts pour le détail du problème corrigé).
      const traitements = await traiterTachesEnAttente(tenant.id);
      if (actions.length > 0 || traitements.length > 0) {
        resultats.push({ tenantId: tenant.id, boutique: tenant.nomBoutique, actions, tachesTraitees: traitements.length });
      }
    } catch (err) {
      erreurs.push({ tenantId: tenant.id, erreur: String(err) });
    }
  }

  return NextResponse.json({
    heure: new Date().toISOString(),
    tenants_traites: tenants.length,
    tenants_avec_actions: resultats.length,
    total_actions: resultats.reduce((s, r) => s + r.actions.length, 0),
    total_taches_traitees: resultats.reduce((s, r) => s + r.tachesTraitees, 0),
    resultats,
    erreurs,
  });
}
