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

/** Liste native des pays africains, posée invisible sur une pastille : le choix est gardé un an (cookie lu par lib/devise-visiteur.ts). */
export function SelecteurPays({ pays }: { pays: string | null }) {
  // Rechargement complet : les prix des designs sont rendus côté serveur dans leur HTML figé (router.refresh ne les réaffiche pas).
  return (
    <select aria-label="Pays et devise d'affichage" value={pays ?? ""} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      onChange={(e) => { document.cookie = `axso_pays=${e.target.value}; path=/; max-age=31536000; SameSite=Lax`; window.location.reload(); }}>
      {!pays && <option value="" disabled>Votre pays…</option>}
      {pays && !PAYS_OPTIONS.some((p) => p.code === pays) && <option value={pays}>{pays}</option>}
      {PAYS_OPTIONS.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
    </select>
  );
}

/** Code pays ISO → drapeau emoji. */
export function drapeau(code: string | null | undefined) {
  return code && /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "";
}

/** Pastille « 🇳🇬 NGN ▾ » : pays et devise du visiteur, modifiables. Rien hors vitrine. */
export function PastillePays({ couleur, className = "" }: { couleur?: string; className?: string }) {
  const v = useVisiteur();
  if (!v) return null;
  return (
    <span className={`relative inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full border whitespace-nowrap flex-shrink-0 ${className}`}
      style={{ color: couleur ?? "currentColor", borderColor: "color-mix(in srgb, currentColor 22%, transparent)" }}>
      {drapeau(v.pays) ? <span aria-hidden>{drapeau(v.pays)}</span> : <Globe2 size={13} aria-hidden />}
      <span>{v.devise}</span>
      <ChevronDown size={12} aria-hidden className="opacity-60" />
      <SelecteurPays pays={v.pays} />
    </span>
  );
}

/** Designs AXSO : l'en-tête est du HTML figé — la pastille y est insérée juste avant le panier (comme le cœur Favoris). */
export function PastillePaysDesign() {
  const chemin = usePathname();
  const [hote, setHote] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-axs-embed-html] header");
    if (!header) { setHote(null); return; }
    const avant = header.querySelector<HTMLElement>('[data-axs-favoris], a[href$="/panier"]');
    const span = document.createElement("span");
    span.setAttribute("data-axs-pays", "");
    span.style.display = "inline-flex";
    if (avant?.parentElement) avant.parentElement.insertBefore(span, avant); else header.lastElementChild?.appendChild(span);
    setHote(span);
    return () => span.remove();
  }, [chemin]);
  return hote ? createPortal(<PastillePays />, hote) : null;
}
