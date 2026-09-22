"use client";

// Constructeur digital (façon Chariow) — squelette structurel partagé par les
// 4 gabarits (lib/digital-templates.ts). Les 4 gabarits composent EXACTEMENT
// la même hiérarchie (nav → titre → recherche/filtres → grille produits →
// pied de page) : seule l'identité visuelle change via `variant` + les
// couleurs/rayon du marchand (colors/radius, éditables dans le Constructeur
// digital comme pour une boutique physique). Rendu identique :
// - dans la vraie vitrine (components/storefront/digital/DigitalCatalogPage.tsx,
//   server component qui interroge Prisma puis passe les produits en props)
// - dans l'aperçu live du Constructeur digital (DigitalBuilder.tsx), avec les
//   MÊMES props React — aucune iframe, aucune sérialisation, le state du
//   panneau de réglages et l'aperçu partagent directement le même arbre React.
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShoppingBag, Package, ChevronDown, Globe2, Sparkles } from "lucide-react";
import { formatMontant } from "@/lib/utils";
import type { ThemeColors, ThemeDigitalConfig } from "@/lib/theme-config";

export interface DigitalProductVM {
  id: string;
  nom: string;
  images: string[];
  prixAffiche: number;
  categorie: string | null;
  tags: string[];
  featured: boolean;
  ventes: number;
}

export interface DigitalStoreShellProps {
  slug: string;
  nomBoutique: string;
  logoUrl?: string | null;
  description?: string | null;
  pays: string;
  devise: string;
  colors: ThemeColors;
  radius: string;
  templateId: "charriow" | "aurore" | "onyx" | "mint";
  digitalConfig: ThemeDigitalConfig;
  products: DigitalProductVM[];
  /** true dans l'aperçu du Constructeur (dashboard) — désactive la navigation réelle des liens */
  preview?: boolean;
}

const TRI_LABEL: Record<ThemeDigitalConfig["tri"], string> = {
  alphabetique: "Ordre alphabétique",
  populaires: "Les plus vendus",
  recents: "Les plus récents",
  "prix-desc": "Prix décroissant",
  "prix-asc": "Prix croissant",
};

const VARIANT = {
  charriow: { logoShape: "square" as const, navUnderline: true, card: "flat" as const, filter: "rect" as const, titleClass: "text-[28px] sm:text-4xl font-medium", uppercaseNav: false },
  aurore:   { logoShape: "circle" as const, navUnderline: false, card: "shadow" as const, filter: "rounded" as const, titleClass: "text-3xl sm:text-5xl font-bold", uppercaseNav: false },
  onyx:     { logoShape: "square" as const, navUnderline: false, card: "border" as const, filter: "rect" as const, titleClass: "text-3xl sm:text-5xl font-semibold tracking-tight", uppercaseNav: true },
  mint:     { logoShape: "circle" as const, navUnderline: false, card: "soft" as const, filter: "pill" as const, titleClass: "text-3xl sm:text-5xl font-extrabold", uppercaseNav: false },
};

