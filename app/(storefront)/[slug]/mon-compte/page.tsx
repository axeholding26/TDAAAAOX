export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { boutiqueVisible } from "@/lib/tenant";
import { resolveConfigVitrine } from "@/lib/vitrine-design";
import { habillageDesign } from "@/components/storefront/templates/HabillageDesign";
import { MonCompteClient } from "./MonCompteClient";

// Espace client : entouré de l'en-tête et du pied de page du design, comme les autres pages.
export default async function MonComptePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant || !(await boutiqueVisible(tenant))) notFound();

  const cfg = await resolveConfigVitrine(tenant.themeId, tenant.id, tenant.themeConfig as Record<string, any>);
  const Habillage = habillageDesign(cfg);
  if (Habillage) return <Habillage><MonCompteClient habille /></Habillage>;
  return <MonCompteClient />;
}
