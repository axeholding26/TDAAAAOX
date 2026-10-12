// Intégrité du journal d'audit — droit : voir_audit.
// GET /api/pos/audit/integrite — relit la chaîne de hachage de la boutique
// (verifierChaineAudit) et dit si une ligne a été modifiée ou retirée.
// Limite assumée (lib/pos/audit.ts) : la chaîne protège contre l'application et
// les accès ordinaires, pas contre un administrateur de la base de données.
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { exigerDroit } from "@/lib/pos/droits";
import { verifierChaineAudit } from "@/lib/pos/audit";

// ponytail: 5 tranches de 10 000 lignes par appel ; au-delà la réponse dit « partiel » — passer à une vérification planifiée si un journal dépasse 50 000 lignes.
const TRANCHES = 5;

export const GET = routePos(async (ctx) => {
  exigerDroit(ctx, "voir_audit");
  const total = await prisma.journalAudit.count({ where: { tenantId: ctx.tenantId } });
  let verifiees = 0;
  let apresSeq: number | undefined;
  for (let i = 0; i < TRANCHES; i++) {
    // La tranche suivante repart de la dernière ligne lue (incluse) : le chaînage entre tranches est contrôlé.
    const r = await verifierChaineAudit(ctx.tenantId, { apresSeq, limite: 10_000 });
    if (!r.valide) return { valide: false, total, verifiees: verifiees + r.verifiees, rupture: r.rupture, partiel: false, verifieAt: new Date() };
    verifiees += r.verifiees - (apresSeq === undefined ? 0 : 1);
    if (r.verifiees < 10_000 || r.dernierSeq === null) break;
    apresSeq = r.dernierSeq;
  }
  return { valide: true, total, verifiees: Math.max(0, verifiees), rupture: null, partiel: verifiees < total, verifieAt: new Date() };
});
