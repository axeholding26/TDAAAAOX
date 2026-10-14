// Découverte OAuth (RFC 8414) : adresses du serveur d'autorisation d'Axso.
import { NextResponse } from "next/server";
import { origineSite } from "@/lib/origine-site";
import { SCOPES } from "@/lib/controle-ia/regles";

export async function GET() {
  const origine = await origineSite();
  return NextResponse.json({
    issuer: origine,
    authorization_endpoint: `${origine}/oauth/authorize`,
    token_endpoint: `${origine}/api/oauth/token`,
    registration_endpoint: `${origine}/api/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: SCOPES,
  });
}
