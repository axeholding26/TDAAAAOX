"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWishlistStore } from "@/store/wishlistStore";
import { StyleCss } from "./StyleCss";

// Réglages « Boutons et navigation » qui demandent un comportement, appliqués
// aux designs AXSO importés (le CSS seul est dans lib/reglages-design.ts) :
//  - Favoris : cœur sur chaque carte produit + lien « favoris » avec compteur
//    dans l'en-tête ;
//  - Mega menu : panneau des collections au survol du lien « Collection » ;
//  - Transparente → opaque : en-tête transparent sur la bannière de l'accueil,
//    coloré dès qu'on fait défiler.
// Monté par le layout de la vitrine ; n'agit qu'après l'hydratation, et
// seulement dans les blocs du design ([data-axs-embed-html]).
const EMBED = "[data-axs-embed-html]";
const COEUR = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5c3.3 0 5.5 3.3 4.1 6.7C19.5 16.4 12 21 12 21z" fill="var(--axs-coeur-fond, none)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

interface Props {
  slug: string;
  type?: string; // navigationStyle.type
  favoris: boolean;
  fondEntete: string; // couleur de l'en-tête une fois la page défilée
  accent: string;
  texte: string;
  collections: { slug: string; nom: string; imageUrl: string | null }[];
}

const idProduit = (a: HTMLAnchorElement) => a.getAttribute("href")?.split("/produits/")[1]?.split(/[?#/]/)[0] || "";

export function NavigationDesign({ slug, type, favoris, fondEntete, accent, texte, collections }: Props) {
  const chemin = usePathname();
  const ids = useWishlistStore((s) => s.produitIds);
  const toggle = useWishlistStore((s) => s.toggle);
  const [mega, setMega] = useState<{ haut: number } | null>(null);
  const fermeture = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Favoris : cœurs sur les cartes, lien dans l'en-tête ──────────────────
  useEffect(() => {
    if (!favoris) return;
    document.querySelectorAll<HTMLAnchorElement>(`${EMBED} a[href*="/produits/"]`).forEach((carte) => {
      const id = idProduit(carte);
      if (!id || carte.querySelector("[data-axs-coeur]") || !(carte.querySelector("img, svg, [class*='media'], [class*='img']") || /card/i.test(carte.className))) return;
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-axs-coeur", id);
      b.setAttribute("aria-label", "Ajouter aux favoris");
      b.innerHTML = COEUR;
      carte.setAttribute("data-axs-coeur-carte", "");
      carte.appendChild(b);
    });
    const panier = document.querySelector<HTMLElement>(`${EMBED} header a[href$="/panier"]`);
    if (panier && !document.querySelector(`${EMBED} header [data-axs-favoris]`)) {
      const lien = document.createElement("a");
      lien.href = `/${slug}/wishlist`;
      lien.setAttribute("data-axs-favoris", "");
      lien.setAttribute("aria-label", "Mes favoris");
      lien.innerHTML = `${COEUR}<span data-axs-favoris-nb></span>`;
      panier.parentElement?.insertBefore(lien, panier);
    }
    const onClic = (e: MouseEvent) => {
      const b = (e.target as Element | null)?.closest?.("[data-axs-coeur]");
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      toggle(b.getAttribute("data-axs-coeur")!);
    };
    document.addEventListener("click", onClic, true);
    return () => document.removeEventListener("click", onClic, true);
  }, [favoris, chemin, slug, toggle]);

  // État des cœurs et compteur, à chaque changement de la liste.
  useEffect(() => {
    if (!favoris) return;
    document.querySelectorAll<HTMLElement>("[data-axs-coeur]").forEach((b) => {
      const actif = ids.includes(b.getAttribute("data-axs-coeur")!);
      b.setAttribute("aria-pressed", String(actif));
      b.setAttribute("aria-label", actif ? "Retirer des favoris" : "Ajouter aux favoris");
    });
    document.querySelectorAll<HTMLElement>("[data-axs-favoris-nb]").forEach((n) => { n.textContent = ids.length ? String(ids.length) : ""; });
  }, [favoris, ids, chemin]);

  // ── Mega menu : lien « Collection / Boutique / Catalogue » de l'en-tête ──
  useEffect(() => {
    if (type !== "mega" || !collections.length) return;
    const lien = [...document.querySelectorAll<HTMLAnchorElement>(`${EMBED} header nav a, ${EMBED} header a`)]
      .find((a) => /collection|boutique|catalogue|shop|produits/i.test(a.textContent || "") || /\/produits\/?$/.test(a.getAttribute("href") || ""));
    const entete = document.querySelector<HTMLElement>(`${EMBED} header`);
    if (!lien || !entete) return;
    const ouvrir = () => { clearTimeout(fermeture.current); setMega({ haut: entete.getBoundingClientRect().bottom }); };
    const fermer = () => { fermeture.current = setTimeout(() => setMega(null), 180); };
    lien.setAttribute("aria-haspopup", "true");
    lien.addEventListener("mouseenter", ouvrir);
    lien.addEventListener("mouseleave", fermer);
    return () => { lien.removeEventListener("mouseenter", ouvrir); lien.removeEventListener("mouseleave", fermer); setMega(null); };
  }, [type, collections.length, chemin]);

  // ── Transparente → opaque : seulement sur l'accueil (en-tête sur la bannière) ──
  useEffect(() => {
    if (type !== "transparent-scroll" || chemin !== `/${slug}`) return;
    const entete = document.querySelector<HTMLElement>(`${EMBED} header`);
    if (!entete) return;
    // Bloc le plus extérieur qui contient l'en-tête : c'est lui qui colle en haut et chevauche la bannière.
    let bloc: HTMLElement = entete;
    for (let el = entete.parentElement; el && el !== document.body; el = el.parentElement) if (el.matches("[data-axs-id], [data-axs-embed-html]")) bloc = el;
    const mesurer = () => bloc.style.setProperty("--axs-h", `${entete.offsetHeight}px`);
    const defiler = () => document.documentElement.toggleAttribute("data-axs-defile", window.scrollY > 20);
    bloc.setAttribute("data-axs-entete", "");
    mesurer(); defiler();
    window.addEventListener("resize", mesurer);
    window.addEventListener("scroll", defiler, { passive: true });
    return () => {
      bloc.removeAttribute("data-axs-entete");
      document.documentElement.removeAttribute("data-axs-defile");
      window.removeEventListener("resize", mesurer);
      window.removeEventListener("scroll", defiler);
    };
  }, [type, chemin, slug]);

  const css = [
    favoris && `[data-axs-coeur-carte]{position:relative}`
      + `[data-axs-coeur]{position:absolute;top:10px;right:10px;z-index:2;width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.92);color:${texte};border:0;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.12);transition:transform .15s}`
      + `[data-axs-coeur]:hover{transform:scale(1.1)}[data-axs-coeur][aria-pressed="true"]{color:${accent};--axs-coeur-fond:${accent}}`
      + `[data-axs-favoris]{display:inline-flex;align-items:center;gap:4px;color:inherit;text-decoration:none;margin-right:14px;position:relative}`
      + `[data-axs-favoris-nb]:not(:empty){min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:${accent};color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}`,
    type === "transparent-scroll" && `[data-axs-entete]{position:sticky!important;top:0;z-index:40;margin-bottom:calc(-1 * var(--axs-h,0px))}`
      + `[data-axs-entete] header{background:transparent!important;box-shadow:none!important;border-color:transparent!important;transition:background-color .3s,box-shadow .3s}`
      + `html[data-axs-defile] [data-axs-entete] header{background:${fondEntete}!important;box-shadow:0 6px 24px rgba(0,0,0,.08)!important}`,
  ].filter(Boolean).join("");

  return (
    <>
      {css && <StyleCss css={css} />}
      {mega && (
        <div role="menu" onMouseEnter={() => clearTimeout(fermeture.current)} onMouseLeave={() => { fermeture.current = setTimeout(() => setMega(null), 180); }}
          className="fixed left-0 right-0 z-[60] px-4" style={{ top: mega.haut }}>
          <div className="max-w-5xl mx-auto mt-2 rounded-2xl p-5 shadow-2xl border" style={{ background: fondEntete, color: texte, borderColor: `${accent}22` }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {collections.map((c) => (
                <Link key={c.slug} role="menuitem" href={`/${slug}/collections/${c.slug}`} onClick={() => setMega(null)}
                  className="group flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5">
                  <span className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center font-bold" style={{ background: `${accent}18`, color: accent }}>
                    {c.imageUrl ? <img src={c.imageUrl} alt="" className="w-full h-full object-cover" /> : c.nom.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-[14px] font-semibold leading-snug">{c.nom}</span>
                </Link>
              ))}
            </div>
            <Link href={`/${slug}/produits`} onClick={() => setMega(null)} className="mt-4 inline-block text-[13.5px] font-semibold underline underline-offset-4" style={{ color: accent }}>
              Voir tout le catalogue →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
