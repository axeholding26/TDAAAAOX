"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { PageEditee } from "./pages";

// Pages fonctionnelles (catalogue, panier, commande) : leur contenu vient de
// vraies données (produits, panier, formulaire de commande) et de réglages
// partagés ; le panneau dit où chaque élément se modifie, sans rien inventer.
const INFOS: Partial<Record<PageEditee, { titre: string; texte: string; liens: { label: string; href?: string; page?: PageEditee }[] }>> = {
  catalogue: {
    titre: "Catalogue",
    texte: "La liste de tes produits, dans le style de ton design. Son en-tête et son pied de page sont ceux de ta page d'accueil ; couleurs, polices et boutons suivent les Paramètres du thème.",
    liens: [{ label: "Modifier l'en-tête / le pied de page", page: "accueil" }, { label: "Gérer mes produits", href: "/dashboard/produits" }],
  },
  panier: {
    titre: "Panier",
    texte: "Le panier réel de tes clients (quantités, code promo, total dans ta devise), habillé de l'en-tête et du pied de page de ta boutique.",
    liens: [{ label: "Modifier l'en-tête / le pied de page", page: "accueil" }, { label: "Codes promo", href: "/dashboard/marketing/codes-promo" }],
  },
  commande: {
    titre: "Commande",
    texte: "Le formulaire de commande (paiement à la livraison, mobile money, WhatsApp). Les informations demandées à l'acheteur se règlent dans Paramètres › Formulaire de commande.",
    liens: [{ label: "Formulaire de commande", href: "/dashboard/parametres" }, { label: "Livraison", href: "/dashboard/boutique" }],
  },
};

export function PanneauPage({ page, onPage }: { page: PageEditee; onPage: (p: PageEditee) => void }) {
  const info = INFOS[page];
  if (!info) return null;
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <p className="text-[16px] font-semibold">{info.titre}</p>
      <p className="text-[14px] text-[#555555] leading-relaxed">{info.texte}</p>
      <div className="space-y-1.5">
        {info.liens.map((l) => l.href
          ? <Link key={l.label} href={l.href} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#E5E5E5] text-[14px] hover:bg-[#F5F5F5]">{l.label}<ArrowRight size={15} className="text-[#999999]" /></Link>
          : <button key={l.label} onClick={() => onPage(l.page!)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-[#E5E5E5] text-[14px] hover:bg-[#F5F5F5]">{l.label}<ArrowRight size={15} className="text-[#999999]" /></button>)}
      </div>
      <p className="text-[12.5px] text-[#999999] leading-relaxed">L'aperçu est la vraie page : tu peux y cliquer (produit, panier…) pour naviguer entre les pages.</p>
    </div>
  );
}
