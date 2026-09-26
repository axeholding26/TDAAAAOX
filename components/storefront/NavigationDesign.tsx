"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWishlistStore } from "@/store/wishlistStore";
import { StyleCss } from "./StyleCss";
import { SELECTEUR as LIENS_DESIGN, estLienRecherche, CSS_LIEN } from "./RechercheDesign";

// Réglages « Boutons et navigation » qui demandent un comportement, appliqués
// aux designs AXSO importés (le CSS pur est dans lib/reglages-design.ts) :
//  - Barre de recherche : le lien « Rechercher » du design est repéré (le
//    réglage peut ainsi le masquer, partout) ;
//  - Favoris : cœur sur chaque carte + lien « favoris » avec compteur ;
//  - Minimal : bouton menu qui ouvre les liens sous l'en-tête ;
//  - Mega menu : panneau des collections au survol du lien « Collection » ;
//  - Transparente → opaque : en-tête transparent sur la bannière de l'accueil.
// Deux modes : la boutique (vrais éléments ajoutés après l'hydratation) et
// l'aperçu du Constructeur (`apercu`) — là, AUCUN élément n'est ajouté au HTML
// du design, qui est enregistré tel quel : même rendu, obtenu en CSS.
const EMBED = "[data-axs-embed-html]";
const COEUR = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.3C1.1 8.3 3.3 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5c3.3 0 5.5 3.3 4.1 6.7C19.5 16.4 12 21 12 21z" fill="var(--axs-coeur-fond, none)" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const masque = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace('stroke="currentColor"', 'stroke="black"').replace("var(--axs-coeur-fond, none)", "none"))}")`;
const BURGER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

interface Props {
  slug: string;
  type?: string; // navigationStyle.type
  favoris: boolean;
  fondEntete: string; // couleur de l'en-tête une fois la page défilée / du panneau
  accent: string;
  texte: string;
  collections: { slug: string; nom: string; imageUrl: string | null }[];
  apercu?: { racine: () => HTMLElement | null }; // aperçu du Constructeur : conteneur qui défile
}

const idProduit = (a: HTMLAnchorElement) => a.getAttribute("href")?.split("/produits/")[1]?.split(/[?#/]/)[0] || "";
const estCarte = (a: HTMLAnchorElement) => !!idProduit(a) && (!!a.querySelector("img, svg, [class*='media'], [class*='img']") || /card/i.test(a.className));

export function NavigationDesign({ slug, type, favoris, fondEntete, accent, texte, collections, apercu }: Props) {
  const chemin = usePathname();
  const ids = useWishlistStore((s) => s.produitIds);
  const toggle = useWishlistStore((s) => s.toggle);
  const [mega, setMega] = useState<{ haut: number } | null>(null);
  const fermeture = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [version, setVersion] = useState(0); // aperçu : le HTML du design peut être remplacé (édition)

  // Aperçu : repérer à nouveau quand le HTML des sections change.
  useEffect(() => {
    if (!apercu) return;
    const racine = apercu.racine();
    if (!racine) return;
    const obs = new MutationObserver((ms) => { if (ms.some((m) => (m.target as Element).closest?.("[data-embed-noeud]"))) setVersion((v) => v + 1); });
    obs.observe(racine, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [apercu]);

  // ── Lien « Rechercher » du design : repéré partout (le réglage peut le masquer) ──
  useEffect(() => {
    document.querySelectorAll(LIENS_DESIGN).forEach((el) => { if (estLienRecherche(el) && !el.hasAttribute("data-axs-recherche")) el.setAttribute("data-axs-recherche", ""); });
  }, [chemin, version]);

  // ── Favoris (boutique) : cœurs sur les cartes, lien dans l'en-tête ──
  useEffect(() => {
    if (!favoris || apercu) return;
    document.querySelectorAll<HTMLAnchorElement>(`${EMBED} a[href*="/produits/"]`).forEach((carte) => {
      if (!estCarte(carte) || carte.querySelector("[data-axs-coeur]")) return;
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-axs-coeur", idProduit(carte));
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
  }, [favoris, apercu, chemin, slug, toggle]);

  useEffect(() => {
    if (!favoris || apercu) return;
    document.querySelectorAll<HTMLElement>("[data-axs-coeur]").forEach((b) => {
      const actif = ids.includes(b.getAttribute("data-axs-coeur")!);
      b.setAttribute("aria-pressed", String(actif));
      b.setAttribute("aria-label", actif ? "Retirer des favoris" : "Ajouter aux favoris");
    });
    document.querySelectorAll<HTMLElement>("[data-axs-favoris-nb]").forEach((n) => { n.textContent = ids.length ? String(ids.length) : ""; });
  }, [favoris, apercu, ids, chemin]);

  // ── Minimal (boutique) : bouton menu qui ouvre les liens sous l'en-tête ──
  useEffect(() => {
    if (type !== "minimal" || apercu) return;
    const entete = document.querySelector<HTMLElement>(`${EMBED} header`);
    if (!entete || entete.querySelector("[data-axs-burger]")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("data-axs-burger", "");
    b.setAttribute("aria-label", "Menu");
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", () => {
      const ouvert = entete.toggleAttribute("data-axs-menu-ouvert");
      b.setAttribute("aria-expanded", String(ouvert));
    });
    entete.appendChild(b);
  }, [type, apercu, chemin]);

  // ── Mega menu : lien « Collection / Catalogue » de l'en-tête ──
  useEffect(() => {
    if (type !== "mega" || !collections.length) return;
    const lien = [...document.querySelectorAll<HTMLAnchorElement>(`${EMBED} header nav a`)]
      .find((a) => /collection|boutique|catalogue|shop|produits/i.test(a.textContent || "") || /\/produits\/?$/.test(a.getAttribute("href") || ""));
    const entete = document.querySelector<HTMLElement>(`${EMBED} header`);
    if (!lien || !entete) return;
    const ouvrir = () => { clearTimeout(fermeture.current); setMega({ haut: entete.getBoundingClientRect().bottom }); };
    const fermer = () => { fermeture.current = setTimeout(() => setMega(null), 180); };
    if (!apercu) lien.setAttribute("aria-haspopup", "true");
    lien.addEventListener("mouseenter", ouvrir);
    lien.addEventListener("mouseleave", fermer);
    return () => { lien.removeEventListener("mouseenter", ouvrir); lien.removeEventListener("mouseleave", fermer); setMega(null); };
  }, [type, apercu, collections.length, chemin, version]);

  // ── Transparente → opaque : accueil seulement (en-tête posé sur la bannière) ──
  useEffect(() => {
    if (type !== "transparent-scroll" || (!apercu && chemin !== `/${slug}`)) return;
    const entete = document.querySelector<HTMLElement>(`${EMBED} header`);
    if (!entete) return;
    // Bloc le plus extérieur qui contient l'en-tête : c'est lui qui colle en haut et chevauche la bannière.
    let bloc: HTMLElement = entete;
    for (let el = entete.parentElement; el && el !== document.body; el = el.parentElement) {
      if (el.matches("[data-axs-id], [data-axs-embed-html], [data-apercu-id]")) bloc = el;
      if (el.matches("[data-apercu-page]")) break;
    }
    const defileur: HTMLElement | Window = apercu?.racine() ?? window;
    const position = () => (defileur instanceof Window ? defileur.scrollY : defileur.scrollTop);
    const mesurer = () => bloc.style.setProperty("--axs-h", `${entete.offsetHeight}px`);
    const defiler = () => bloc.toggleAttribute("data-axs-defile", position() > 20);
    bloc.setAttribute("data-axs-entete", "");
    mesurer(); defiler();
    window.addEventListener("resize", mesurer);
    defileur.addEventListener("scroll", defiler, { passive: true });
    return () => {
      bloc.removeAttribute("data-axs-entete"); bloc.removeAttribute("data-axs-defile"); bloc.style.removeProperty("--axs-h");
      window.removeEventListener("resize", mesurer);
      defileur.removeEventListener("scroll", defiler);
    };
  }, [type, apercu, chemin, slug, version]);

  const portee = apercu ? "[data-apercu-page] " : "";
  const css = [
    CSS_LIEN(),
    // Favoris — boutique : vrais boutons ; aperçu : même rendu en CSS (rien dans le HTML).
    favoris && !apercu && `[data-axs-coeur-carte]{position:relative}`
      + `[data-axs-coeur]{position:absolute;top:10px;right:10px;z-index:2;width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.92);color:${texte};border:0;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.12);transition:transform .15s}`
      + `[data-axs-coeur]:hover{transform:scale(1.1)}[data-axs-coeur][aria-pressed="true"]{color:${accent};--axs-coeur-fond:${accent}}`
      + `[data-axs-favoris]{display:inline-flex;align-items:center;gap:4px;color:inherit;text-decoration:none;margin-right:14px}`
      + `[data-axs-favoris-nb]:not(:empty){min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:${accent};color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center}`,
    favoris && apercu && `${portee}${EMBED} a[href*="/produits/"]:is([class*="card"],:has(img,svg,[class*="media"])){position:relative}`
      + `${portee}${EMBED} a[href*="/produits/"]:is([class*="card"],:has(img,svg,[class*="media"]))::after{content:"";position:absolute;top:10px;right:10px;width:36px;height:36px;border-radius:999px;background:rgba(255,255,255,.92) center/18px no-repeat;background-image:${masque(COEUR).replace("black", "%23111")};box-shadow:0 2px 10px rgba(0,0,0,.12);z-index:2}`
      + `${portee}${EMBED} header a[href$="/panier"]{position:relative;margin-left:34px}`
      + `${portee}${EMBED} header a[href$="/panier"]::before{content:"";position:absolute;right:calc(100% + 12px);top:50%;width:20px;height:20px;transform:translateY(-50%);background:currentColor;-webkit-mask:${masque(COEUR)} center/contain no-repeat;mask:${masque(COEUR)} center/contain no-repeat;color:${texte}}`,
    // Minimal : bouton menu.
    type === "minimal" && `[data-axs-burger]{width:40px;height:40px;border:0;background:transparent;color:inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;-webkit-mask:none}`
      + `[data-axs-burger]::before{content:"";width:22px;height:22px;background:currentColor;-webkit-mask:url("data:image/svg+xml,${encodeURIComponent(BURGER)}") center/contain no-repeat;mask:url("data:image/svg+xml,${encodeURIComponent(BURGER)}") center/contain no-repeat}`
      + (apercu ? `${portee}${EMBED} header::after{content:"";order:99;width:22px;height:22px;margin-left:16px;background:currentColor;-webkit-mask:url("data:image/svg+xml,${encodeURIComponent(BURGER)}") center/contain no-repeat;mask:url("data:image/svg+xml,${encodeURIComponent(BURGER)}") center/contain no-repeat}` : ""),
    // Transparente → opaque.
    type === "transparent-scroll" && `[data-axs-entete]{position:sticky!important;top:0;z-index:40;margin-bottom:calc(-1 * var(--axs-h,0px))}`
      + `[data-axs-entete] header{background:transparent!important;box-shadow:none!important;border-color:transparent!important;backdrop-filter:none!important;transition:background-color .3s,box-shadow .3s}`
      + `[data-axs-entete][data-axs-defile] header{background:${fondEntete}!important;box-shadow:0 6px 24px rgba(0,0,0,.08)!important}`,
  ].filter(Boolean).join("");

  return (
    <>
      <StyleCss css={css} />
      {mega && (
        <div role="menu" onMouseEnter={() => clearTimeout(fermeture.current)} onMouseLeave={() => { fermeture.current = setTimeout(() => setMega(null), 180); }}
          className="fixed left-0 right-0 z-[60] px-4" style={{ top: mega.haut }}>
          <div className="max-w-5xl mx-auto mt-2 rounded-2xl p-5 shadow-2xl border" style={{ background: fondEntete, color: texte, borderColor: `${accent}22` }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {collections.map((c) => (
                <Link key={c.slug} role="menuitem" href={`/${slug}/collections/${c.slug}`} onClick={(e) => { if (apercu) e.preventDefault(); setMega(null); }}
                  className="group flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5">
                  <span className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center font-bold" style={{ background: `${accent}18`, color: accent }}>
                    {c.imageUrl ? <img src={c.imageUrl} alt="" className="w-full h-full object-cover" /> : c.nom.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-[14px] font-semibold leading-snug">{c.nom}</span>
                </Link>
              ))}
            </div>
            <Link href={`/${slug}/produits`} onClick={(e) => { if (apercu) e.preventDefault(); setMega(null); }} className="mt-4 inline-block text-[13.5px] font-semibold underline underline-offset-4" style={{ color: accent }}>
              Voir tout le catalogue →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
