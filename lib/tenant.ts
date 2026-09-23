// Résolution multi-tenant pour Axso
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

// Extraire le slug ou domaine custom depuis l'hôte HTTP
export async function getTenantFromHost(): Promise<string | null> {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const appDomain = process.env.NEXT_PUBLIC_AXSO_DOMAIN || "localhost:3000";

  // Domaine custom (ex: monboutique.com)
  if (host !== appDomain && !host.endsWith(`.${appDomain}`)) {
    const tenant = await prisma.tenant.findUnique({
      where: { customDomain: host },
      select: { slug: true },
    });
    return tenant?.slug || null;
  }

  // Sous-domaine (ex: aminata.axso.com)
  if (host.endsWith(`.${appDomain}`)) {
    return host.replace(`.${appDomain}`, "");
  }

  return null;
}

// Récupérer un tenant par slug avec cache court
export async function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({
    where: { slug },
  });
}

/**
 * Ids des boutiques accessibles à un compte : celles qu'il possède
 * (ProprietaireBoutique) et celles où il est membre d'équipe actif.
 * Rattrape au passage le lien propriétaire des comptes créés avant que
 * l'inscription ne l'écrive (User.tenantId renseigné, aucun lien).
 */
export async function boutiquesDuCompte(userId: string): Promise<{ proprietaire: string[]; membre: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      tenantId: true, role: true,
      boutiques: { select: { tenantId: true } },
      membresEquipe: { where: { statut: "actif" }, select: { tenantId: true } },
    },
  });
  if (!user) return { proprietaire: [], membre: [] };

  const proprietaire = user.boutiques.map(b => b.tenantId);
  if (user.tenantId && (user.role === "owner" || user.role === "admin") && !proprietaire.includes(user.tenantId)) {
    await prisma.proprietaireBoutique.upsert({
      where: { userId_tenantId: { userId, tenantId: user.tenantId } },
      create: { userId, tenantId: user.tenantId, role: "owner" },
      update: {},
    });
    proprietaire.push(user.tenantId);
  }
  return { proprietaire, membre: user.membresEquipe.map(m => m.tenantId) };
}


/**
 * Une boutique non publiée est invisible du public (404). Pour son équipe
 * connectée, la page ne lève pas de 404 : le layout de la vitrine affiche à
 * la place un message l'invitant à publier (components/storefront/BoutiqueNonPubliee).
 */
export async function boutiqueVisible(tenant: { id: string; statut: string }): Promise<boolean> {
  if (tenant.statut === "active") return true;
  const session = await auth();
  return (session?.user as any)?.tenantId === tenant.id;
}
