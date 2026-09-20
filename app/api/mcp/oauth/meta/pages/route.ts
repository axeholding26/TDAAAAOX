// Liste les pages/comptes Meta disponibles pour ce tenant + sélection de page
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const config = await prisma.connecteurConfig.findUnique({
    where: { tenantId_type: { tenantId, type: "meta" } },
  });

  if (!config) return NextResponse.json({ pages: [], waba: [], connected: false });

  const cfg = config.config as any;
  return NextResponse.json({
    connected: true,
    user_name: cfg.user_name,
    user_picture: cfg.user_picture,
    pages: cfg.pages ?? [],
    waba_accounts: cfg.waba_accounts ?? [],
    selected_page_id: config.pageId,
    selected_ig_id: config.igUserId,
  });
}

const selectSchema = z.object({
  page_id: z.string(),
  page_access_token: z.string(),
  ig_user_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = selectSchema.parse(await req.json());

  await prisma.connecteurConfig.update({
    where: { tenantId_type: { tenantId, type: "meta" } },
    data: {
      pageId: body.page_id,
      accessToken: body.page_access_token,
      igUserId: body.ig_user_id ?? null,
      statut: "actif",
    },
  });

  return NextResponse.json({ ok: true });
}
