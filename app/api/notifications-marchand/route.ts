// Notifications marchand — dashboard (distinct des notifications livreur)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

  const [notifications, nonLues] = await Promise.all([
    prisma.notificationMarchand.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notificationMarchand.count({ where: { tenantId, lu: false } }),
  ]);

  return NextResponse.json({ notifications, nonLues });
}

const patchSchema = z.object({
  id: z.string().optional(),
  toutMarquer: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ message: "Non autorisé" }, { status: 401 });

  const { id, toutMarquer } = patchSchema.parse(await req.json());

  if (toutMarquer) {
    await prisma.notificationMarchand.updateMany({ where: { tenantId, lu: false }, data: { lu: true } });
    return NextResponse.json({ ok: true });
  }
  if (id) {
    await prisma.notificationMarchand.updateMany({ where: { id, tenantId }, data: { lu: true } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ message: "id ou toutMarquer requis" }, { status: 400 });
}
