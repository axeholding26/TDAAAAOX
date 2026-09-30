import { Suspense } from "react";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { BoutiqueNonPubliee } from "@/components/storefront/BoutiqueNonPubliee";
import { prisma } from "@/lib/prisma";
import { resolveConfigVitrine } from "@/lib/vitrine-design";
import { StorefrontTypography } from "@/components/storefront/StorefrontTypography";
import { PanierVitrine } from "@/components/storefront/PanierVitrine";
import { FiltresCatalogue } from "@/components/storefront/FiltresCatalogue";
import { RechercheDesign } from "@/components/storefront/RechercheDesign";
import { WidgetsDesign } from "@/components/storefront/WidgetsDesign";
import { NavigationDesign } from "@/components/storefront/NavigationDesign";
import { AnimationsDesign } from "@/components/storefront/AnimationsDesign";
import { StorefrontCustomCss } from "@/components/storefront/StorefrontCustomCss";
import { AxiaStorefront } from "@/components/storefront/AxiaStorefront";
import { StorefrontPopups } from "@/components/storefront/StorefrontPopups";
import { MetaPixel } from "@/components/storefront/MetaPixel";
import { TikTokPixel } from "@/components/storefront/TikTokPixel";
import { SnapchatPixel } from "@/components/storefront/SnapchatPixel";
import { GoogleTagManager } from "@/components/storefront/GoogleTagManager";
import { CustomTrackingScripts } from "@/components/storefront/CustomTrackingScripts";
import { AffiliationRefCapture } from "@/components/storefront/AffiliationRefCapture";
import { StorefrontPageView } from "@/components/storefront/StorefrontPageView";
import { DeviseVitrineProvider, PastillePaysDesign } from "@/components/storefront/DeviseVitrine";
import { deviseVisiteur, paysVisiteur } from "@/lib/devise-visiteur";
import { tauxDuJour } from "@/lib/taux-change";
import { ratioConversion } from "@/lib/devise-convert";
import { I18nProvider } from "@/components/I18nProvider";
import { getLangue, dico } from "@/lib/i18n/serveur";

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function StorefrontLayout(props: Props) {
  return (
    <I18nProvider langue={await getLangue()} dico={await dico("boutique")}>
      <ContenuVitrine {...props} />
    </I18nProvider>
  );
}

async function ContenuVitrine({ children, params }: Props) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true, nomBoutique: true, themeId: true, themeConfig: true, statut: true, devise: true,
      metaPixelId: true, tiktokPixelId: true, snapPixelId: true, gtmId: true, trackingScripts: true,
    },
  });

  if (!tenant) return <>{children}</>;

  // Pas encore publiée : l'équipe connectée voit un message l'invitant à
  // publier (au lieu d'un 404) ; le public reçoit le 404 de la page.
  // Aperçu du Constructeur : le propriétaire voit sa boutique telle quelle
  // (même en brouillon), sans compter de visite ni déclencher pixels/popups.
  const apercu = (await cookies()).get("axso_apercu")?.value === "1";
  if (tenant.statut !== "active") {
    const session = await auth();
    const proprietaire = (session?.user as any)?.tenantId === tenant.id;
    if (proprietaire && !apercu) return <BoutiqueNonPubliee nomBoutique={tenant.nomBoutique} />;
  }

  const cfg = await resolveConfigVitrine(tenant.themeId, tenant.id, (tenant.themeConfig as Record<string, any>) || {});
  const accent = cfg.colors?.accent ?? "#F5A623";
  // Design importé + panneau « Boutons et navigation » modifié : favoris, mega menu, en-tête transparent.
  const navDesign = cfg.builderCss && cfg.reglagesDesign?.navigation ? cfg.navigationStyle : undefined;
  const animDesign = cfg.builderCss && cfg.reglagesDesign?.animations ? cfg.animations : undefined;
  const collectionsMega = navDesign?.type === "mega"
    ? await prisma.collection.findMany({ where: { tenantId: tenant.id, actif: true }, select: { slug: true, nom: true, imageUrl: true }, orderBy: { createdAt: "asc" }, take: 12 })
    : [];

  const deviseAffichee = await deviseVisiteur(tenant.devise);
  return (
    <DeviseVitrineProvider devise={deviseAffichee} pays={await paysVisiteur()} deviseBoutique={tenant.devise} ratio={ratioConversion(tenant.devise, deviseAffichee, await tauxDuJour())}>
      <StorefrontTypography fonts={cfg.fonts} />
      <StorefrontCustomCss css={cfg.customCss} />
      <div className="axs-store" style={{ display: "contents" }}>
        {children}
      </div>
      <Suspense fallback={null}>
        <AffiliationRefCapture />
      </Suspense>
      <PanierVitrine />
      <Suspense fallback={null}>
        <FiltresCatalogue />
      </Suspense>
      <RechercheDesign slug={slug} />
      <WidgetsDesign slug={slug} />
      {cfg.builderCss && <PastillePaysDesign />}
      {navDesign && (
        <NavigationDesign slug={slug} type={navDesign.type} favoris={!!navDesign.showWishlist} collections={collectionsMega}
          fondEntete={navDesign.style === "dark" ? "#5E6063" : navDesign.style === "light" ? "#FFFFFF" : cfg.colors.fond} accent={accent} texte={navDesign.style === "dark" ? "#FFFFFF" : cfg.colors.texte} />
      )}
      {animDesign && <AnimationsDesign animations={animDesign} />}
      {!apercu && (
        <>
          <StorefrontPageView slug={slug} />
          <AxiaStorefront slug={slug} nomBoutique={tenant.nomBoutique} accentColor={accent} />
          <StorefrontPopups slug={slug} accentColor={accent} />
          {tenant.metaPixelId && <MetaPixel pixelId={tenant.metaPixelId} />}
          {tenant.tiktokPixelId && <TikTokPixel pixelId={tenant.tiktokPixelId} />}
          {tenant.snapPixelId && <SnapchatPixel pixelId={tenant.snapPixelId} />}
          {tenant.gtmId && <GoogleTagManager containerId={tenant.gtmId} />}
          {tenant.trackingScripts && <CustomTrackingScripts html={tenant.trackingScripts} />}
        </>
      )}
    </DeviseVitrineProvider>
  );
}
