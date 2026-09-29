"use client";
// Prix de vente affichés dans la devise du visiteur (voir lib/devise-visiteur.ts).
// Les montants passés sont TOUJOURS dans la devise de la boutique ; hors
// vitrine (aperçus du dashboard), pas de fournisseur → aucune conversion.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Globe2, ChevronDown } from "lucide-react";
import { convertirMontant, PAYS_OPTIONS } from "@/lib/devise-convert";
import { formatMontant } from "@/lib/utils";
import { SelectPays, Drapeau } from "@/components/ui/SelectPays";
import { useT } from "@/components/I18nProvider";

// ratio = multiplicateur devise de la boutique → devise du visiteur, aux taux du jour (lib/taux-change.ts).
type Contexte = { devise: string; pays: string | null; deviseBoutique: string; ratio: number };
const Visiteur = createContext<Contexte | null>(null);

export function DeviseVitrineProvider({ children, ...valeur }: Contexte & { children: ReactNode }) {
  return <Visiteur.Provider value={valeur}>{children}</Visiteur.Provider>;
}

/** Pays et devise du visiteur (null hors vitrine). */
export const useVisiteur = () => useContext(Visiteur);

/** fmt(montant, deviseBoutique) → prix converti dans la devise du visiteur. */
export function usePrix() {
  const ctx = useContext(Visiteur);
  const visiteur = ctx?.devise ?? null;
  const fmt = (montant: number, deviseBoutique: string) => {
    if (!visiteur) return formatMontant(montant, deviseBoutique);
    const converti = deviseBoutique === ctx!.deviseBoutique ? Math.round(montant * ctx!.ratio) : convertirMontant(montant, deviseBoutique, visiteur);
    return formatMontant(converti, visiteur);
  };
  const converti = (deviseBoutique: string) => !!visiteur && visiteur !== deviseBoutique;
  /** Bouton « Payer » : le montant réellement débité, avec l'équivalent du visiteur. */
  const aPayer = (montant: number, deviseBoutique: string) =>
    formatMontant(montant, deviseBoutique) + (converti(deviseBoutique) ? ` (≈ ${fmt(montant, deviseBoutique)})` : "");
  return { fmt, converti, aPayer };
}

export function Prix({ montant, devise }: { montant: number; devise: string }) {
  return <>{usePrix().fmt(montant, devise)}</>;
}

/** Pastille « drapeau NGN ▾ » : pays et devise du visiteur, modifiables. Rien hors vitrine.
 *  Le choix est gardé un an (cookie lu par lib/devise-visiteur.ts). */
export function PastillePays({ couleur, className = "" }: { couleur?: string; className?: string }) {
  const t = useT();
  const v = useVisiteur();
  if (!v) return null;
  const options = v.pays && !PAYS_OPTIONS.some((p) => p.code === v.pays) ? [{ code: v.pays, nom: v.pays }, ...PAYS_OPTIONS] : PAYS_OPTIONS;
  return (
    // Rechargement complet : les prix des designs sont rendus côté serveur dans leur HTML figé (router.refresh ne les réaffiche pas).
    <SelectPays value={v.pays} options={options} ariaLabel="Pays et devise d'affichage"
      onChange={(code) => { document.cookie = `axso_pays=${code}; path=/; max-age=31536000; SameSite=Lax`; window.location.reload(); }}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold pl-1.5 pr-2.5 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 cursor-pointer transition-opacity hover:opacity-80 ${className}`}
      style={{ color: couleur ?? "currentColor", borderColor: "color-mix(in srgb, currentColor 22%, transparent)" }}>
      {v.pays ? <Drapeau code={v.pays} taille={18} /> : <Globe2 size={14} aria-hidden />}
      <span>{t(v.devise)}</span>
      <ChevronDown size={12} aria-hidden className="opacity-60" />
    </SelectPays>
  );
}

/** Designs AXSO : l'en-tête est du HTML figé — la pastille y est insérée juste avant le panier (comme le cœur Favoris). */
export function PastillePaysDesign() {
  const chemin = usePathname();
  const [hote, setHote] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-axs-embed-html] header");
    if (!header) { setHote(null); return; }
    const avant = header.querySelector<HTMLElement>('[data-axs-favoris], a[href$="/panier"], [data-axs-achats]');
    const span = document.createElement("span");
    span.setAttribute("data-axs-pays", "");
    span.style.display = "inline-flex";
    if (avant?.parentElement) avant.parentElement.insertBefore(span, avant); else header.lastElementChild?.appendChild(span);
    setHote(span);
    return () => span.remove();
  }, [chemin]);
  return hote ? createPortal(<PastillePays />, hote) : null;
}
