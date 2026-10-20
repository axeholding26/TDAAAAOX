import { auth } from "@/lib/auth";
import { ActivationPush } from "@/components/ActivationPush";
import { MenusDeroulants } from "@/components/ui/MenusDeroulants";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NotificationSound } from "@/components/ui/NotificationSound";
import { AlerteCommande } from "@/components/dashboard/AlerteCommande";
import { AxiaBulle } from "@/components/dashboard/AxiaBulle";
import { quotaCommandesAtteint, planActif } from "@/lib/abonnement";
import { permissionsSession, estCaissierPur } from "@/lib/permissions-server";
import { AbonnementOverlayProvider } from "@/components/dashboard/AbonnementOverlayProvider";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { I18nProvider } from "@/components/I18nProvider";
import { getLangue, dico } from "@/lib/i18n/serveur";
import { DeviseProvider } from "@/components/dashboard/DeviseProvider";


// Manifeste : installable (écran d'accueil), exigé par iPhone pour les notifications push.
export const metadata = { manifest: "/manifest-dashboard.webmanifest" };
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/connexion");

  const tenantId = (session.user as any)?.tenantId;
  let boutique: { slug: string; nomBoutique: string; devise: string } | null = null;
  if (tenantId) {
    boutique = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { slug: true, nomBoutique: true, devise: true },
    });
  }

  const quotaAtteint = tenantId ? await quotaCommandesAtteint(tenantId) : false;
  const { plan: palier } = tenantId ? await planActif(tenantId) : { plan: "palier0" as const };
  const permissions = await permissionsSession(session);
  const modeCaisse = await estCaissierPur(session);
  // Mode de la caisse (simple | pro) : allège ou déploie le menu « Caisse & magasin ».
  // Une boutique sans réglages — ou une base pas encore migrée — reste en mode simple.
  const modePos = tenantId
    ? await prisma.reglagesPos.findUnique({ where: { tenantId }, select: { mode: true } }).then((r) => (r?.mode === "pro" ? "pro" as const : "simple" as const), () => "simple" as const)
    : "simple" as const;

  return (
    <I18nProvider langue={await getLangue()} dico={await dico("dashboard", "boutique")}>
    <AbonnementOverlayProvider palier={palier}>
      <DashboardShell session={session} boutique={boutique} quotaAtteint={quotaAtteint} palier={palier} permissions={permissions} modeCaisse={modeCaisse} modePos={modePos}>
        <DeviseProvider devise={boutique?.devise || "XAF"}>{children}</DeviseProvider>
      </DashboardShell>
      {/* Son audio sur chaque notification toast */}
      <NotificationSound />
      {/* Nouvelle commande : alerte distincte (son de caisse + carte). */}
      <AlerteCommande />
      {/* Notifications push : alertes sur l'appareil, même appli fermée. */}
      <ActivationPush espace="dashboard" />
      {/* AXIA prend la parole : constats, rappels, demandes d'accord. */}
      <AxiaBulle />
      {/* Liste ouverte des menus déroulants, la même dans tous les navigateurs. */}
      <MenusDeroulants />
    </AbonnementOverlayProvider>
    </I18nProvider>
  );
}
