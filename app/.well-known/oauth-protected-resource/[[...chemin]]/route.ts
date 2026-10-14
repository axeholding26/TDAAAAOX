// Découverte OAuth (RFC 9728) : indique aux IA quel serveur autorise l'accès au MCP d'Axso.
import { NextResponse } from "next/server";
import { origineSite } from "@/lib/origine-site";
import { SCOPES } from "@/lib/controle-ia/regles";

export async function GET() {
  const origine = await origineSite();
  return NextResponse.json({ resource: `${origine}/api/mcp/v1`, authorization_servers: [origine], scopes_supported: SCOPES, bearer_methods_supported: ["header"] });
}
