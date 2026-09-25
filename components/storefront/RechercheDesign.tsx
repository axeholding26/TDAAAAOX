"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { StyleCss } from "./StyleCss";
import { Search, X, Package, ArrowRight } from "lucide-react";
import { formatMontant } from "@/lib/utils";

// Recherche des designs AXSO importés : leur en-tête n'a qu'un lien texte
// « Recherche(r) » sans action. Monté une fois par le layout de la vitrine
// (comme PanierVitrine) : délégation de clic + icône loupe en CSS — le HTML
// du design n'est jamais modifié (React le compare à l'hydratation).
const SELECTEUR = "[data-axs-embed-html] a, [data-axs-embed-html] button";
const estLienRecherche = (el: Element) => !el.getAttribute("href") && /^\s*recherche(r)?\s*$/i.test(el.textContent || "");
const CSS_LIEN = () => `[data-axs-recherche]{cursor:pointer;display:inline-flex!important;align-items:center;gap:.4em}[data-axs-recherche]::before{content:"";width:1em;height:1em;flex-shrink:0;background:currentColor;-webkit-mask:${LOUPE} center/contain no-repeat;mask:${LOUPE} center/contain no-repeat}`;
const LOUPE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E")`;

interface Resultat { id: string; nom: string; prix: number; image: string | null }

export function RechercheDesign({ slug }: { slug: string }) {
  const [ouverte, setOuverte] = useState(false);
  const [q, setQ] = useState("");
  const [resultats, setResultats] = useState<Resultat[]>([]);
  const [devise, setDevise] = useState("XAF");
  const [chargement, setChargement] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const chemin = usePathname();

  // Liens « Recherche » du design, repérés à chaque page : curseur + icône loupe.
  useEffect(() => {
    document.querySelectorAll(SELECTEUR).forEach((el) => { if (estLienRecherche(el)) el.setAttribute("data-axs-recherche", ""); });
  }, [chemin]);

  // Un clic dessus ouvre la recherche.
  useEffect(() => {
    const onClic = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.(SELECTEUR);
      if (el && estLienRecherche(el)) { e.preventDefault(); setOuverte(true); }
    };
    document.addEventListener("click", onClic);
    return () => document.removeEventListener("click", onClic);
  }, []);

  useEffect(() => {
    if (!ouverte) return;
    champ.current?.focus();
    const onTouche = (e: KeyboardEvent) => { if (e.key === "Escape") setOuverte(false); };
    document.addEventListener("keydown", onTouche);
    return () => document.removeEventListener("keydown", onTouche);
  }, [ouverte]);

  // Suggestions en direct (même API que la barre de recherche des autres modèles).
  useEffect(() => {
    const terme = q.trim();
    if (!terme) { setResultats([]); return; }
    setChargement(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/storefront/${slug}/recherche?q=${encodeURIComponent(terme)}`).then((x) => x.json());
        setResultats(r.produits ?? []);
        if (r.devise) setDevise(r.devise);
      } catch { setResultats([]); } finally { setChargement(false); }
    }, 220);
    return () => clearTimeout(t);
  }, [q, slug]);

  const voirTout = () => { if (q.trim()) { setOuverte(false); router.push(`/${slug}/produits?q=${encodeURIComponent(q.trim())}`); } };

  return (
    <>
      <StyleCss css={CSS_LIEN()} />
      {ouverte && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center px-4 pt-[12vh]" style={{ background: "rgba(10,10,10,0.55)", backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOuverte(false); }}>
          <div role="dialog" aria-modal="true" aria-label="Rechercher un produit" className="w-full max-w-xl rounded-2xl overflow-hidden bg-white text-[#111111] shadow-2xl"
            style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
            <form onSubmit={(e) => { e.preventDefault(); voirTout(); }} className="flex items-center gap-3 px-5 h-16 border-b border-[#EEEEEE]">
              <Search size={20} className="text-[#999999] flex-shrink-0" />
              <input ref={champ} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit…" autoComplete="off"
                className="flex-1 min-w-0 h-full bg-transparent outline-none text-[16px] placeholder:text-[#AAAAAA]" />
              {q && <button type="button" onClick={() => setQ("")} aria-label="Effacer" className="w-8 h-8 rounded-full flex items-center justify-center text-[#999999] hover:bg-[#F3F3F3]"><X size={16} /></button>}
              <kbd className="hidden sm:inline text-[11px] text-[#999999] border border-[#E5E5E5] rounded-md px-1.5 py-0.5">Échap</kbd>
            </form>
            <div className="max-h-[55vh] overflow-y-auto">
              {!q.trim() && <p className="px-5 py-8 text-center text-[14px] text-[#888888]">Tape le nom d'un produit, une catégorie…</p>}
              {q.trim() && !chargement && !resultats.length && <p className="px-5 py-8 text-center text-[14px] text-[#888888]">Aucun produit pour « {q.trim()} »</p>}
              {resultats.map((p) => (
                <Link key={p.id} href={`/${slug}/produits/${p.id}`} onClick={() => setOuverte(false)}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-[#F7F7F7] transition-colors">
                  <span className="w-12 h-12 rounded-xl overflow-hidden bg-[#F3F3F3] flex items-center justify-center flex-shrink-0">
                    {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <Package size={18} className="text-[#BBBBBB]" />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14.5px] font-medium truncate">{p.nom}</span>
                    <span className="block text-[13px] font-semibold text-[#666666]">{formatMontant(p.prix, devise)}</span>
                  </span>
                </Link>
              ))}
            </div>
            {q.trim() && (
              <button onClick={voirTout} className="w-full flex items-center justify-center gap-2 h-12 border-t border-[#EEEEEE] text-[14px] font-semibold hover:bg-[#F7F7F7]">
                Voir tous les résultats <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