export function DigitalStoreShell({
  slug, nomBoutique, logoUrl, description, pays, devise, colors, radius, templateId, digitalConfig, products, preview,
}: DigitalStoreShellProps) {
  const v = VARIANT[templateId] || VARIANT.charriow;
  const [q, setQ] = useState("");
  const [categorie, setCategorie] = useState("");
  const [type, setType] = useState("");

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.categorie).filter(Boolean))) as string[], [products]);
  const types = useMemo(() => Array.from(new Set(products.flatMap((p) => p.tags))).slice(0, 12), [products]);

  const filtres = useMemo(() => {
    return products.filter((p) => {
      if (q && !p.nom.toLowerCase().includes(q.toLowerCase())) return false;
      if (categorie && p.categorie !== categorie) return false;
      if (type && !p.tags.includes(type)) return false;
      return true;
    });
  }, [products, q, categorie, type]);

  const vedettes = digitalConfig.afficherVedettes ? products.filter((p) => p.featured).slice(0, 6) : [];
  const recommandes = digitalConfig.afficherRecommandes
    ? [...products].filter((p) => !p.featured).slice(-4).reverse()
    : [];

  const cardRadius = v.card === "flat" ? "0px" : radius;
  const disposition = digitalConfig.disposition === "un" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3";
  const href = (path: string) => (preview ? "#" : path);

  const navItems = [
    { label: "Produits", href: `/${slug}`, actif: true },
    ...(digitalConfig.afficherAffiliation ? [{ label: "Affiliation", href: `/${slug}/produits`, actif: false }] : []),
    { label: "À propos", href: `/${slug}/a-propos`, actif: false },
    { label: "Contact", href: `/${slug}/contact`, actif: false },
  ];

  return (
    <div className="axs-digital-store min-h-full flex flex-col" style={{ backgroundColor: colors.fond, color: colors.texte }}>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className={v.navUnderline ? "border-b-2" : "border-b"} style={{ borderColor: colors.bordure || `${colors.texte}15` }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 gap-4">
          <Link href={href(`/${slug}`)} className="flex items-center gap-2 flex-shrink-0 font-semibold" style={{ color: colors.texte }}>
            <span
              className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: colors.accent, color: colors.fond, borderRadius: v.logoShape === "circle" ? "9999px" : "6px" }}
            >
              {logoUrl ? <img src={logoUrl} alt="" className="w-full h-full object-cover" style={{ borderRadius: "inherit" }} /> : nomBoutique.slice(0, 1).toUpperCase()}
            </span>
            <span className="truncate max-w-[140px] sm:max-w-none">{nomBoutique}</span>
          </Link>

          <nav className={`hidden md:flex items-center gap-6 text-sm ${v.uppercaseNav ? "uppercase tracking-wide" : ""}`}>
            {navItems.map((n) => (
              <Link key={n.label} href={href(n.href)} className="transition-opacity hover:opacity-70" style={{ color: colors.texte, fontWeight: n.actif ? 600 : 400 }}>
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            <Link href={href(`/${slug}/mon-compte`)} className="hidden sm:flex items-center gap-1.5 text-sm transition-opacity hover:opacity-70" style={{ color: colors.texte }}>
              <ShoppingBag size={16} />
              <span>Mes achats</span>
            </Link>
            <div className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border" style={{ borderColor: colors.bordure || `${colors.texte}20`, color: colors.texteMuted || colors.texte }}>
              <Globe2 size={13} />
              <span>{pays} ({devise})</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Titre ────────────────────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-4">
          <h1 className={v.titleClass}>{description?.trim() || "Boutique de vente de produits digitaux"}</h1>
        </div>

        {/* ── Recherche / filtres ─────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-6 flex flex-col sm:flex-row gap-3">
          <div
            className="flex-1 flex items-center gap-2 px-4 h-11"
            style={{ backgroundColor: colors.surface, borderRadius: v.filter === "pill" ? "9999px" : v.filter === "rounded" ? radius : "8px", border: `1px solid ${colors.bordure || "transparent"}` }}
          >
            <Search size={16} style={{ color: colors.texteMuted || colors.texte }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher"
              className="flex-1 bg-transparent outline-none text-sm placeholder:opacity-60"
              style={{ color: colors.texte }}
            />
          </div>
          <FiltreSelect label="Catégorie" value={categorie} onChange={setCategorie} options={categories} colors={colors} radius={v.filter === "pill" ? "9999px" : v.filter === "rounded" ? radius : "8px"} />
          <FiltreSelect label="Type de produit" value={type} onChange={setType} options={types} colors={colors} radius={v.filter === "pill" ? "9999px" : v.filter === "rounded" ? radius : "8px"} />
        </div>

        {/* ── Vedettes ─────────────────────────────────────────────────── */}
        {vedettes.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: colors.accent }}>
              <Sparkles size={13} /> En vedette
            </p>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
              {vedettes.map((p) => (
                <div key={p.id} className="flex-shrink-0 w-48">
                  <ProductCard p={p} slug={slug} colors={colors} radius={cardRadius} cardStyle={v.card} preview={preview} afficherBouton={digitalConfig.afficherBoutonAchatCarte} devise={devise} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Grille produits ──────────────────────────────────────────── */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          {filtres.length === 0 ? (
            <div className="py-20 text-center opacity-50">
              <Package size={32} className="mx-auto mb-3" />
              <p className="text-sm">Aucun produit ne correspond à votre recherche.</p>
            </div>
          ) : (
            <div className={`grid ${disposition} gap-4 sm:gap-6`}>
              {filtres.map((p) => (
                <ProductCard key={p.id} p={p} slug={slug} colors={colors} radius={cardRadius} cardStyle={v.card} preview={preview} afficherBouton={digitalConfig.afficherBoutonAchatCarte} devise={devise} />
              ))}
            </div>
          )}
        </div>

        {/* ── Recommandés ──────────────────────────────────────────────── */}
        {recommandes.length > 0 && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 border-t pt-10" style={{ borderColor: colors.bordure || `${colors.texte}15` }}>
            <p className="text-sm font-semibold mb-4">Vous pourriez aussi aimer</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
              {recommandes.map((p) => (
                <ProductCard key={p.id} p={p} slug={slug} colors={colors} radius={cardRadius} cardStyle={v.card} preview={preview} afficherBouton={digitalConfig.afficherBoutonAchatCarte} devise={devise} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Pied de page ─────────────────────────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: colors.bordure || `${colors.texte}15` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-sm">
          <div>
            <p className="font-semibold mb-2">{nomBoutique}</p>
            <p style={{ color: colors.texteMuted || colors.texte, opacity: 0.8 }}>{description?.trim() || "Boutique de vente de produits digitaux"}</p>
          </div>
          <div>
            <p className="font-semibold mb-2">Liens</p>
            <div className="flex flex-col gap-1.5">
              {navItems.map((n) => (
                <Link key={n.label} href={href(n.href)} style={{ color: colors.texteMuted || colors.texte }} className="hover:opacity-70">{n.label}</Link>
              ))}
            </div>
          </div>
          <div>
            <p className="font-semibold mb-2">Légales</p>
            <div className="flex flex-col gap-1.5">
              <Link href={href("/legal/cgu")} style={{ color: colors.texteMuted || colors.texte }} className="hover:opacity-70">Conditions générales</Link>
              <Link href={href("/legal/privacy")} style={{ color: colors.texteMuted || colors.texte }} className="hover:opacity-70">Confidentialité</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FiltreSelect({ label, value, onChange, options, colors, radius }: { label: string; value: string; onChange: (v: string) => void; options: string[]; colors: ThemeColors; radius: string }) {
  return (
    <div className="relative flex-shrink-0 w-full sm:w-44">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-11 pl-3 pr-8 text-sm appearance-none outline-none"
        style={{ backgroundColor: colors.surface, color: value ? colors.texte : colors.texteMuted || colors.texte, borderRadius: radius, border: `1px solid ${colors.bordure || "transparent"}` }}
      >
        <option value="">{label}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: colors.texteMuted || colors.texte }} />
    </div>
  );
}

function ProductCard({ p, slug, colors, radius, cardStyle, preview, afficherBouton, devise }: {
  p: DigitalProductVM; slug: string; colors: ThemeColors; radius: string; cardStyle: "flat" | "shadow" | "border" | "soft"; preview?: boolean; afficherBouton: boolean; devise: string;
}) {
  const wrapStyle: React.CSSProperties = { borderRadius: radius, backgroundColor: colors.surface };
  const wrapClass =
    cardStyle === "flat" ? "border" :
    cardStyle === "shadow" ? "border shadow-sm hover:shadow-md transition-shadow" :
    cardStyle === "soft" ? "shadow-sm hover:shadow-lg transition-shadow" :
    "border-2";
  return (
    <Link href={preview ? "#" : `/${slug}/produits/${p.id}`} className={`group block overflow-hidden ${wrapClass}`} style={{ ...wrapStyle, borderColor: colors.bordure || `${colors.texte}20` }}>
      <div className="relative aspect-square overflow-hidden" style={{ backgroundColor: colors.fond }}>
        {p.images[0] ? (
          <img src={p.images[0]} alt={p.nom} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Package size={28} className="opacity-20" /></div>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="text-sm font-medium line-clamp-2 mb-1.5" style={{ color: colors.texte }}>{p.nom}</h3>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold" style={{ color: colors.accent }}>{formatMontant(p.prixAffiche, devise)}</span>
          {afficherBouton && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: colors.accent, color: colors.fond }}>Acheter</span>
          )}
        </div>
      </div>
    </Link>
  );
}
