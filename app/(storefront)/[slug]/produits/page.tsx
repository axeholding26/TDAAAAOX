export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatMontant } from "@/lib/utils";
import { prixClient } from "@/lib/pricing";
import { resolveThemeConfigAsync } from "@/lib/theme-config-server";
import Link from "next/link";
import { StorefrontNavbar } from "@/components/storefront/StorefrontNavbar";
import { WishlistHeartButton } from "@/components/storefront/WishlistHeartButton";
import { Package, Search } from "lucide-react";
import { ImportedLiteralProductListPage } from "@/components/storefront/templates/ImportedLiteralProductListPage";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; min?: string; max?: string; tri?: string; collection?: string }>;
}

export default async function ProduitsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { q, min, max, tri, collection } = await searchParams;

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

  const taux = tenant.commissionRate ?? 0.06;

  const where: any = { tenantId: tenant.id, actif: true, visibleListage: { not: false } };
  if (q) where.OR = [
    { nom: { contains: q, mode: "insensitive" } },
    { description: { contains: q, mode: "insensitive" } },
    { categorie: { contains: q, mode: "insensitive" } },
  ];
  // min/max sont saisis par le client en prix affiché (majoré) — on reconvertit
  // en prix vendeur (stocké en base) avant de filtrer.
  if (min) where.prix = { ...where.prix, gte: Number(min) / (1 + taux) };
  if (max) where.prix = { ...where.prix, lte: Number(max) / (1 + taux) };
  if (collection) {
    const col = await prisma.collection.findFirst({ where: { tenantId: tenant.id, slug: collection } });
    if (col) where.collections = { some: { id: col.id } };
  }

  const orderBy: any =
    tri === "prix-asc" ? { prix: "asc" } :
    tri === "prix-desc" ? { prix: "desc" } :
    tri === "populaire" ? { ventes: "desc" } :
    tri === "avis" ? { avis: { _count: "desc" } } :
    { createdAt: "desc" };

  const produits = await prisma.produit.findMany({ where, orderBy, take: 60 });

  const categories = Array.from(new Set(produits.map((p) => p.categorie).filter(Boolean))) as string[];
  const hasFilters = !!(q || tri || min || max || collection);

  if (cfg.builderHtmlProduits) {
    return <ImportedLiteralProductListPage cfg={cfg} />;
  }

  // Socle de repli — voir le commentaire équivalent dans page.tsx (accueil).
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

      <div className={`${CONTAINER} mx-auto px-4 sm:px-6 lg:px-8 py-10`}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <span className="text-xs font-semibold uppercase tracking-widest mb-1 block" style={{ color: c.accent }}>
                {tenant.nomBoutique}
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold font-playfair">
                {q ? `Résultats pour "${q}"` : collection ? `Collection` : "Tous les produits"}
              </h1>
            </div>
            <span className="text-sm" style={{ opacity: 0.4 }}>{produits.length} produit{produits.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Filters */}
          <form className="flex flex-wrap gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Rechercher un produit…"
              className="flex-1 min-w-48 px-4 py-2.5 text-sm border focus:outline-none"
              style={{ backgroundColor: c.surface, borderColor: `${c.accent}25`, color: c.texte, borderRadius: radius }}
            />
            <select
              name="tri"
              defaultValue={tri}
              className="px-4 py-2.5 text-sm border focus:outline-none"
              style={{ backgroundColor: c.surface, borderColor: `${c.accent}25`, color: c.texte, borderRadius: radius }}
            >
              <option value="">Plus récents</option>
              <option value="populaire">Best-sellers</option>
              <option value="prix-asc">Prix croissant</option>
              <option value="prix-desc">Prix décroissant</option>
              <option value="avis">Mieux notés</option>
            </select>
            <button
              type="submit"
              className={`text-sm ${btnPrimaryClass}`}
              style={btnPrimaryStyle}
            >
              Filtrer
            </button>
            {hasFilters && (
              <Link
                href={`/${slug}/produits`}
                className="px-4 py-2.5 text-sm border transition-all hover:opacity-80"
                style={{ borderColor: `${c.accent}30`, color: c.texte, borderRadius: radius }}
              >
                ✕ Effacer
              </Link>
            )}
          </form>
        </div>

        <div className="flex gap-8">
          {/* Sidebar (desktop) */}
          {(tenant.collections.length > 0 || categories.length > 0) && (
            <aside className="hidden lg:block w-52 flex-shrink-0 space-y-6">
              {tenant.collections.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: c.accent }}>
                    Collections
                  </p>
                  <div className="space-y-1">
                    <Link
                      href={`/${slug}/produits`}
                      className="block px-3 py-2 text-sm rounded-lg transition-all"
                      style={{
                        backgroundColor: !collection ? `${c.accent}15` : "transparent",
                        color: !collection ? c.accent : c.texte,
                        opacity: !collection ? 1 : 0.6,
                        borderRadius: "8px",
                      }}
                    >
                      Tous les produits
                    </Link>
                    {tenant.collections.map((col) => (
                      <Link
                        key={col.slug}
                        href={`/${slug}/produits?collection=${col.slug}`}
                        className="block px-3 py-2 text-sm rounded-lg transition-all"
                        style={{
                          backgroundColor: collection === col.slug ? `${c.accent}15` : "transparent",
                          color: collection === col.slug ? c.accent : c.texte,
                          opacity: collection === col.slug ? 1 : 0.6,
                          borderRadius: "8px",
                        }}
                      >
                        {col.nom}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {categories.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: c.accent }}>
                    Catégories
                  </p>
                  <div className="space-y-1">
                    {categories.map((cat) => (
                      <Link
                        key={cat}
                        href={`/${slug}/produits?q=${encodeURIComponent(cat)}`}
                        className="block px-3 py-2 text-sm rounded-lg transition-all"
                        style={{ color: c.texte, opacity: q === cat ? 1 : 0.6, borderRadius: "8px" }}
                      >
                        {cat}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}

          {/* Products grid */}
          <div className="flex-1">
            {produits.length === 0 ? (
              <div className="text-center py-24">
                <Search size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg font-semibold mb-2">Aucun produit trouvé</p>
                <p className="text-sm mb-6" style={{ opacity: 0.5 }}>
                  {q ? `Aucun résultat pour "${q}"` : "Cette collection est vide pour l'instant"}
                </p>
                <Link
                  href={`/${slug}/produits`}
                  className={`text-sm ${btnPrimaryClass}`}
                  style={btnPrimaryStyle}
                >
                  Voir tous les produits
                </Link>
              </div>
            ) : (
              <div className={`grid ${GRID_PRODUITS} gap-4 sm:gap-5`}>
                {produits.map((p) => {
                  const prixAffiche = prixClient(p.prix, taux);
                  const prixCompareAffiche = p.prixCompare ? prixClient(p.prixCompare, taux) : null;
                  const remise = prixCompareAffiche && prixCompareAffiche > prixAffiche
                    ? Math.round(((prixCompareAffiche - prixAffiche) / prixCompareAffiche) * 100)
                    : 0;
                  return (
                    <Link key={p.id} href={`/${slug}/produits/${p.id}`} className="group">
                      <div
                        className={`rounded-2xl overflow-hidden ${carteClass}`}
                        style={{ backgroundColor: c.surface, borderColor: `${c.accent}12`, borderRadius: radius }}
                      >
                        <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: c.fond }}>
                          {p.images[0] ? (
                            <img
                              src={p.images[0]}
                              alt={p.nom}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Package size={40} className="opacity-20" /></div>
                          )}
                          <WishlistHeartButton produitId={p.id} accent={c.accent} fond={c.fond} className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full" />
                          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
                            {p.featured && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ backgroundColor: c.accent, color: c.fond }}>
                                VEDETTE
                              </span>
                            )}
                            {remise > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-red-500 text-white">
                                -{remise}%
                              </span>
                            )}
                            {p.stock === 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-black/60 text-white">
                                Épuisé
                              </span>
                            )}
                          </div>
                          <div
                            className="absolute inset-0 flex items-end p-3 opacity-0 group-hover:opacity-100 transition-all duration-300"
                            style={{ background: `linear-gradient(to top, ${c.fond}cc 0%, transparent 60%)` }}
                          >
                            <span className="w-full text-center text-xs font-bold py-2 rounded-xl" style={{ backgroundColor: c.accent, color: c.fond }}>
                              Voir le produit
                            </span>
                          </div>
                        </div>
                        <div className="p-3.5">
                          <p className="font-medium text-sm leading-snug line-clamp-2 mb-2">{p.nom}</p>
                          {p.categorie && (
                            <p className="text-[10px] mb-2" style={{ opacity: 0.4 }}>{p.categorie}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm" style={{ color: c.accent }}>
                              {formatMontant(prixAffiche, tenant.devise)}
                            </span>
                            {remise > 0 && (
                              <span className="text-xs line-through" style={{ opacity: 0.35 }}>
                                {formatMontant(prixCompareAffiche!, tenant.devise)}
                              </span>
                            )}
                          </div>
                          {p.ventes > 5 && (
                            <p className="text-[10px] mt-1" style={{ opacity: 0.35 }}>{p.ventes} ventes</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="border-t mt-16 py-8 text-center text-xs" style={{ borderColor: `${c.accent}10`, opacity: 0.4 }}>
        <p>{tenant.nomBoutique} · Propulsé par <span style={{ color: c.accent, opacity: 1 }}>Axso</span></p>
      </footer>
    </div>
  );
}
