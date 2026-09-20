// Endpoint générique MCP — les agents l'appellent pour exécuter n'importe quel outil connecteur
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { executerOutilMcp } from "@/lib/mcp/executor";

const schema = z.object({
  tool: z.string(),
  args: z.record(z.string(), z.any()).default({}),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = schema.parse(await req.json());
  const result = await executerOutilMcp(body.tool, body.args, tenantId);
  return NextResponse.json(result);
}
