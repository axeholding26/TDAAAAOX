import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PAYS_DEVISES } from "@/lib/ai-agent";
import { planActif } from "@/lib/abonnement";
import { NOMS_PALIERS } from "@/lib/plans";
import { PlansGrid } from "@/components/dashboard/PlansGrid";

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function AbonnementPage() {
  const session = await auth();
  if (!session) redirect("/connexion");

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) redirect("/inscription");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { planType: true, nomBoutique: true, pays: true, devise: true },
  });

  // planActif() normalise les valeurs héritées ("gratuit", "premium"...) en
  // palier0 — évite d'afficher aucune carte comme "actuelle" pour les
  // boutiques créées avant l'introduction des paliers.
  const { plan: planActuel } = await planActif(tenantId);
  const pays   = tenant?.pays ?? "CM";
  const devise = tenant?.devise ?? PAYS_DEVISES[pays] ?? "XAF";

  return <PlansGrid planActuel={planActuel} nomPlan={NOMS_PALIERS[planActuel]} devise={devise} />;
}
