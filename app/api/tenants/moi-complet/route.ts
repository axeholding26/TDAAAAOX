import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const tenantId = (session.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });

  // Charge la config du thème actif depuis la DB (nécessaire pour que le
  // builder puisse afficher l'état réel du thème, y compris les thèmes
  // AXSO Design dont la config vit dans Theme.config et non dans tenant.themeConfig).
  let activeThemeConfig: Record<string, any> | null = null;
  if (tenant.themeId) {
    const theme = await prisma.theme.findUnique({
      where: { id: tenant.themeId },
      select: { config: true },
    });
    activeThemeConfig = (theme?.config as Record<string, any>) ?? null;
  }

  return NextResponse.json({ ...tenant, activeThemeConfig });
}
