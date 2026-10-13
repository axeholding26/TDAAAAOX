// OAuth Google — redirige vers Google pour autoriser Gmail
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGmailOAuthUrl } from "@/lib/mcp/connectors/gmail";
import { integrationActive, BIENTOT_DISPONIBLE } from "@/lib/integrations";

export async function GET() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.redirect("/connexion");

  if (!integrationActive("gmail")) return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connecteurs?error=${encodeURIComponent(BIENTOT_DISPONIBLE)}`);
  const url = getGmailOAuthUrl(tenantId);
  return NextResponse.redirect(url);
}
