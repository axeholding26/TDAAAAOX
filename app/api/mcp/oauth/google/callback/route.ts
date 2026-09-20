// Callback OAuth Google — échange le code contre un access + refresh token
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const tenantId = searchParams.get("state");

  if (!code || !tenantId) {
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

  const tokens = await tokenRes.json();

  if (tokens.error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connecteurs?error=${tokens.error}`);
  }

  // Sauvegarde les tokens
  await prisma.connecteurConfig.upsert({
    where: { tenantId_type: { tenantId, type: "gmail" } },
    create: {
      tenantId,
      type: "gmail",
      statut: "actif",
      config: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
      },
    },
    update: {
      statut: "actif",
      config: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
      },
    },
  });

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connecteurs?success=gmail`);
}
