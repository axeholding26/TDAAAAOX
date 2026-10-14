// Callback OAuth Google — échange le code contre un access + refresh token
import { NextRequest, NextResponse } from "next/server";
import { enregistrerConnexion } from "@/lib/connect";
import { auth } from "@/lib/auth";
import { verifierEtatOAuth } from "@/lib/mcp/oauth-etat";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  // Boutique de la session, jamais du paramètre `state` (voir lib/mcp/oauth-etat.ts).
  const tenantId = ((await auth())?.user as any)?.tenantId as string | undefined;
  const etatOk = await verifierEtatOAuth(searchParams.get("state"));

  if (!code || !tenantId || !etatOk) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connecteurs?error=oauth_failed`);
  }

  // Échange le code contre des tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/oauth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json().catch(() => ({ error: "oauth_failed" }));

  if (tokens.error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connecteurs?error=${encodeURIComponent(String(tokens.error))}`);
  }

  // Sauvegarde les tokens
  await enregistrerConnexion(tenantId, "gmail", {
    statut: "actif",
    config: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      // Droits accordés par le marchand, affichés dans le centre de connexions.
      scope: tokens.scope,
    },
  });

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connecteurs?success=gmail`);
}
