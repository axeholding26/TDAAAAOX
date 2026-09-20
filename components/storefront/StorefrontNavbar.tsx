"use client";

import Link from "next/link";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { ShoppingBag, Menu, X, Search, BadgeCheck, Heart, ChevronDown, Package } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ThemeNavigationCfg } from "@/lib/theme-config";
import { formatMontant } from "@/lib/utils";

interface Props {
  slug: string;
  nomBoutique: string;
  logoUrl?: string | null;
  accent: string;
  fond: string;
  texte: string;
  radius: string;
  collections: Array<{ slug: string; nom: string }>;
  certifie?: boolean;
  navStyle?: ThemeNavigationCfg;
  showAbout?: boolean;
  showContact?: boolean;
}

interface RechercheProduit {
  id: string;
  nom: string;
  prix: number;
  image: string | null;
}

const HAUTEUR_PX: Record<string, number> = { "48px": 48, "64px": 64, "80px": 80 };

export function StorefrontNavbar({ slug, nomBoutique, logoUrl, accent, fond, texte, radius, collections, certifie, navStyle, showAbout, showContact }: Props) {
  const totalItems = useCartStore((s) => s.totalItems());
  const wishlistCount = useWishlistStore((s) => s.produitIds.length);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [rechercheOuverte, setRechercheOuverte] = useState(false);
  const [megaOuvert, setMegaOuvert] = useState(false);
  const [scroll, setScroll] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ─── Recherche live (suggestions pendant la frappe) ────────────────────────
  // Complète le formulaire GET existant (Entrée → /produits?q=... conservé
  // tel quel) sans le remplacer : un menu de suggestions apparaît en plus.
  const [query, setQuery] = useState("");
  const [resultats, setResultats] = useState<RechercheProduit[]>([]);
  const [dropdownOuvert, setDropdownOuvert] = useState(false);
  const [mobileQuery, setMobileQuery] = useState("");
  const [mobileResultats, setMobileResultats] = useState<RechercheProduit[]>([]);
  const [devise, setDevise] = useState("XAF");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const mobileSearchBoxRef = useRef<HTMLDivElement>(null);

  async function chercher(q: string, cible: "desktop" | "mobile") {
    if (q.trim().length < 2) {
      if (cible === "desktop") { setResultats([]); setDropdownOuvert(false); } else setMobileResultats([]);
      return;
    }
    try {
      const res = await fetch(`/api/storefront/${slug}/recherche?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const produits = data.produits || [];
      if (data.devise) setDevise(data.devise);
      if (cible === "desktop") { setResultats(produits); setDropdownOuvert(true); } else setMobileResultats(produits);
    } catch { /* recherche live optionnelle — la soumission classique reste le repli */ }
  }

  function onQueryChange(v: string, cible: "desktop" | "mobile") {
    if (cible === "desktop") setQuery(v); else setMobileQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => chercher(v, cible), 250);
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setDropdownOuvert(false);
        if (!query.trim()) setRechercheOuverte(false); // referme l'icône si le champ est vide
      }
    }
    function onEscape(e: KeyboardEvent) { if (e.key === "Escape") { setDropdownOuvert(false); setRechercheOuverte(false); } }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => { document.removeEventListener("mousedown", onClickOutside); document.removeEventListener("keydown", onEscape); };
  }, [query]);

  const type = navStyle?.type || "classic";
  const style = navStyle?.style || "light";
  const sticky = navStyle?.sticky !== false;
  const hauteur = HAUTEUR_PX[navStyle?.hauteur || "64px"] ?? 64;
  const showSearch = navStyle?.showSearch !== false;
  const showWishlist = navStyle?.showWishlist === true;
  const minimal = type === "minimal";

  useEffect(() => {
    const handler = () => setScroll(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (rechercheOuverte) searchRef.current?.focus();
  }, [rechercheOuverte]);

  // ─── Apparence (couleurs, flou, bordure) selon style + type ───────────────────
  let bg: string, txt: string, border: string, blur: string | undefined, shadow: string;
  if (type === "transparent-scroll") {
    bg = scroll ? `${fond}f0` : `${fond}cc`;
    txt = texte;
    border = `1px solid ${accent}18`;
    blur = "blur(20px)";
    shadow = scroll ? `0 1px 40px ${accent}08` : "none";
  } else if (style === "dark") {
    bg = "rgba(10,10,12,0.94)";
    txt = "#F5F5F5";
    border = "1px solid rgba(255,255,255,0.08)";
    blur = "blur(14px)";
    shadow = "0 1px 24px rgba(0,0,0,0.25)";
  } else if (style === "glass") {
    bg = `${fond}40`;
    txt = texte;
    border = `1px solid ${accent}20`;
    blur = "blur(24px) saturate(160%)";
    shadow = `0 4px 30px ${accent}0a`;
  } else if (style === "transparent") {
    bg = "transparent";
    txt = texte;
    border = "none";
    blur = undefined;
    shadow = "none";
  } else {
    // light
    bg = `${fond}f0`;
    txt = texte;
    border = `1px solid ${accent}18`;
    blur = "blur(20px)";
    shadow = "none";
  }

  const outerClass = [
    "z-50 transition-all duration-500 w-full",
    sticky ? "sticky top-0" : "relative",
    type === "floating" ? "px-3 sm:px-6 pt-3" : "",
  ].join(" ");

  const barBase: React.CSSProperties = {
    backgroundColor: bg,
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
    border,
    boxShadow: shadow,
    height: hauteur,
  };
  const barClass = type === "floating"
    ? "max-w-5xl mx-auto rounded-2xl px-4 sm:px-6 flex items-center justify-between gap-4"
    : "px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4";

  const logoNode = (
    <Link href={`/${slug}`} className="flex-shrink-0 min-w-0 flex items-center gap-1.5">
      {logoUrl ? (
        <img src={logoUrl} alt={nomBoutique} className="h-9 object-contain max-w-[180px]" />
      ) : (
        <span className="text-xl font-bold font-playfair truncate" style={{ color: accent }}>
          {nomBoutique}
        </span>
      )}
      {certifie && (
        <span className="flex-shrink-0" title="Boutique certifiée Axso">
          <BadgeCheck size={16} style={{ color: accent }} />
        </span>
      )}
    </Link>
  );

  const collectionLinks = type === "mega" ? collections : collections.slice(0, 4);

  const linksNode = !minimal && (
    <div className="hidden md:flex items-center gap-8">
      <Link href={`/${slug}/produits`} className="text-sm font-medium opacity-70 hover:opacity-100 transition-opacity tracking-wide" style={{ color: txt }}>
        Produits
      </Link>
      {showAbout && (
        <Link href={`/${slug}/a-propos`} className="text-sm font-medium opacity-70 hover:opacity-100 transition-opacity tracking-wide" style={{ color: txt }}>
          À propos
        </Link>
      )}
      {showContact && (
        <Link href={`/${slug}/contact`} className="text-sm font-medium opacity-70 hover:opacity-100 transition-opacity tracking-wide" style={{ color: txt }}>
          Contact
        </Link>
      )}
      {type === "mega" && collections.length > 0 ? (
        <div className="relative" onMouseEnter={() => setMegaOuvert(true)} onMouseLeave={() => setMegaOuvert(false)}>
          <button className="flex items-center gap-1 text-sm font-medium opacity-70 hover:opacity-100 transition-opacity tracking-wide" style={{ color: txt }}>
            Collections <ChevronDown size={13} />
          </button>
          <div
            className="absolute left-1/2 -translate-x-1/2 top-full pt-3 transition-all duration-200"
            style={{ opacity: megaOuvert ? 1 : 0, pointerEvents: megaOuvert ? "auto" : "none", transform: megaOuvert ? "translate(-50%,0)" : "translate(-50%,-8px)" }}
          >
            <div className="grid grid-cols-2 gap-1 p-3 rounded-2xl min-w-[280px]" style={{ backgroundColor: fond, border: `1px solid ${accent}20`, boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }}>
              {collections.map((col) => (
                <Link key={col.slug} href={`/${slug}/collections/${col.slug}`} className="px-3 py-2 rounded-xl text-sm hover:opacity-70 transition-opacity" style={{ color: texte }}>
                  {col.nom}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : (
        collectionLinks.map((col) => (
          <Link key={col.slug} href={`/${slug}/collections/${col.slug}`} className="text-sm font-medium opacity-70 hover:opacity-100 transition-opacity tracking-wide" style={{ color: txt }}>
            {col.nom}
          </Link>
        ))
      )}
    </div>
  );

  const actionsNode = (
    <div className="flex items-center gap-2 flex-shrink-0">
      {showSearch && !minimal && (
        <div className="hidden sm:flex items-center relative" ref={searchBoxRef}>
          {rechercheOuverte ? (
            <form action={`/${slug}/produits`} method="GET" className="flex items-center">
              <input
                ref={searchRef}
                name="q"
                value={query}
                onChange={e => onQueryChange(e.target.value, "desktop")}
                onFocus={() => { if (resultats.length) setDropdownOuvert(true); }}
                placeholder="Rechercher…"
                autoComplete="off"
                className="w-40 px-3 py-1.5 text-sm rounded-lg outline-none"
                style={{ backgroundColor: `${accent}12`, color: txt, border: `1px solid ${accent}25` }}
              />
              {dropdownOuvert && resultats.length > 0 && (
                <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl overflow-hidden z-50" style={{ backgroundColor: fond, border: `1px solid ${accent}20`, boxShadow: "0 20px 50px rgba(0,0,0,0.18)" }}>
                  {resultats.map(p => (
                    <Link key={p.id} href={`/${slug}/produits/${p.id}`} onClick={() => setDropdownOuvert(false)}
                      className="flex items-center gap-3 px-3 py-2.5 hover:opacity-80 transition-opacity" style={{ borderBottom: `1px solid ${accent}10` }}>
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ backgroundColor: `${accent}12` }}>
                        {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package size={14} style={{ color: accent }} /></div>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium truncate" style={{ color: texte }}>{p.nom}</p>
                        <p className="text-[11.5px] font-semibold" style={{ color: accent }}>{formatMontant(p.prix, devise)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </form>
          ) : (
            <button
              onClick={() => setRechercheOuverte(true)}
              className="flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:opacity-80"
              style={{ backgroundColor: `${accent}12`, color: txt }}
              aria-label="Rechercher"
            >
              <Search size={16} />
            </button>
          )}
        </div>
      )}

      {showWishlist && (
        <Link
          href={`/${slug}/wishlist`}
          className="relative flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:opacity-80"
          style={{ backgroundColor: `${accent}12`, color: txt }}
          aria-label="Liste de souhaits"
        >
          <Heart size={16} />
          {wishlistCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold" style={{ backgroundColor: accent, color: fond }}>
              {wishlistCount > 9 ? "9+" : wishlistCount}
            </span>
          )}
        </Link>
      )}

      <Link
        href={`/${slug}/panier`}
        className="relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
        style={{ backgroundColor: accent, color: fond, borderRadius: radius }}
      >
        <ShoppingBag size={16} />
        <span className="hidden sm:inline">Panier</span>
        {totalItems > 0 && (
          <span className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold" style={{ backgroundColor: fond, color: accent }}>
            {totalItems > 99 ? "99+" : totalItems}
          </span>
        )}
      </Link>

      <button
        onClick={() => setMenuOuvert(!menuOuvert)}
        className={`${minimal ? "flex" : "md:hidden flex"} items-center justify-center w-10 h-10 rounded-xl transition-all`}
        style={{ backgroundColor: `${accent}15`, color: txt }}
        aria-label="Menu"
      >
        {menuOuvert ? <X size={18} /> : <Menu size={18} />}
      </button>
    </div>
  );

  const mobileMenu = (
    <div
      className={`overflow-hidden transition-all duration-300 ${minimal ? "" : "md:hidden"} ${menuOuvert ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"}`}
      style={{ borderTop: menuOuvert ? `1px solid ${accent}20` : "none", backgroundColor: fond }}
    >
      <div className="px-4 py-4 space-y-1">
        {showSearch && (
          <div className="pb-2 relative" ref={mobileSearchBoxRef}>
            <form action={`/${slug}/produits`} method="GET">
              <input
                name="q"
                value={mobileQuery}
                onChange={e => onQueryChange(e.target.value, "mobile")}
                placeholder="Rechercher un produit…"
                autoComplete="off"
                className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
                style={{ backgroundColor: `${accent}0f`, color: texte, border: `1px solid ${accent}20` }}
              />
            </form>
            {mobileResultats.length > 0 && (
              <div className="mt-1.5 rounded-xl overflow-hidden" style={{ backgroundColor: fond, border: `1px solid ${accent}20` }}>
                {mobileResultats.map(p => (
                  <Link key={p.id} href={`/${slug}/produits/${p.id}`} onClick={() => { setMenuOuvert(false); setMobileQuery(""); setMobileResultats([]); }}
                    className="flex items-center gap-3 px-3 py-2.5 hover:opacity-80 transition-opacity" style={{ borderBottom: `1px solid ${accent}10` }}>
                    <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0" style={{ backgroundColor: `${accent}12` }}>
                      {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package size={13} style={{ color: accent }} /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium truncate" style={{ color: texte }}>{p.nom}</p>
                      <p className="text-[11px] font-semibold" style={{ color: accent }}>{formatMontant(p.prix, devise)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
        <Link href={`/${slug}/produits`} onClick={() => setMenuOuvert(false)} className="block px-3 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80" style={{ color: texte }}>
          Tous les produits
        </Link>
        {showAbout && (
          <Link href={`/${slug}/a-propos`} onClick={() => setMenuOuvert(false)} className="block px-3 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80" style={{ color: texte }}>
            À propos
          </Link>
        )}
        {showContact && (
          <Link href={`/${slug}/contact`} onClick={() => setMenuOuvert(false)} className="block px-3 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80" style={{ color: texte }}>
            Contact
          </Link>
        )}
        {showWishlist && (
          <Link href={`/${slug}/wishlist`} onClick={() => setMenuOuvert(false)} className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80" style={{ color: texte }}>
            <Heart size={14} /> Liste de souhaits {wishlistCount > 0 && `(${wishlistCount})`}
          </Link>
        )}
        {collections.map((col) => (
          <Link key={col.slug} href={`/${slug}/collections/${col.slug}`} onClick={() => setMenuOuvert(false)} className="block px-3 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80" style={{ color: texte }}>
            {col.nom}
          </Link>
        ))}
        <div className="pt-2">
          <Link
            href={`/${slug}/panier`}
            onClick={() => setMenuOuvert(false)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold w-full justify-center"
            style={{ backgroundColor: accent, color: fond }}
          >
            <ShoppingBag size={16} />
            Voir mon panier{totalItems > 0 && ` (${totalItems})`}
          </Link>
        </div>
      </div>
    </div>
  );

  if (type === "centered") {
    return (
      <nav className={outerClass}>
        <div style={barBase} className={barClass}>
          <div className="hidden md:flex flex-1">{linksNode}</div>
          <div className="flex md:hidden">{logoNode}</div>
          <div className="hidden md:flex flex-1 justify-center">{logoNode}</div>
          <div className="flex flex-1 justify-end">{actionsNode}</div>
        </div>
        {mobileMenu}
      </nav>
    );
  }

  return (
    <nav className={outerClass}>
      <div style={barBase} className={barClass}>
        {logoNode}
        {!minimal && <div className="flex-1 flex justify-center">{linksNode}</div>}
        {actionsNode}
      </div>
      {mobileMenu}
    </nav>
  );
}
