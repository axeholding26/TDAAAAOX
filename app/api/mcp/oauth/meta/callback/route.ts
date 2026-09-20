// Callback OAuth Meta — échange le code, récupère les pages et comptes WA
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const GRAPH = "https://graph.facebook.com/v19.0";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const tenantId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !tenantId) {
    const msg = error === "access_denied" ? "Autorisation refusée" : "oauth_echec";
    return NextResponse.redirect(`${APP_URL}/dashboard/connecteurs?error=${encodeURIComponent(msg)}`);
  }

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const callbackUrl = `${APP_URL}/api/mcp/oauth/meta/callback`;

  // 1. Échange code → short-lived user token
  const tokenRes = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(callbackUrl)}&client_secret=${appSecret}&code=${code}`
  );
  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    return NextResponse.redirect(`${APP_URL}/dashboard/connecteurs?error=${encodeURIComponent(tokenData.error.message)}`);
  }

  const shortToken: string = tokenData.access_token;

  // 2. Échange → long-lived user token (60 jours)
  const longRes = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortToken}`
  );
  const longData = await longRes.json();
  const userToken: string = longData.access_token ?? shortToken;

  // 3. Récupère les pages Facebook + leurs page access tokens permanents
  const pagesRes = await fetch(
    `${GRAPH}/me/accounts?fields=id,name,access_token,category,instagram_business_account&access_token=${userToken}`
  );
  const pagesData = await pagesRes.json();
  const pages: any[] = pagesData.data ?? [];

  // 4. Pour chaque page, récupère le compte Instagram associé
  const pagesAvecIG = await Promise.all(
    pages.map(async (page: any) => {
      let igAccount = null;
      if (page.instagram_business_account?.id) {
        const igRes = await fetch(
          `${GRAPH}/${page.instagram_business_account.id}?fields=id,name,username,profile_picture_url&access_token=${page.access_token}`
        );
        igAccount = await igRes.json().catch(() => null);
      }
      return { ...page, ig_account: igAccount };
    })
  );

  // 5. Récupère les comptes WhatsApp Business
  let wabaAccounts: any[] = [];
  try {
    const wabaRes = await fetch(
      `${GRAPH}/me/businesses?fields=id,name,whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}&access_token=${userToken}`
    );
    const wabaData = await wabaRes.json();
    wabaAccounts = wabaData.data ?? [];
  } catch { /* WhatsApp Business optionnel */ }

  // 6. Récupère l'info profil de l'utilisateur
  const meRes = await fetch(`${GRAPH}/me?fields=id,name,picture&access_token=${userToken}`);
  const meData = await meRes.json();

  // 7. Sauvegarde en base
  const configData: Prisma.InputJsonValue = {
    user_token: userToken,
    user_id: meData.id,
    user_name: meData.name,
    user_picture: meData.picture?.data?.url,
    pages: pagesAvecIG,
    waba_accounts: wabaAccounts,
    connected_at: new Date().toISOString(),
  };

  await prisma.connecteurConfig.upsert({
    where: { tenantId_type: { tenantId, type: "meta" } },
    create: { tenantId, type: "meta", statut: "actif", config: configData },
    update: { statut: "actif", config: configData },
  });

  // Si une seule page, on la sélectionne automatiquement
  if (pagesAvecIG.length === 1) {
    const page = pagesAvecIG[0];
    await prisma.connecteurConfig.update({
      where: { tenantId_type: { tenantId, type: "meta" } },
      data: {
        pageId: page.id,
        accessToken: page.access_token,
        igUserId: page.ig_account?.id ?? null,
      },
    });
  }

  // Si des numéros WA disponibles, sauvegarder le 1er automatiquement
  const allPhones = wabaAccounts.flatMap((w: any) => w.whatsapp_business_accounts?.data?.flatMap((wba: any) => wba.phone_numbers?.data ?? []) ?? []);
  if (allPhones.length > 0) {
    await prisma.connecteurConfig.upsert({
      where: { tenantId_type: { tenantId, type: "whatsapp" } },
      create: {
        tenantId, type: "whatsapp", statut: "actif",
        accessToken: userToken,
        config: { phone_number_id: allPhones[0].id, display_phone: allPhones[0].display_phone_number, all_phones: allPhones } as Prisma.InputJsonValue,
      },
      update: {
        statut: "actif",
        accessToken: userToken,
        config: { phone_number_id: allPhones[0].id, display_phone: allPhones[0].display_phone_number, all_phones: allPhones } as Prisma.InputJsonValue,
      },
    });
  }

  const nbPages = pagesAvecIG.length;
  const query = nbPages > 1 ? "?selector=meta" : "?success=meta";
  return NextResponse.redirect(`${APP_URL}/dashboard/connecteurs${query}`);
}
