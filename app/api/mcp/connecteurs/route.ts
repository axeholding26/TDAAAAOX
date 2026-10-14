// Gestion des configs connecteurs par tenant (GET état + POST config)
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MCP_CONNECTEURS } from "@/lib/mcp/registry";
import { enregistrerConnexion } from "@/lib/connect";
import { z } from "zod";

const saveSchema = z.object({
  type: z.string(),
  pageId: z.string().optional(),
  igUserId: z.string().optional(),
  accessToken: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
  statut: z.enum(["actif", "inactif"]).optional(),
});

export async function GET() {
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

  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  const body = parsed.data;

  const { type, ...donnees } = body;
  const connecteur = await enregistrerConnexion(tenantId, type, { ...donnees, statut: body.statut ?? "actif" });

  // Jamais de jeton ni de config (peut contenir des clés) renvoyé au navigateur.
  return NextResponse.json({ type: connecteur.type, statut: connecteur.statut, pageId: connecteur.pageId, igUserId: connecteur.igUserId });
}
