import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { planActif } from "@/lib/abonnement";
import { AxiaHomeClient } from "@/components/dashboard/AxiaHomeClient";

// Porte d'accès serveur à AXIA plein écran : réservée au palier Pro et plus.
// Un compte palier0 est toujours renvoyé vers /dashboard/accueil (jamais de
// flash de l'UI AXIA), avec ?axia=pro pour déclencher le toast explicatif
// (voir AxiaProNotice, monté sur la page accueil). page.tsx (contrairement à
// un layout) se ré-exécute à chaque navigation vers cette route exacte, donc
// ce contrôle reste fiable même en cas de rétrogradation de plan en cours de
// session.
export default async function DashboardHomePage() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId as string | undefined;
  const { plan } = tenantId ? await planActif(tenantId) : { plan: "palier0" as const };

  if (plan === "palier0") {
    redirect("/dashboard/accueil?axia=pro");
  }

  return <AxiaHomeClient />;
}
