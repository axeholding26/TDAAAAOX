// Sélection du numéro WhatsApp Business à utiliser
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const selectSchema = z.object({
  phone_number_id: z.string(),
  display_phone: z.string(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = selectSchema.parse(await req.json());

  const metaConfig = await prisma.connecteurConfig.findUnique({
    where: { tenantId_type: { tenantId, type: "meta" } },
  });
  const userToken = (metaConfig?.config as any)?.user_token;

  const existing = await prisma.connecteurConfig.findUnique({
    where: { tenantId_type: { tenantId, type: "whatsapp" } },
  });

  const configData: Prisma.InputJsonValue = {
    ...((existing?.config as object) ?? {}),
    phone_number_id: body.phone_number_id,
    display_phone: body.display_phone,
  };

  await prisma.connecteurConfig.upsert({
    where: { tenantId_type: { tenantId, type: "whatsapp" } },
    create: {
      tenantId, type: "whatsapp", statut: "actif",
      accessToken: userToken ?? null,
      config: configData,
    },
    update: {
      statut: "actif",
      accessToken: userToken ?? undefined,
      config: configData,
    },
  });

  return NextResponse.json({ ok: true });
}
