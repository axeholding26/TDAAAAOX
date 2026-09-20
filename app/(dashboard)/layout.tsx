import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NotificationSound } from "@/components/ui/NotificationSound";
import { quotaCommandesAtteint, planActif } from "@/lib/abonnement";
import { permissionsSession, estCaissierPur } from "@/lib/permissions-server";
import { AbonnementOverlayProvider } from "@/components/dashboard/AbonnementOverlayProvider";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/connexion");

  const tenantId = (session.user as any)?.tenantId;
  let boutique: { slug: string; nomBoutique: string } | null = null;
  if (tenantId) {
    boutique = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, nomBoutique: true },
    });
  }

  const quotaAtteint = tenantId ? await quotaCommandesAtteint(tenantId) : false;
  const { plan: palier } = tenantId ? await planActif(tenantId) : { plan: "palier0" as const };
  const permissions = await permissionsSession(session);
  const modeCaisse = await estCaissierPur(session);

  return (
    <AbonnementOverlayProvider>
      <DashboardShell session={session} boutique={boutique} quotaAtteint={quotaAtteint} palier={palier} permissions={permissions} modeCaisse={modeCaisse}>
        {children}
      </DashboardShell>
      {/* Son audio sur chaque notification toast */}
      <NotificationSound />
    </AbonnementOverlayProvider>
  );
}
