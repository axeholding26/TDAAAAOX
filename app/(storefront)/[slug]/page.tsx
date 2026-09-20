export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatMontant } from "@/lib/utils";
import { prixClient } from "@/lib/pricing";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import Link from "next/link";
import { StorefrontNavbar } from "@/components/storefront/StorefrontNavbar";
import { WishlistHeartButton } from "@/components/storefront/WishlistHeartButton";
import { SectionCountdown } from "@/components/storefront/SectionCountdown";
import { SectionTabs } from "@/components/storefront/SectionTabs";
import { SousBlocsRenderer } from "@/components/storefront/SousBlocsRenderer";
import { ScrollReveal, type RevealType } from "@/components/storefront/ScrollReveal";
import { HomeFaqSection } from "@/components/storefront/HomeFaqSection";
import { CustomSectionsRenderer } from "@/components/storefront/CustomSectionsRenderer";
import { Package, Lock, RotateCcw, MessageCircle, Star } from "lucide-react";
import { ImportedLiteralHomePage } from "@/components/storefront/templates/ImportedLiteralHomePage";
import { BlockTreeRenderer } from "@/components/storefront/blocks/BlockTreeRenderer";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return { title: "Boutique introuvable" };
  return {
    title: tenant.metaTitle || tenant.nomBoutique,
    description: tenant.metaDescription || tenant.description || "",
    openGraph: { images: tenant.bannerUrl ? [{ url: tenant.bannerUrl }] : [] },
  };
}

const DEFAULT_SECTION_ORDER = ["hero", "confiance", "vedettes", "collections", "about", "promo", "faq", "avis", "newsletter"];

