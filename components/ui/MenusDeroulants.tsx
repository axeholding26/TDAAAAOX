"use client";
// Liste ouverte des menus déroulants (<select>) de l'espace marchand, livreur et admin : la liste du
// système (Firefox, Safari, anciens Chrome) remplacée par une liste AXSO, la même partout. Le <select>
// reste la source de vérité : la valeur y est posée et un vrai événement « change » est émis, donc
// aucun des menus existants n'a à changer. Écrans tactiles : la liste native du téléphone est gardée.
// Un menu peut garder la liste native avec data-natif.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";

interface Choix { valeur: string; texte: string; inactif: boolean; groupe: string | null; index: number }
interface Ouvert { select: HTMLSelectElement; choix: Choix[]; haut: number; gauche: number; largeur: number; hauteurMax: number; versLeHaut: boolean }

const ESPACE = 6, HAUTEUR_MAX = 320;

function cible(el: EventTarget | null): HTMLSelectElement | null {
  if (!(el instanceof HTMLSelectElement) || el.multiple || el.size > 1 || el.disabled || el.hasAttribute("data-natif")) return null;
  return window.matchMedia("(pointer: fine)").matches ? el : null;
}

function placer(select: HTMLSelectElement): Omit<Ouvert, "choix"> {
  const r = select.getBoundingClientRect();
  const dessous = window.innerHeight - r.bottom - ESPACE * 2, dessus = r.top - ESPACE * 2;
  const versLeHaut = dessous < 180 && dessus > dessous;
  const largeur = Math.max(r.width, 180);
  return {
    select, versLeHaut, largeur,
    gauche: Math.min(Math.max(8, r.left), window.innerWidth - largeur - 8),
    haut: versLeHaut ? r.top - ESPACE : r.bottom + ESPACE,
    hauteurMax: Math.min(HAUTEUR_MAX, versLeHaut ? dessus : dessous),
  };
}

