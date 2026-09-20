// OAuth Google — redirige vers Google pour autoriser Gmail
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGmailOAuthUrl } from "@/lib/mcp/connectors/gmail";

export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return NextResponse.redirect("/connexion");

  const url = getGmailOAuthUrl(tenantId);
  return NextResponse.redirect(url);
}
