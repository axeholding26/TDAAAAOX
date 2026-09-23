// Notifications marchand — dashboard (distinct des notifications livreur)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { boutiquesDuCompte } from "@/lib/tenant";

// Notifications de TOUTES les boutiques du compte (propriétaire ou membre),
// pas seulement la boutique active — une commande sur la boutique B doit se
// voir pendant qu'on travaille sur la boutique A.
async function tenantsDeLaSession(session: any): Promise<string[]> {
  const userId = session?.user?.id as string | undefined;
  const tenantId = session?.user?.tenantId as string | undefined;
  if (!userId || !tenantId) return [];
  const { proprietaire, membre } = await boutiquesDuCompte(userId);
  return [...new Set([tenantId, ...proprietaire, ...membre])];
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantIds = await tenantsDeLaSession(session);
  if (!tenantIds.length) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

  const [notifications, nonLues] = await Promise.all([
    prisma.notificationMarchand.findMany({
      where: { tenantId: { in: tenantIds } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { tenant: { select: { nomBoutique: true } } },
    }),
    prisma.notificationMarchand.count({ where: { tenantId: { in: tenantIds }, lu: false } }),
  ]);

  return NextResponse.json({
    notifications: notifications.map(({ tenant, ...n }) => ({
      ...n,
      nomBoutique: tenant.nomBoutique,
      autreBoutique: n.tenantId !== (session!.user as any).tenantId,
    })),
    nonLues,
  });
}

const patchSchema = z.object({
  id: z.string().optional(),
  toutMarquer: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const tenantIds = await tenantsDeLaSession(session);
  if (!tenantIds.length) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

  const { id, toutMarquer } = patchSchema.parse(await req.json());

  if (toutMarquer) {
    await prisma.notificationMarchand.updateMany({ where: { tenantId: { in: tenantIds }, lu: false }, data: { lu: true } });
    return NextResponse.json({ ok: true });
  }
  if (id) {
    await prisma.notificationMarchand.updateMany({ where: { id, tenantId: { in: tenantIds } }, data: { lu: true } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ message: "id ou toutMarquer requis" }, { status: 400 });
}
