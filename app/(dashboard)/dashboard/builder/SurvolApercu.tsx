"use client";

import { useRef, type RefObject } from "react";

// Cadre pointillé qui suit l'élément sélectionnable sous la souris dans un
// aperçu de Constructeur — dessiné par-dessus (jamais une classe/attribut posé
// sur l'élément : rien ne doit finir enregistré dans le HTML de la boutique).
// `racine` doit être positionnée (relative) et ne pas être elle-même l'élément
// qui défile.
// Positionné directement dans le DOM, sans état React : un setState à chaque
// mousemove re-rendait tout l'aperçu (~60 ms par mouvement → cadre saccadé).
export function useSurvol(racine: RefObject<HTMLElement | null>, trouver: (t: EventTarget | null) => { el: HTMLElement; label: string } | null) {
  const cadre = useRef<HTMLDivElement>(null);
  const cacher = () => { if (cadre.current) cadre.current.style.display = "none"; };
  const suivre = (e: React.MouseEvent) => {
    const r = racine.current, c = cadre.current;
    const cible = r && c ? trouver(e.target) : null;
    if (!r || !c || !cible) return cacher();
    const a = cible.el.getBoundingClientRect(), b = r.getBoundingClientRect();
    Object.assign(c.style, { display: "block", top: `${a.top - b.top}px`, left: `${a.left - b.left}px`, width: `${a.width}px`, height: `${a.height}px` });
    c.firstElementChild!.textContent = cible.label;
  };
  const survol = (
    <div ref={cadre} aria-hidden className="pointer-events-none absolute z-30 rounded-[2px]"
      style={{ display: "none", outline: "1.5px dashed #F5A623", outlineOffset: 1 }}>
      <span className="absolute -top-6 left-0 whitespace-nowrap px-1.5 py-0.5 rounded text-[11.5px] font-semibold bg-[#111111] text-white"
        style={{ fontFamily: "'Poppins',system-ui,sans-serif" }} />
    </div>
  );
  return { survol, onMouseMove: suivre, onMouseLeave: cacher };
}

/** Règle CSS qui encadre l'élément sélectionné (tous ses exemplaires : ex. toutes les cartes produit). */
export function cssSelection(id: string | null): string {
  return id ? `[data-axs-el="${id.replace(/"/g, "")}"]{outline:2px solid #F5A623 !important;outline-offset:2px !important;}` : "";
}
