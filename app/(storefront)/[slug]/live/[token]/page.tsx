export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { resolveConfigVitrine } from "@/lib/vitrine-design";
import { chargerInscription } from "@/lib/live/service";
import { EspaceLive } from "@/components/live/LiveVitrine";

export const metadata = { robots: { index: false, follow: false } };

// Espace personnel d'un inscrit (événement ou bootcamp) : le jeton opaque de l'URL est la seule
// autorisation, revérifiée par /api/live/acces/[token] (inscription active, commande payée non remboursée).
export default async function EspaceLivePage({ params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const i = await chargerInscription(token);
  if (!i || i.tenant.slug !== slug) notFound();
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, themeId: true, themeConfig: true } });
  if (!tenant) notFound();
  const { colors: c } = await resolveConfigVitrine(tenant.themeId, tenant.id, tenant.themeConfig as Record<string, any>);
  return (
    <div style={{ backgroundColor: c.fond, color: c.texte, minHeight: "100vh" }}>
      <EspaceLive token={token} accent={c.accent} />
    </div>
  );
}
