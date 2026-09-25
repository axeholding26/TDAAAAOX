"use client";

import { useEffect, useRef, useState } from "react";
import { Home, LayoutGrid, ShoppingBag, ShoppingCart, CreditCard, Info, Phone, ChevronDown, Check, type LucideIcon } from "lucide-react";
import { PAGES, type PageEditee } from "./pages";

const DETAILS: Record<PageEditee, { Icon: LucideIcon; desc: string }> = {
  accueil:   { Icon: Home,         desc: "Sections, en-tête et pied de page" },
  catalogue: { Icon: LayoutGrid,   desc: "Liste de tous les produits" },
  produit:   { Icon: ShoppingBag,  desc: "Modèle commun à toutes les fiches" },
  panier:    { Icon: ShoppingCart, desc: "Articles, code promo, total" },
  commande:  { Icon: CreditCard,   desc: "Formulaire et paiement" },
  apropos:   { Icon: Info,         desc: "Histoire et valeurs de la boutique" },
  contact:   { Icon: Phone,        desc: "Coordonnées et formulaire" },
};

// Sélecteur de la page à modifier (barre du haut des deux Constructeurs),
// sur le modèle de l'éditeur Shopify : bouton compact, liste avec icône et
// description. Clavier : Entrée/Espace ouvre, flèches naviguent, Échap ferme.
export function SelecteurPage({ page, onChange, labelAccueil }: { page: PageEditee; onChange: (p: PageEditee) => void; labelAccueil?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [focus, setFocus] = useState(0);
  const racine = useRef<HTMLDivElement>(null);
  const label = (id: PageEditee) => (id === "accueil" && labelAccueil) || PAGES.find((p) => p.id === id)!.label;
  const Actuelle = DETAILS[page].Icon;

  useEffect(() => {
    if (!ouvert) return;
    setFocus(PAGES.findIndex((p) => p.id === page));
    const dehors = (e: MouseEvent) => { if (!racine.current?.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert, page]);

  const choisir = (id: PageEditee) => { onChange(id); setOuvert(false); };
  const clavier = (e: React.KeyboardEvent) => {
    if (!ouvert) { if (["Enter", " ", "ArrowDown"].includes(e.key)) { e.preventDefault(); setOuvert(true); } return; }
    if (e.key === "Escape") { e.preventDefault(); setOuvert(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setFocus((f) => (f + 1) % PAGES.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocus((f) => (f - 1 + PAGES.length) % PAGES.length); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choisir(PAGES[focus].id); }
  };

  return (
    <div ref={racine} className="relative" onKeyDown={clavier}>
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-haspopup="listbox" aria-expanded={ouvert} aria-label="Page à modifier"
        className={`h-9 flex items-center gap-2 pl-2.5 pr-2 rounded-lg text-[14px] font-medium transition-colors ${ouvert ? "bg-[#F3F3F3] text-[#111111]" : "text-[#333333] hover:bg-[#F5F5F5]"}`}>
        <Actuelle size={16} className="text-[#777777] flex-shrink-0" />
        <span className="truncate max-w-[160px]">{label(page)}</span>
        <ChevronDown size={15} className={`text-[#999999] transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <ul role="listbox" aria-label="Pages de la boutique"
          className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] z-50 w-[280px] p-1.5 bg-white rounded-xl border border-[#E5E5E5] shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
          {PAGES.map((p, i) => {
            const { Icon, desc } = DETAILS[p.id];
            const actif = p.id === page;
            return (
              <li key={p.id} role="option" aria-selected={actif}>
                <button type="button" onClick={() => choisir(p.id)} onMouseEnter={() => setFocus(i)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${focus === i ? "bg-[#F5F5F5]" : ""}`}>
                  <span className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center ${actif ? "bg-[#FFF1D6] text-[#C77C0A]" : "bg-[#F5F5F5] text-[#666666]"}`}><Icon size={16} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-medium text-[#111111]">{label(p.id)}</span>
                    <span className="block text-[12px] text-[#888888] truncate">{desc}</span>
                  </span>
                  {actif && <Check size={15} className="text-[#C77C0A] flex-shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
