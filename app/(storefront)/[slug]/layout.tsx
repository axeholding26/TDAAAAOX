import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import { StorefrontTypography } from "@/components/storefront/StorefrontTypography";
import { StorefrontCustomCss } from "@/components/storefront/StorefrontCustomCss";
import { AxiaStorefront } from "@/components/storefront/AxiaStorefront";
import { StorefrontPopups } from "@/components/storefront/StorefrontPopups";
import { MetaPixel } from "@/components/storefront/MetaPixel";
import { TikTokPixel } from "@/components/storefront/TikTokPixel";
import { SnapchatPixel } from "@/components/storefront/SnapchatPixel";
import { GoogleTagManager } from "@/components/storefront/GoogleTagManager";
import { CustomTrackingScripts } from "@/components/storefront/CustomTrackingScripts";
import { AffiliationRefCapture } from "@/components/storefront/AffiliationRefCapture";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function StorefrontLayout({ children, params }: Props) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true, nomBoutique: true, themeId: true, themeConfig: true,
      metaPixelId: true, tiktokPixelId: true, snapPixelId: true, gtmId: true, trackingScripts: true,
    },
  });

  if (!tenant) return <>{children}</>;

  const cfg = await resolveThemeConfigAsync(tenant.themeId, tenant.id, (tenant.themeConfig as Record<string, any>) || {});
  const accent = cfg.colors?.accent ?? "#F5A623";

  return (
    <>
      <StorefrontTypography fonts={cfg.fonts} />
      <StorefrontCustomCss css={cfg.customCss} />
      <div className="axs-store" style={{ display: "contents" }}>
        {children}
      </div>
      <Suspense fallback={null}>
        <AffiliationRefCapture />
      </Suspense>
      <AxiaStorefront slug={slug} nomBoutique={tenant.nomBoutique} accentColor={accent} />
      <StorefrontPopups slug={slug} accentColor={accent} />
      {tenant.metaPixelId && <MetaPixel pixelId={tenant.metaPixelId} />}
      {tenant.tiktokPixelId && <TikTokPixel pixelId={tenant.tiktokPixelId} />}
      {tenant.snapPixelId && <SnapchatPixel pixelId={tenant.snapPixelId} />}
      {tenant.gtmId && <GoogleTagManager containerId={tenant.gtmId} />}
      {tenant.trackingScripts && <CustomTrackingScripts html={tenant.trackingScripts} />}
    </>
  );
}
