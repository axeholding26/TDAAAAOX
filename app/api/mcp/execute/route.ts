// Endpoint générique MCP — aucun appelant connu (à supprimer). En attendant :
// accès complet requis, limite de débit IA, et toute action qui publie ou envoie
// devient une demande d'accord du marchand (comme AXIA), jamais un envoi direct.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { executerOutilMcp } from "@/lib/mcp/executor";
import { estSensible, demanderConfirmation } from "@/lib/axia/confirmation";
import { permissionsSession } from "@/lib/permissions-server";
import { outilAutorise } from "@/lib/axia/droits";
import { aiLimiter, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const schema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.any()).default({}),
});

export async function POST(req: NextRequest) {
  const rl = aiLimiter.check(getClientIp(req));
  if (!rl.success) return rateLimitResponse(rl.reset);
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!session || !tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!outilAutorise("deleguer_vers_agent", await permissionsSession(session))) {
    return NextResponse.json({ error: "Accès complet requis" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  const { tool, args } = parsed.data;
  const result = estSensible(tool) ? await demanderConfirmation(tenantId, tool, args) : await executerOutilMcp(tool, args, tenantId);
  return NextResponse.json(result);
}
