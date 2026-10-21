"use client";

import { useEffect, useRef, useState } from "react";
import { Home, LayoutGrid, ShoppingBag, CreditCard, Info, Phone, ChevronDown, Check, FileText, type LucideIcon } from "lucide-react";
import { PAGES, type PageEditee, type PageFixe } from "./pages";
import { useT } from "@/components/I18nProvider";

const DETAILS: Record<PageFixe, { Icon: LucideIcon; desc: string }> = {
  accueil:   { Icon: Home,         desc: "Sections, en-tête et pied de page" },
  catalogue: { Icon: LayoutGrid,   desc: "Liste de tous les produits" },
  produit:   { Icon: ShoppingBag,  desc: "Modèle commun à toutes les fiches" },
  commande:  { Icon: CreditCard,   desc: "Formulaire et paiement" },
  apropos:   { Icon: Info,         desc: "Histoire et valeurs de la boutique" },
  contact:   { Icon: Phone,        desc: "Coordonnées et formulaire" },
};

// Sélecteur de la page à modifier (barre du haut des deux Constructeurs),
// sur le modèle de l'éditeur Shopify : bouton compact, liste avec icône et
// description. Clavier : Entrée/Espace ouvre, flèches naviguent, Échap ferme.
// Pages libres (pages importées…) : listées après les pages fixes.
export function SelecteurPage({ page, onChange, labelAccueil, pagesLibres = [] }: { page: PageEditee; onChange: (p: PageEditee) => void; labelAccueil?: string; pagesLibres?: { cle: string; nom: string }[] }) {
  const t = useT();
  const [ouvert, setOuvert] = useState(false);
  const [focus, setFocus] = useState(0);
  const racine = useRef<HTMLDivElement>(null);
  const liste: { id: PageEditee; label: string; Icon: LucideIcon; desc: string }[] = [
    ...PAGES.map((p) => ({ id: p.id as PageEditee, label: (p.id === "accueil" && labelAccueil) || p.label, ...DETAILS[p.id] })),
    ...pagesLibres.map((p) => ({ id: `p:${p.cle}` as PageEditee, label: p.nom, Icon: FileText, desc: `/p/${p.cle}` })),
  ];
  const actuelle = liste.find((p) => p.id === page) ?? liste[0];
  const Actuelle = actuelle.Icon;

  useEffect(() => {
    if (!ouvert) return;
    setFocus(Math.max(0, liste.findIndex((p) => p.id === page)));
    const dehors = (e: MouseEvent) => { if (!racine.current?.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, [ouvert, page]);

  const choisir = (id: PageEditee) => { onChange(id); setOuvert(false); };
  const clavier = (e: React.KeyboardEvent) => {
    if (!ouvert) { if (["Enter", " ", "ArrowDown"].includes(e.key)) { e.preventDefault(); setOuvert(true); } return; }
    if (e.key === "Escape") { e.preventDefault(); setOuvert(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setFocus((f) => (f + 1) % liste.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocus((f) => (f - 1 + liste.length) % liste.length); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choisir(liste[focus].id); }
  };

  return (
    <div ref={racine} className="relative" onKeyDown={clavier}>
      <button type="button" onClick={() => setOuvert((o) => !o)} aria-haspopup="listbox" aria-expanded={ouvert} aria-label={t("Page à modifier")}
        className={`h-9 flex items-center gap-2 pl-2.5 pr-2 rounded-lg text-[14px] font-medium transition-colors ${ouvert ? "bg-[#F3F3F3] text-[#111111]" : "text-[#333333] hover:bg-[#F5F5F5]"}`}>
        <Actuelle size={16} className="text-[#777777] flex-shrink-0" />
        <span className="truncate max-w-[160px]">{t(actuelle.label)}</span>
        <ChevronDown size={15} className={`text-[#999999] transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <ul role="listbox" aria-label={t("Pages de la boutique")}
          className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] z-50 w-[280px] max-h-[70vh] overflow-y-auto p-1.5 bg-white rounded-xl border border-[#E5E5E5] shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
          {liste.map((p, i) => {
            const { Icon, desc } = p;
            const actif = p.id === page;
            return (
              <li key={p.id} role="option" aria-selected={actif}>
                <button type="button" onClick={() => choisir(p.id)} onMouseEnter={() => setFocus(i)}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors ${focus === i ? "bg-[#F5F5F5]" : ""}`}>
                  <span className={`w-8 h-8 flex-shrink-0 rounded-lg flex items-center justify-center ${actif ? "bg-[#FFF1D6] text-[#C77C0A]" : "bg-[#F5F5F5] text-[#666666]"}`}><Icon size={16} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-medium text-[#111111] truncate">{t(p.label)}</span>
                    <span className="block text-[12px] text-[#888888] truncate">{t(desc)}</span>
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
