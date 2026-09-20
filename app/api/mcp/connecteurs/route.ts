// Gestion des configs connecteurs par tenant (GET état + POST config)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MCP_CONNECTEURS } from "@/lib/mcp/registry";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const saveSchema = z.object({
  type: z.string(),
  pageId: z.string().optional(),
  igUserId: z.string().optional(),
  accessToken: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
  statut: z.enum(["actif", "inactif"]).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const configs = await prisma.connecteurConfig.findMany({ where: { tenantId } });
  const configMap = Object.fromEntries(configs.map((c) => [c.type, c]));

  const connecteurs = MCP_CONNECTEURS.map((def) => {
    const cfg = configMap[def.type];
    return {
      type: def.type,
      nom: def.nom,
      description: def.description,
      icone: def.icone,
      couleur: def.couleur,
      statut: cfg?.statut ?? "inactif",
      configure: !!cfg,
      pageId: cfg?.pageId,
      igUserId: cfg?.igUserId,
      nbOutils: def.outils.length,
      oauthUrl: def.oauthUrl,
    };
  });

  return NextResponse.json(connecteurs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = saveSchema.parse(await req.json());

  const connecteur = await prisma.connecteurConfig.upsert({
    where: { tenantId_type: { tenantId, type: body.type } },
    create: {
      tenantId,
      type: body.type,
      statut: body.statut ?? "actif",
      pageId: body.pageId,
      igUserId: body.igUserId,
      accessToken: body.accessToken,
      config: (body.config ?? {}) as Prisma.InputJsonValue,
    },
    update: {
      statut: body.statut ?? "actif",
      ...(body.pageId !== undefined && { pageId: body.pageId }),
      ...(body.igUserId !== undefined && { igUserId: body.igUserId }),
      ...(body.accessToken !== undefined && { accessToken: body.accessToken }),
      ...(body.config !== undefined && { config: body.config as Prisma.InputJsonValue }),
    },
  });

  return NextResponse.json(connecteur);
}