export function MenusDeroulants() {
  const [ouvert, setOuvert] = useState<Ouvert | null>(null);
  const [actif, setActif] = useState(-1);
  const liste = useRef<HTMLDivElement>(null);
  const recherche = useRef({ texte: "", minuterie: 0 as unknown as ReturnType<typeof setTimeout> });

  const ouvrir = useCallback((select: HTMLSelectElement) => {
    const choix = [...select.options].map((o, index) => ({
      valeur: o.value, texte: o.text, inactif: o.disabled || !!(o.parentElement as HTMLOptGroupElement | null)?.disabled,
      groupe: o.parentElement instanceof HTMLOptGroupElement ? o.parentElement.label : null, index,
    }));
    setOuvert({ ...placer(select), choix });
    setActif(select.selectedIndex);
  }, []);

  const fermer = useCallback((rendreFocus = true) => {
    setOuvert((o) => { if (o && rendreFocus) o.select.focus({ preventScroll: true }); return null; });
  }, []);

  const choisir = useCallback((c: Choix) => {
    if (!ouvert || c.inactif) return;
    const { select } = ouvert;
    if (select.selectedIndex !== c.index) {
      select.selectedIndex = c.index;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    fermer();
  }, [ouvert, fermer]);

  // Ouverture : clic sur un menu, ou Espace / Entrée / Alt+↓ au clavier (les flèches seules changent la valeur, comme d'habitude).
  useEffect(() => {
    const souris = (e: MouseEvent) => {
      const s = cible(e.target);
      if (!s || e.button !== 0) return;
      e.preventDefault();
      s.focus({ preventScroll: true });
      setOuvert((o) => (o?.select === s ? null : o));
      if (ouvert?.select !== s) ouvrir(s);
    };
    const clavier = (e: KeyboardEvent) => {
      const s = cible(e.target);
      if (!s || ouvert) return;
      if (e.key === " " || e.key === "Enter" || (e.altKey && e.key === "ArrowDown") || e.key === "F4") { e.preventDefault(); ouvrir(s); }
    };
    // Chrome récent (appearance: base-select) ouvre sa propre liste au clic : bloquée aussi.
    const clic = (e: MouseEvent) => { if (cible(e.target)) e.preventDefault(); };
    document.addEventListener("mousedown", souris, true);
    document.addEventListener("click", clic, true);
    document.addEventListener("keydown", clavier, true);
    return () => {
      document.removeEventListener("mousedown", souris, true);
      document.removeEventListener("click", clic, true);
      document.removeEventListener("keydown", clavier, true);
    };
  }, [ouvert, ouvrir]);

  // Fermeture : clic ailleurs, défilement de la page, redimensionnement.
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => { if (!liste.current?.contains(e.target as Node) && e.target !== ouvert.select) fermer(false); };
    const defile = (e: Event) => { if (!liste.current?.contains(e.target as Node)) fermer(false); };
    const taille = () => fermer(false);
    document.addEventListener("mousedown", dehors);
    window.addEventListener("scroll", defile, true);
    window.addEventListener("resize", taille);
    return () => { document.removeEventListener("mousedown", dehors); window.removeEventListener("scroll", defile, true); window.removeEventListener("resize", taille); };
  }, [ouvert, fermer]);

  // Clavier dans la liste ouverte : flèches, Début/Fin, Entrée, Échap, Tab, saisie des premières lettres.
  useEffect(() => {
    if (!ouvert) return;
    const permis = ouvert.choix.filter((c) => !c.inactif).map((c) => c.index);
    const touche = (e: KeyboardEvent) => {
      const pos = permis.indexOf(actif);
      const aller = (i: number) => { e.preventDefault(); setActif(permis[Math.max(0, Math.min(permis.length - 1, i))] ?? -1); };
      if (e.key === "ArrowDown") aller(pos + 1);
      else if (e.key === "ArrowUp") aller(pos < 0 ? permis.length - 1 : pos - 1);
      else if (e.key === "Home") aller(0);
      else if (e.key === "End") aller(permis.length - 1);
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); const c = ouvert.choix[actif]; if (c) choisir(c); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(); }
      else if (e.key === "Tab") fermer(false);
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault(); // sinon le <select> fermé change de valeur en douce
        const r = recherche.current;
        clearTimeout(r.minuterie);
        r.texte += e.key.toLowerCase();
        r.minuterie = setTimeout(() => { r.texte = ""; }, 600);
        const trouve = ouvert.choix.find((c) => !c.inactif && c.texte.toLowerCase().startsWith(r.texte));
        if (trouve) setActif(trouve.index);
      }
    };
    document.addEventListener("keydown", touche, true);
    return () => document.removeEventListener("keydown", touche, true);
  }, [ouvert, actif, choisir, fermer]);

  // L'option active reste visible.
  useEffect(() => {
    liste.current?.querySelector(`[data-index="${actif}"]`)?.scrollIntoView({ block: "nearest" });
  }, [actif, ouvert]);

  if (!ouvert) return null;
  const choisie = ouvert.select.selectedIndex;
  return createPortal(
    <div ref={liste} role="listbox" aria-label={ouvert.select.getAttribute("aria-label") ?? undefined}
      className="ax-liste-deroulante" // style : app/globals.css
      style={{
        left: ouvert.gauche, width: ouvert.largeur, maxHeight: ouvert.hauteurMax,
        ...(ouvert.versLeHaut ? { bottom: window.innerHeight - ouvert.haut } : { top: ouvert.haut }),
      }}>
      {ouvert.choix.map((c, i) => (
        <div key={c.index}>
          {c.groupe && c.groupe !== ouvert.choix[i - 1]?.groupe && (
            <p className="ax-groupe">{c.groupe}</p>
          )}
          <div role="option" aria-selected={c.index === choisie} aria-disabled={c.inactif || undefined} data-index={c.index}
            onMouseEnter={() => !c.inactif && setActif(c.index)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choisir(c)}
            className={`ax-choix${c.index === actif && !c.inactif ? " actif" : ""}`}>
            <span>{c.texte || "\u00A0"}</span>
            {c.index === choisie && <Check size={15} />}
          </div>
        </div>
      ))}
    </div>,
    document.body,
  );
}
