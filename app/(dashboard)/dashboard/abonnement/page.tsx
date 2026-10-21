import { auth } from "@/lib/auth";
import { exigerModule } from "@/lib/permissions-server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PAYS_DEVISES } from "@/lib/ai-agent";
import { planActif } from "@/lib/abonnement";
import { verifierAbonnementEnAttente } from "@/lib/abonnement-paiement";
import { NOMS_PALIERS } from "@/lib/plans";
import { PlansGrid } from "@/components/dashboard/PlansGrid";
import { etatEssai } from "@/lib/essai";

// ─── Page ────────────────────────────────────────────────────────────────────
export default async function AbonnementPage({ searchParams }: { searchParams: Promise<{ paiement?: string }> }) {
  const session = await auth();
  if (!session) redirect("/connexion");
  await exigerModule(session, "finance");

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) redirect("/inscription");

  // Retour de la page de paiement NotchPay : on n'attend pas le webhook pour activer le palier payé.
  if ((await searchParams).paiement === "en_cours") await verifierAbonnementEnAttente(tenantId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { planType: true, nomBoutique: true, pays: true, devise: true },
  });

  // planActif() normalise les valeurs héritées ("gratuit", "premium"...) en
  // palier0 — évite d'afficher aucune carte comme "actuelle" pour les
  // boutiques créées avant l'introduction des paliers.
  // Plan payé (sans l'essai Illimité, affiché à part) : on peut s'abonner pendant l'essai.
  const [{ planPaye: planActuel }, essai] = await Promise.all([planActif(tenantId), etatEssai(tenantId)]);
  const pays   = tenant?.pays ?? "CM";
  const devise = tenant?.devise ?? PAYS_DEVISES[pays] ?? "XAF";

  return <PlansGrid planActuel={planActuel} nomPlan={NOMS_PALIERS[planActuel]} devise={devise} essai={{ phase: essai.phase, finLe: essai.finLe?.toISOString() ?? null }} />;
}
