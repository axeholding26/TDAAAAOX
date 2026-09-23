import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { evaluerPublication } from "@/lib/boutique-completion";
import { designsOrigine as lireDesignsOrigine, supprimerThemesDesignInactifs } from "@/lib/axso-design-library";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

  // Avant de lire le tenant : peut enregistrer themeConfig.designsOrigine.
  const designsOrigine = await lireDesignsOrigine(tenantId);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
  await supprimerThemesDesignInactifs(tenantId, tenant.themeId);

  // Charge la config du thème actif depuis la DB (nécessaire pour que le
  // builder puisse afficher l'état réel du thème, y compris les thèmes
  // AXSO Design dont la config vit dans Theme.config et non dans tenant.themeConfig).
  let activeThemeConfig: Record<string, any> | null = null;
  let themeSlug: string | null = null;
  if (tenant.themeId) {
    const theme = await prisma.theme.findUnique({
      where: { id: tenant.themeId },
      select: { config: true, slug: true },
    });
    activeThemeConfig = (theme?.config as Record<string, any>) ?? null;
    // Utilisé par le panneau "Modèles" du Constructeur pour repérer quel
    // design AXSO Design est actif (convention de slug posée par
    // provisionerThemeDepuisLibrairie — voir lib/axso-design-library.ts).
    themeSlug = theme?.slug ?? null;
  }

  // Le Constructeur en a besoin pour désactiver "Publier" tant que la
  // boutique n'a pas le minimum requis — voir lib/boutique-completion.ts.
  const completion = await evaluerPublication(tenantId);

  return NextResponse.json({ ...tenant, activeThemeConfig, themeSlug, completion, designsOrigine });
}
