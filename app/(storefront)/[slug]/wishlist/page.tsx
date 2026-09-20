export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import { StorefrontNavbar } from "@/components/storefront/StorefrontNavbar";
import { WishlistGrid } from "@/components/storefront/WishlistGrid";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WishlistPage({ params }: Props) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { collections: { where: { actif: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!tenant || tenant.statut !== "active") notFound();

  const cfg = await resolveThemeConfigAsync(tenant.themeId, tenant.id, tenant.themeConfig as Record<string, any>);
  const { colors: c, radius } = cfg;

  const layoutCfg = cfg.layout ?? {};
  const CONTAINER = layoutCfg.largeurContainer === "100%" ? "max-w-full" : `max-w-[${layoutCfg.largeurContainer || "1280px"}]`;
  const colonnesDesktop = layoutCfg.colonnesProduits || 4;
  const colonnesMobile = layoutCfg.colonnesMobile || 2;
  const GRID_PRODUITS = `grid-cols-${colonnesMobile} sm:grid-cols-3 lg:grid-cols-${colonnesDesktop}`;
  const OMBRE_MAP: Record<string, string> = { none: "", sm: "hover:shadow-md", md: "hover:shadow-lg", lg: "hover:shadow-xl", xl: "hover:shadow-2xl" };
  const carteOmbreClass = OMBRE_MAP[layoutCfg.ombre || "md"];
  const styleCarte = layoutCfg.styleCarte || "shadow";
  const CARTE_CLASS: Record<string, string> = {
    shadow: `border transition-all duration-300 ${carteOmbreClass} group-hover:-translate-y-1`,
    bordered: "border-2 transition-colors duration-300",
    flat: "border-0 transition-none",
    lifted: `border transition-all duration-300 ${carteOmbreClass} group-hover:-translate-y-2 group-hover:scale-[1.02]`,
  };
  const carteClass = CARTE_CLASS[styleCarte] ?? CARTE_CLASS.shadow;

  const boutonsCfg = cfg.boutons ?? {};
  const btnStyle = boutonsCfg.style || "filled";
  const btnRempli = !["outlined", "ghost"].includes(btnStyle);
  const btnRadiusPx = btnStyle === "pill" ? "999px" : btnStyle === "square" ? "0px" : radius;
  const TAILLE_MAP: Record<string, { padX: string; padY: string; text: string }> = {
    sm: { padX: "20px", padY: "10px", text: "13px" },
    md: { padX: "32px", padY: "14px", text: "15px" },
    lg: { padX: "40px", padY: "16px", text: "16px" },
    xl: { padX: "48px", padY: "20px", text: "18px" },
  };
  const btnTaille = TAILLE_MAP[boutonsCfg.taille || "md"];
  const HOVER_CLASS: Record<string, string> = {
    lighten: "hover:brightness-110",
    darken: "hover:brightness-90",
    scale: "hover:scale-105 active:scale-95",
    glow: "axs-btn-glow",
    slide: "hover:translate-x-0.5",
  };
  const btnHoverClass = `transition-all ${HOVER_CLASS[boutonsCfg.hover || "scale"] ?? HOVER_CLASS.scale}`;
  const btnPrimaryStyle: React.CSSProperties = {
    backgroundColor: btnRempli ? c.accent : "transparent",
    color: btnRempli ? c.fond : c.accent,
    border: btnStyle === "outlined" ? `2px solid ${c.accent}` : "none",
    borderRadius: btnRadiusPx,
    padding: `${btnTaille.padY} ${btnTaille.padX}`,
    fontSize: btnTaille.text,
    textDecoration: btnStyle === "ghost" ? "underline" : "none",
    ["--ax-accent-glow" as any]: `${c.accent}80`,
  };
  const btnPrimaryClass = `inline-flex items-center justify-center gap-2 font-semibold ${btnHoverClass}`;

  return (
    <div style={{ backgroundColor: c.fond, color: c.texte, minHeight: "100vh" }}>
      <StorefrontNavbar
        slug={slug}
        nomBoutique={tenant.nomBoutique}
        logoUrl={tenant.logoUrl}
        accent={c.accent}
        fond={c.fond}
        texte={c.texte}
        radius={radius}
        collections={tenant.collections}
        certifie={tenant.certifie}
        navStyle={cfg.navigationStyle}
        showAbout={cfg.aboutPage?.actif}
        showContact={cfg.contactPage?.actif}
      />

      <WishlistGrid
        slug={slug}
        devise={tenant.devise}
        accent={c.accent}
        fond={c.fond}
        texte={c.texte}
        surface={c.surface}
        radius={radius}
        container={CONTAINER}
        gridProduits={GRID_PRODUITS}
        carteClass={carteClass}
        btnPrimaryStyle={btnPrimaryStyle}
        btnPrimaryClass={btnPrimaryClass}
      />

      <footer className="border-t mt-16 py-8 text-center text-xs" style={{ borderColor: `${c.accent}10`, opacity: 0.4 }}>
        <p>{tenant.nomBoutique} · Propulsé par <span style={{ color: c.accent, opacity: 1 }}>Axso</span></p>
      </footer>
    </div>
  );
}
