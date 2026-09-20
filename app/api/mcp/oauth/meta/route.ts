// Initie le flux OAuth Meta — redirige vers la fenêtre d'autorisation Facebook
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const SCOPES = [
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
  "ads_management",
  "business_management",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
].join(",");

export async function GET(req: NextRequest) {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/connexion`);
  }

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/connecteurs?error=META_APP_ID+manquant`
    );
  }

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/mcp/oauth/meta/callback`;
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: callbackUrl,
    scope: SCOPES,
    response_type: "code",
    state: tenantId,
  });

  return NextResponse.redirect(
    `https://www.facebook.com/v19.0/dialog/oauth?${params}`
  );
}
