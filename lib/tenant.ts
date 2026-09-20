// Résolution multi-tenant pour Axso
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

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