export default async function StorefrontPage({ params }: Props) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: {
      collections: { where: { actif: true }, take: 6, orderBy: { createdAt: "desc" } },
      avis: {
        where: { approuve: true },
        include: { client: { select: { nom: true } }, produit: { select: { nom: true } } },
        take: 6,
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!tenant || tenant.statut !== "active") notFound();

  const cfg = await resolveThemeConfigAsync(tenant.themeId, tenant.id, tenant.themeConfig as Record<string, any>);
  const { colors: c, sections: sec, radius, fonts } = cfg;

  const vedettesOrderBy =
    sec.vedettes.triPar === "ventes" ? { ventes: "desc" as const } :
    sec.vedettes.triPar === "featured" ? { featured: "desc" as const } :
    { createdAt: "desc" as const };

  const vedettes = await prisma.produit.findMany({
    where: { tenantId: tenant.id, actif: true },
    orderBy: vedettesOrderBy,
    take: sec.vedettes.nombre || 8,
  });

  // Determine if theme background is dark by checking luminance of fond color
  const fondHex = cfg.colors.fond.replace("#", "");
  const r = parseInt(fondHex.slice(0, 2), 16);
  const g = parseInt(fondHex.slice(2, 4), 16);
  const b = parseInt(fondHex.slice(4, 6), 16);
  const isDark = (r * 299 + g * 587 + b * 114) / 1000 < 128;
  const socialLinks = tenant.socialLinks as Record<string, string> || {};

  // Dégradé de secours du socle par défaut (voir commentaire plus bas) —
  // pas de logique par ancien id de thème, un seul dégradé de repli suffit.
  const heroGradient = `linear-gradient(135deg, #fef3e8 0%, #fde8d0 60%, #fef3e8 100%)`;

  // Animations de section pilotées par le builder (onglet "Animations") —
  // taux d'apparition par section si défini, sinon le preset global du thème.
  const animCfg = cfg.animations;
  const vitesseGlobale = animCfg?.vitesse ?? "normal";
  const staggerActif = !!animCfg?.stagger;
  let staggerIndex = 0;
  const revealType = (cle: string): RevealType =>
    (animCfg?.sectionAnimations?.[cle] as RevealType) || (animCfg?.global as RevealType) || "fade-in";
  const staggerDelay = () => (staggerActif ? staggerIndex++ * 90 : 0);

  // ─── Layout (onglet "Layout" du builder) — largeur, espacement, grille produits, cartes ──
  const layoutCfg = cfg.layout ?? {};
  const CONTAINER = layoutCfg.largeurContainer === "100%" ? "max-w-full" : `max-w-[${layoutCfg.largeurContainer || "1280px"}]`;
  const SECTION_PY_MAP: Record<string, string> = { sm: "py-8 sm:py-10", md: "py-12 sm:py-16", lg: "py-16 sm:py-20", xl: "py-20 sm:py-28" };
  const SECTION_PY = SECTION_PY_MAP[layoutCfg.paddingSection || "lg"];

  if (cfg.builderTree?.length) {
    return (
      // container-type:inline-size — les surcharges responsives (vague 3)
      // sont des @container, pas des @media : ce wrapper fait toute la
      // largeur de la page ici (≈ @media classique), mais le MÊME CSS
      // fonctionne aussi dans l'aperçu rétréci du canevas du tableau de
      // bord (voir components/storefront/blocks/styleUtils.ts).
      <div style={{ containerType: "inline-size" }}>
        <BlockTreeRenderer
          nodes={cfg.builderTree}
          ctx={{ slug, colors: c, container: CONTAINER, sectionPy: SECTION_PY, tenantId: tenant.id, editable: false }}
        />
      </div>
    );
  }

  if (cfg.builderHtml) {
    return <ImportedLiteralHomePage cfg={cfg} />;
  }

  // Ce qui suit (jusqu'à la fin du fichier) est le socle de repli — plus
  // aucune boutique réelle n'y arrive normalement (toutes provisionnées via
  // builderTree/builderHtml, voir lib/axso-design-library.ts), sauf si le
  // provisionnement automatique échouait (non bloquant par design, voir
  // lib/axso-design-library.ts::provisionerThemeInitial) : dans ce cas précis
  // la boutique reste sur le socle "terre-et-or" et DOIT quand même s'afficher
  // correctement, piloté par cfg.sections/cfg.layout/cfg.boutons.
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

  // ─── Boutons (onglet "Boutons" du builder) — style, taille, effet au survol ──
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
  // Bouton principal (accent plein, sauf style outlined/ghost) — utilisé pour tous les CTA de la page.
  const btnPrimaryStyle: React.CSSProperties = {
    backgroundColor: btnRempli ? c.accent : "transparent",
    color: btnRempli ? c.fond : c.accent,
    border: btnStyle === "outlined" ? `2px solid ${c.accent}` : btnStyle === "ghost" ? "none" : "none",
    borderRadius: btnRadiusPx,
    padding: `${btnTaille.padY} ${btnTaille.padX}`,
    fontSize: btnTaille.text,
    textDecoration: btnStyle === "ghost" ? "underline" : "none",
    ["--ax-accent-glow" as any]: `${c.accent}80`,
  };
  const btnPrimaryClass = `inline-flex items-center justify-center gap-2 font-semibold ${btnHoverClass}`;

  // ─── HERO ────────────────────────────────────────────────────────────────
  const heroInner = sec.hero.actif ? (() => {
    const h = sec.hero;
    const ctaHref = `/${slug}/${h.ctaLien || "produits"}`;

    if (h.style === "fullscreen") {
      return (
        <section className="relative flex items-center justify-center" style={{ minHeight: "100vh" }}>
          {tenant.bannerUrl && (
            <img src={tenant.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div
            className="absolute inset-0"
            style={{
              background: tenant.bannerUrl
                ? `linear-gradient(to bottom, rgba(0,0,0,${h.overlay / 100}) 0%, rgba(0,0,0,${(h.overlay + 20) / 100}) 100%)`
                : heroGradient,
            }}
          />
          <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
            <h1 className="text-5xl sm:text-7xl font-bold font-playfair leading-tight mb-6 text-white">
              {h.titre}
            </h1>
            <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">{h.sousTitre}</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={ctaHref} className="px-10 py-4 rounded-2xl font-semibold text-base transition-all hover:opacity-90 hover:scale-105 active:scale-95" style={btnPrimaryStyle}>
                {h.ctaTexte}
              </Link>
              <Link href={`/${slug}/produits`} className="px-10 py-4 rounded-2xl font-semibold text-base transition-all border-2 text-white border-white/40 hover:bg-white/10" style={{ borderRadius: radius }}>
                Voir tout
              </Link>
            </div>
          </div>
        </section>
      );
    }

    if (h.style === "split") {
      return (
        <section className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12`}>
          <div className="grid lg:grid-cols-2 gap-6 items-stretch min-h-[520px]">
            <div className="relative rounded-3xl overflow-hidden" style={{ background: heroGradient, minHeight: "420px" }}>
              {tenant.bannerUrl && (
                <img src={tenant.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${h.overlay / 100})` }} />
              <div className="absolute bottom-8 left-8 right-8">
                <span className="text-sm font-semibold uppercase tracking-widest mb-3 block" style={{ color: c.accent }}>
                  {tenant.categorie}
                </span>
              </div>
            </div>
            <div className="flex flex-col justify-center py-8 lg:py-0 lg:pl-8">
              <span className="text-sm font-semibold uppercase tracking-widest mb-4 inline-block" style={{ color: c.accent }}>
                Bienvenue
              </span>
              <h1 className="text-4xl sm:text-5xl font-bold font-playfair leading-tight mb-6" style={{ color: c.texte }}>
                {h.titre}
              </h1>
              <p className="text-lg mb-8 leading-relaxed" style={{ color: c.texte, opacity: 0.7 }}>{h.sousTitre}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href={ctaHref} className="px-8 py-4 font-semibold text-sm transition-all hover:opacity-90 hover:scale-105 active:scale-95 text-center" style={btnPrimaryStyle}>
                  {h.ctaTexte}
                </Link>
                <Link href={`/${slug}/produits`} className="px-8 py-4 font-semibold text-sm transition-all border text-center" style={{ borderColor: `${c.accent}40`, color: c.texte, borderRadius: radius }}>
                  Voir tous les produits
                </Link>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (h.style === "minimal") {
      return (
        <section className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24`}>
          <div className="max-w-3xl">
            <span className="text-sm font-semibold uppercase tracking-widest mb-4 block" style={{ color: c.accent }}>
              {tenant.categorie}
            </span>
            <h1 className="text-5xl sm:text-6xl font-bold font-playfair leading-tight mb-6">{h.titre}</h1>
            <p className="text-xl mb-8 leading-relaxed" style={{ opacity: 0.7 }}>{h.sousTitre}</p>
            <Link href={ctaHref} className="inline-flex items-center gap-2 px-8 py-4 font-semibold text-sm transition-all hover:opacity-90" style={btnPrimaryStyle}>
              {h.ctaTexte} →
            </Link>
          </div>
        </section>
      );
    }

    // Default: centered
    return (
      <section className="relative flex items-center justify-center py-20 sm:py-32 px-4" style={{ background: heroGradient }}>
        {tenant.bannerUrl && (
          <img src={tenant.bannerUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
        )}
        {tenant.bannerUrl && (
          <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${h.overlay / 100})` }} />
        )}
        <div className="relative z-10 text-center max-w-3xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-widest mb-5 block" style={{ color: tenant.bannerUrl ? "#fff" : c.accent }}>
            {tenant.categorie} · {tenant.pays}
          </span>
          <h1 className="text-4xl sm:text-6xl font-bold font-playfair leading-tight mb-6" style={{ color: tenant.bannerUrl ? "#fff" : c.texte }}>
            {h.titre}
          </h1>
          <p className="text-lg sm:text-xl mb-10 leading-relaxed max-w-2xl mx-auto" style={{ color: tenant.bannerUrl ? "rgba(255,255,255,0.8)" : c.texte, opacity: tenant.bannerUrl ? 1 : 0.7 }}>
            {h.sousTitre}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={ctaHref} className="px-10 py-4 font-semibold text-base transition-all hover:opacity-90 hover:scale-105 active:scale-95" style={btnPrimaryStyle}>
              {h.ctaTexte}
            </Link>
            <Link href={`/${slug}/produits`} className="px-10 py-4 font-semibold text-base transition-all border-2" style={{ borderColor: `${c.accent}50`, color: tenant.bannerUrl ? "#fff" : c.texte, borderRadius: radius }}>
              Tous les produits
            </Link>
          </div>
        </div>
      </section>
    );
  })() : null;

  const heroNode = sec.hero.actif ? (
    <>
      <ScrollReveal type={revealType("hero")} vitesse={vitesseGlobale} delay={staggerDelay()}>
        {heroInner}
      </ScrollReveal>
      <SousBlocsRenderer blocs={cfg.sectionSousBlocs?.hero} accent={c.accent} texte={c.texte} />
    </>
  ) : null;

  // ─── BADGES DE CONFIANCE — enfin pilotée par la vraie config ─────────────
  const confianceCfg = sec.confiance;
  const confianceItems = confianceCfg?.items ?? [];
  const confianceNode = (confianceCfg?.actif ?? true) && confianceItems.length > 0 ? (
    <ScrollReveal type={revealType("confiance")} vitesse={vitesseGlobale} delay={staggerDelay()}>
      <section className="border-y py-6" style={{ borderColor: `${c.accent}15`, backgroundColor: c.surface }}>
        <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8`}>
          {confianceCfg?.layout === "marquee" ? (
            <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-12 sm:w-24 z-10 pointer-events-none" style={{ background: `linear-gradient(90deg, ${c.surface}, transparent)` }} />
              <div className="absolute inset-y-0 right-0 w-12 sm:w-24 z-10 pointer-events-none" style={{ background: `linear-gradient(270deg, ${c.surface}, transparent)` }} />
              <div className="ax-confiance-marquee-track">
                {[...confianceItems, ...confianceItems].map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5 flex-shrink-0 px-6 sm:px-8">
                    <span className="text-xl">{b.icone}</span>
                    <div>
                      <p className="font-semibold text-sm whitespace-nowrap" style={{ color: c.texte }}>{b.titre}</p>
                      <p className="text-xs whitespace-nowrap" style={{ color: c.texte, opacity: 0.5 }}>{b.texte}</p>
                    </div>
                  </div>
                ))}
              </div>
              <style>{`
                .ax-confiance-marquee-track { display:flex; align-items:center; width:max-content; animation: axConfianceMarquee 24s linear infinite; }
                .ax-confiance-marquee-track:hover { animation-play-state: paused; }
                @keyframes axConfianceMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
                @media (prefers-reduced-motion: reduce) { .ax-confiance-marquee-track { animation: none; } }
              `}</style>
            </div>
          ) : confianceCfg?.layout === "cards" ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {confianceItems.map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-2 text-center p-5 rounded-2xl" style={{ background: c.fond, border: `1px solid ${c.accent}15` }}>
                  <span className="text-2xl">{b.icone}</span>
                  <p className="font-semibold text-sm" style={{ color: c.texte }}>{b.titre}</p>
                  <p className="text-xs" style={{ color: c.texte, opacity: 0.5 }}>{b.texte}</p>
                </div>
              ))}
            </div>
          ) : confianceCfg?.layout === "bar" ? (
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {confianceItems.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-lg">{b.icone}</span>
                  <span className="text-sm font-medium" style={{ color: c.texte }}>{b.titre}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {confianceItems.map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <span className="text-2xl">{b.icone}</span>
                  <p className="font-semibold text-sm" style={{ color: c.texte }}>{b.titre}</p>
                  <p className="text-xs" style={{ color: c.texte, opacity: 0.5 }}>{b.texte}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </ScrollReveal>
  ) : null;

  // ─── PRODUITS VEDETTES ────────────────────────────────────────────────────
  const vedettesNode = sec.vedettes.actif && vedettes.length > 0 ? (
    <>
      <ScrollReveal type={revealType("vedettes")} vitesse={vitesseGlobale} delay={staggerDelay()}>
        <section className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 ${SECTION_PY}`}>
          <div className="flex items-end justify-between mb-10">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: c.accent }}>Sélection</span>
              <h2 className="text-3xl sm:text-4xl font-bold font-playfair">{sec.vedettes.titre}</h2>
            </div>
            <Link href={`/${slug}/produits`} className="text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: c.accent }}>
              Voir tout →
            </Link>
          </div>
          <div className={`grid ${GRID_PRODUITS} gap-4 sm:gap-6`}>
            {vedettes.map((p) => {
              const prixAffiche = prixClient(p.prix, tenant.commissionRate ?? 0.06);
              const prixCompareAffiche = p.prixCompare ? prixClient(p.prixCompare, tenant.commissionRate ?? 0.06) : null;
              const remise = prixCompareAffiche && prixCompareAffiche > prixAffiche
                ? Math.round(((prixCompareAffiche - prixAffiche) / prixCompareAffiche) * 100)
                : 0;
              return (
                <Link key={p.id} href={`/${slug}/produits/${p.id}`} className="group">
                  <div
                    className={`rounded-2xl overflow-hidden ${carteClass}`}
                    style={{ backgroundColor: c.surface, borderColor: `${c.accent}15`, borderRadius: radius }}
                  >
                    <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: c.fond }}>
                      {p.images[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.nom}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Package size={48} className="opacity-20" /></div>
                      )}
                      <WishlistHeartButton produitId={p.id} accent={c.accent} fond={c.fond} className="absolute top-3 right-3 w-8 h-8 rounded-full" />
                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                        {p.featured && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: c.accent, color: c.fond }}>
                            VEDETTE
                          </span>
                        )}
                        {remise > 0 && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-red-500 text-white">
                            -{remise}%
                          </span>
                        )}
                        {p.stock === 0 && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-500/80 text-white">
                            Épuisé
                          </span>
                        )}
                      </div>
                      {/* Hover overlay */}
                      <div className="absolute inset-0 flex items-end p-3 opacity-0 group-hover:opacity-100 transition-all duration-300" style={{ background: `linear-gradient(to top, ${c.fond}cc 0%, transparent 60%)` }}>
                        <span className="w-full text-center text-xs font-bold py-2 rounded-xl" style={{ backgroundColor: c.accent, color: c.fond }}>
                          Voir le produit
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-sm mb-2 line-clamp-2 leading-snug">{p.nom}</h3>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: c.accent }}>
                          {formatMontant(prixAffiche, tenant.devise)}
                        </span>
                        {remise > 0 && (
                          <span className="text-xs opacity-40 line-through">
                            {formatMontant(prixCompareAffiche!, tenant.devise)}
                          </span>
                        )}
                      </div>
                      {p.ventes > 0 && (
                        <p className="text-[10px] mt-1" style={{ opacity: 0.4 }}>{p.ventes} ventes</p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </ScrollReveal>
      <SousBlocsRenderer blocs={cfg.sectionSousBlocs?.vedettes} accent={c.accent} texte={c.texte} />
    </>
  ) : null;

  // ─── COLLECTIONS ──────────────────────────────────────────────────────────
  const collectionsNode = sec.collections.actif && tenant.collections.length > 0 ? (
    <>
      <ScrollReveal type={revealType("collections")} vitesse={vitesseGlobale} delay={staggerDelay()}>
        <section className={SECTION_PY} style={{ backgroundColor: c.surface }}>
          <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8`}>
            <div className="text-center mb-12">
              <span className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: c.accent }}>Univers</span>
              <h2 className="text-3xl sm:text-4xl font-bold font-playfair">{sec.collections.titre}</h2>
            </div>
            <div className={`grid gap-4 ${tenant.collections.length === 1 ? "grid-cols-1 max-w-2xl mx-auto" : tenant.collections.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`}>
              {tenant.collections.slice(0, 6).map((col, i) => (
                <Link key={col.slug} href={`/${slug}/collections/${col.slug}`} className="group">
                  <div
                    className="relative overflow-hidden transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-1"
                    style={{
                      borderRadius: radius,
                      minHeight: i === 0 && tenant.collections.length >= 3 ? "320px" : "220px",
                      background: heroGradient,
                    }}
                  >
                    {col.imageUrl && (
                      <img src={col.imageUrl} alt={col.nom} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    )}
                    <div
                      className="absolute inset-0 flex flex-col justify-end p-6"
                      style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)" }}
                    >
                      <h3 className="text-white font-bold text-xl font-playfair mb-1">{col.nom}</h3>
                      {col.description && <p className="text-white/70 text-sm line-clamp-2 mb-3">{col.description}</p>}
                      <span className="text-sm font-semibold inline-flex items-center gap-1" style={{ color: c.accent }}>
                        Explorer →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>
      <SousBlocsRenderer blocs={cfg.sectionSousBlocs?.collections} accent={c.accent} texte={c.texte} />
    </>
  ) : null;

  // ─── NOTRE HISTOIRE (about) — nouvelle section, n'existait pas du tout ────
  const aboutCfg = sec.about;
  const aboutNode = aboutCfg?.actif ? (
    <ScrollReveal type={revealType("about")} vitesse={vitesseGlobale} delay={staggerDelay()}>
      <section className={SECTION_PY}>
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${aboutCfg.layout === "fullwidth" ? "max-w-full" : CONTAINER}`}>
          {aboutCfg.layout === "centered" ? (
            <div className="max-w-2xl mx-auto text-center">
              {aboutCfg.badgeTexte && (
                <span className="text-xs font-semibold uppercase tracking-widest mb-3 inline-block px-3 py-1 rounded-full" style={{ color: c.accent, background: `${c.accent}12` }}>{aboutCfg.badgeTexte}</span>
              )}
              <h2 className="text-3xl sm:text-4xl font-bold font-playfair mb-5" style={{ color: c.texte }}>{aboutCfg.titre}</h2>
              <p className="text-base leading-relaxed mb-8" style={{ color: c.texte, opacity: 0.7 }}>{aboutCfg.texte}</p>
              {!!aboutCfg.stats?.length && (
                <div className="flex flex-wrap justify-center gap-8">
                  {aboutCfg.stats.map((s, i) => (
                    <div key={i}>
                      <p className="text-3xl font-bold font-playfair" style={{ color: c.accent }}>{s.valeur}</p>
                      <p className="text-xs mt-1" style={{ color: c.texte, opacity: 0.55 }}>{s.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : aboutCfg.layout === "fullwidth" ? (
            <div className="relative overflow-hidden" style={{ minHeight: "420px" }}>
              {aboutCfg.imageUrl && <img src={aboutCfg.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 100%)" }} />
              <div className="relative z-10 max-w-3xl mx-auto text-center px-6 py-24 text-white">
                {aboutCfg.badgeTexte && <span className="text-xs font-semibold uppercase tracking-widest mb-3 inline-block">{aboutCfg.badgeTexte}</span>}
                <h2 className="text-3xl sm:text-4xl font-bold font-playfair mb-5">{aboutCfg.titre}</h2>
                <p className="text-base leading-relaxed opacity-85">{aboutCfg.texte}</p>
              </div>
            </div>
          ) : (
            <div className={`grid lg:grid-cols-2 gap-10 items-center ${aboutCfg.layout === "image-left" ? "" : ""}`}>
              <div className={aboutCfg.layout === "image-left" ? "lg:order-1" : "lg:order-2"}>
                {aboutCfg.imageUrl ? (
                  <div className="rounded-3xl overflow-hidden" style={{ minHeight: "320px" }}>
                    <img src={aboutCfg.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="rounded-3xl" style={{ minHeight: "320px", background: heroGradient }} />
                )}
              </div>
              <div className={aboutCfg.layout === "image-left" ? "lg:order-2" : "lg:order-1"}>
                {aboutCfg.badgeTexte && (
                  <span className="text-xs font-semibold uppercase tracking-widest mb-3 inline-block px-3 py-1 rounded-full" style={{ color: c.accent, background: `${c.accent}12` }}>{aboutCfg.badgeTexte}</span>
                )}
                <h2 className="text-3xl sm:text-4xl font-bold font-playfair mb-5" style={{ color: c.texte }}>{aboutCfg.titre}</h2>
                <p className="text-base leading-relaxed mb-8" style={{ color: c.texte, opacity: 0.7 }}>{aboutCfg.texte}</p>
                {!!aboutCfg.stats?.length && (
                  <div className="flex flex-wrap gap-8">
                    {aboutCfg.stats.map((s, i) => (
                      <div key={i}>
                        <p className="text-3xl font-bold font-playfair" style={{ color: c.accent }}>{s.valeur}</p>
                        <p className="text-xs mt-1" style={{ color: c.texte, opacity: 0.55 }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </ScrollReveal>
  ) : null;

  // ─── BANNIÈRE PROMO ───────────────────────────────────────────────────────
  const promoNode = sec.promo.actif ? (
    <>
      <ScrollReveal type={revealType("promo")} vitesse={vitesseGlobale} delay={staggerDelay()}>
        <section className={SECTION_PY}>
          <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8`}>
            <div
              className="relative overflow-hidden py-14 px-8 sm:px-16 text-center"
              style={{
                background: `linear-gradient(135deg, ${c.accent}20 0%, ${c.accent}10 50%, ${c.accent}05 100%)`,
                border: `1px solid ${c.accent}25`,
                borderRadius: radius,
              }}
            >
              <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, ${c.accent}08 0%, transparent 70%)` }} />
              <h2 className="relative text-3xl sm:text-4xl font-bold font-playfair mb-4" style={{ color: c.accent }}>
                {sec.promo.titre}
              </h2>
              <p className="relative text-lg mb-8 max-w-xl mx-auto" style={{ opacity: 0.7 }}>{sec.promo.texte}</p>
              <Link
                href={`/${slug}/produits`}
                className="inline-flex items-center gap-2 px-8 py-4 font-semibold text-sm transition-all hover:opacity-90 hover:scale-105 active:scale-95"
                style={btnPrimaryStyle}
              >
                {sec.promo.ctaTexte} →
              </Link>
            </div>
          </div>
        </section>
      </ScrollReveal>
      <SousBlocsRenderer blocs={cfg.sectionSousBlocs?.promo} accent={c.accent} texte={c.texte} />
    </>
  ) : null;

  // ─── FAQ — nouvelle section, n'existait pas du tout ──────────────────────
  const faqCfg = sec.faq;
  const faqNode = faqCfg?.actif && (faqCfg.items?.length ?? 0) > 0 ? (
    <ScrollReveal type={revealType("faq")} vitesse={vitesseGlobale} delay={staggerDelay()}>
      <HomeFaqSection titre={faqCfg.titre} layout={faqCfg.layout} items={faqCfg.items} accent={c.accent} texte={c.texte} surface={c.surface} />
    </ScrollReveal>
  ) : null;

  // ─── AVIS CLIENTS ─────────────────────────────────────────────────────────
  const avisNode = sec.avis.actif && tenant.avis.length > 0 ? (
    <>
      <ScrollReveal type={revealType("avis")} vitesse={vitesseGlobale} delay={staggerDelay()}>
        <section className={SECTION_PY} style={{ backgroundColor: c.surface }}>
          <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8`}>
            <div className="text-center mb-12">
              <span className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color: c.accent }}>Témoignages</span>
              <h2 className="text-3xl sm:text-4xl font-bold font-playfair">{sec.avis.titre}</h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tenant.avis.slice(0, 6).map((avis) => (
                <div
                  key={avis.id}
                  className="p-6 border transition-all hover:-translate-y-0.5"
                  style={{ backgroundColor: c.fond, border: `1px solid ${c.accent}15`, borderRadius: radius }}
                >
                  <div className="flex items-center gap-1 mb-3">
                    {[1,2,3,4,5].map((i) => (
                      <span key={i} className="text-base" style={{ color: i <= avis.note ? c.accent : `${c.texte}20` }}>★</span>
                    ))}
                    {avis.verifie && (
                      <span className="ml-2 text-[10px] font-semibold text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Vérifié</span>
                    )}
                  </div>
                  {avis.titre && <p className="font-semibold text-sm mb-2">{avis.titre}</p>}
                  {avis.commentaire && <p className="text-sm leading-relaxed mb-4" style={{ opacity: 0.65 }}>{avis.commentaire}</p>}
                  <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: `${c.accent}10` }}>
                    <div>
                      <p className="text-xs font-semibold">{avis.client?.nom || "Client"}</p>
                      <p className="text-[10px] opacity-40 mt-0.5">à propos de {(avis as any).produit?.nom}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </ScrollReveal>
      <SousBlocsRenderer blocs={cfg.sectionSousBlocs?.avis} accent={c.accent} texte={c.texte} />
    </>
  ) : null;

  // ─── NEWSLETTER ───────────────────────────────────────────────────────────
  const newsletterNode = sec.newsletter.actif ? (
    <>
      <ScrollReveal type={revealType("newsletter")} vitesse={vitesseGlobale} delay={staggerDelay()}>
        <section className={SECTION_PY} style={{ background: `linear-gradient(135deg, ${c.accent}15 0%, ${c.accent}05 100%)` }}>
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold font-playfair mb-3">{sec.newsletter.titre}</h2>
            <p className="mb-8 text-lg" style={{ opacity: 0.65 }}>{sec.newsletter.texte}</p>
            <form className="flex flex-col sm:flex-row gap-3 justify-center" method="post" action="/api/newsletter">
              <input
                type="email"
                placeholder={sec.newsletter.placeholder}
                className="flex-1 px-5 py-3.5 text-sm border focus:outline-none max-w-sm"
                style={{ backgroundColor: c.fond, borderColor: `${c.accent}30`, color: c.texte, borderRadius: radius }}
              />
              <button
                type="submit"
                className="px-7 py-3.5 text-sm font-semibold transition-all hover:opacity-90"
                style={btnPrimaryStyle}
              >
                {sec.newsletter.ctaTexte}
              </button>
            </form>
          </div>
        </section>
      </ScrollReveal>
      <SousBlocsRenderer blocs={cfg.sectionSousBlocs?.newsletter} accent={c.accent} texte={c.texte} />
    </>
  ) : null;

  // ─── Ordre des sections — enfin piloté par le glisser-déposer du builder ──
  // (auparavant sectionOrder n'était jamais lu, l'ordre restait toujours figé)
  const SECTION_NODES: Record<string, React.ReactNode> = {
    hero: heroNode,
    confiance: confianceNode,
    vedettes: vedettesNode,
    collections: collectionsNode,
    about: aboutNode,
    promo: promoNode,
    faq: faqNode,
    avis: avisNode,
    newsletter: newsletterNode,
  };
  const ordreBrut = (cfg.sectionOrder?.length ? cfg.sectionOrder : DEFAULT_SECTION_ORDER).filter((id) => id !== "annonce" && SECTION_NODES.hasOwnProperty(id));
  const ordre = [...ordreBrut];
  for (const id of DEFAULT_SECTION_ORDER) if (!ordre.includes(id)) ordre.push(id);

  return (
    <div style={{ backgroundColor: c.fond, color: c.texte, minHeight: "100vh" }}>
      {/* ─── BARRE D'ANNONCE ─── */}
      {sec.annonce.actif && (
        <div
          data-axs-id="annonce"
          className="py-2.5 text-center text-xs font-semibold tracking-wide overflow-hidden"
          style={{ backgroundColor: sec.annonce.couleurFond, color: sec.annonce.couleurTexte }}
        >
          <div className={`${CONTAINER} mx-auto px-4 truncate`}>{sec.annonce.texte}</div>
        </div>
      )}
      <SousBlocsRenderer blocs={cfg.sectionSousBlocs?.annonce} accent={c.accent} texte={c.texte} />

      {/* ─── NAVBAR ─── */}
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

      {ordre.map((id) => SECTION_NODES[id] ? <div key={id} data-axs-id={id}>{SECTION_NODES[id]}</div> : null)}

      {/* ─── SECTIONS CUSTOM (générées par l'IA ou builder) ─── */}
      <CustomSectionsRenderer sections={cfg.customSections ?? []} slug={slug} colors={c} container={CONTAINER} sectionPy={SECTION_PY} />

      {/* ─── FOOTER ─── */}
      <footer className="border-t mt-0" style={{ backgroundColor: c.fond, borderColor: `${c.accent}15` }}>
        <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 py-14`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="lg:col-span-2">
              {tenant.logoUrl ? (
                <img src={tenant.logoUrl} alt={tenant.nomBoutique} className="h-10 mb-4 object-contain" />
              ) : (
                <p className="text-2xl font-bold font-playfair mb-4" style={{ color: c.accent }}>{tenant.nomBoutique}</p>
              )}
              {tenant.description && (
                <p className="text-sm leading-relaxed mb-5" style={{ opacity: 0.55, maxWidth: "320px" }}>{tenant.description}</p>
              )}
              {/* Réseaux sociaux */}
              <div className="flex gap-3">
                {socialLinks.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                    style={{ backgroundColor: `${c.accent}15`, color: c.accent }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </a>
                )}
                {socialLinks.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                    style={{ backgroundColor: `${c.accent}15`, color: c.accent }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                )}
                {socialLinks.tiktok && (
                  <a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                    style={{ backgroundColor: `${c.accent}15`, color: c.accent }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.84a8.27 8.27 0 004.84 1.54V6.93a4.85 4.85 0 01-1.07-.24z"/></svg>
                  </a>
                )}
                {tenant.whatsapp && (
                  <a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all hover:opacity-80"
                    style={{ backgroundColor: `${c.accent}15`, color: c.accent }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div>
              <p className="font-semibold text-sm mb-4 uppercase tracking-wider" style={{ color: c.accent }}>Navigation</p>
              <div className="space-y-3">
                {[
                  { label: "Accueil", href: `/${slug}` },
                  { label: "Produits", href: `/${slug}/produits` },
                  ...(cfg.aboutPage?.actif ? [{ label: "À propos", href: `/${slug}/a-propos` }] : []),
                  ...(cfg.contactPage?.actif ? [{ label: "Contact", href: `/${slug}/contact` }] : []),
                  { label: "Mon panier", href: `/${slug}/panier` },
                  { label: "Suivi commande", href: `/suivi` },
                ].map((l) => (
                  <Link key={l.href} href={l.href} className="block text-sm transition-opacity hover:opacity-100" style={{ opacity: 0.55 }}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div>
              <p className="font-semibold text-sm mb-4 uppercase tracking-wider" style={{ color: c.accent }}>Contact</p>
              <div className="space-y-3">
                {tenant.email && (
                  <a href={`mailto:${tenant.email}`} className="block text-sm transition-opacity hover:opacity-100" style={{ opacity: 0.55 }}>
                    {tenant.email}
                  </a>
                )}
                {tenant.whatsapp && (
                  <a href={`https://wa.me/${tenant.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="block text-sm transition-opacity hover:opacity-100" style={{ opacity: 0.55 }}>
                    {tenant.whatsapp}
                  </a>
                )}
                {tenant.adresse && (
                  <p className="text-sm" style={{ opacity: 0.55 }}>{tenant.adresse}</p>
                )}
                {tenant.pays && (
                  <p className="text-sm" style={{ opacity: 0.55 }}>{tenant.pays}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t py-5" style={{ borderColor: `${c.accent}10` }}>
          <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs`} style={{ opacity: 0.4 }}>
            <p>© {new Date().getFullYear()} {tenant.nomBoutique}. Tous droits réservés.</p>
            <p>Propulsé par <span style={{ color: c.accent, opacity: 1 }}>Axso</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
