"use client";

import { useState, type RefObject } from "react";

type Cadre = { top: number; left: number; width: number; height: number; label: string };

// Cadre pointillé qui suit l'élément sélectionnable sous la souris dans un
// aperçu de Constructeur — dessiné par-dessus (jamais une classe/attribut posé
// sur l'élément : rien ne doit finir enregistré dans le HTML de la boutique).
// `racine` doit être positionnée (relative) et ne pas être elle-même l'élément
// qui défile.
export function useSurvol(racine: RefObject<HTMLElement | null>, trouver: (t: EventTarget | null) => { el: HTMLElement; label: string } | null) {
  const [cadre, setCadre] = useState<Cadre | null>(null);
  const suivre = (e: React.MouseEvent) => {
    const r = racine.current;
    const cible = r ? trouver(e.target) : null;
    if (!r || !cible) { if (cadre) setCadre(null); return; }
    const a = cible.el.getBoundingClientRect(), b = r.getBoundingClientRect();
    setCadre({ top: a.top - b.top, left: a.left - b.left, width: a.width, height: a.height, label: cible.label });
  };
  const survol = cadre && (
    <div aria-hidden className="pointer-events-none absolute z-30 rounded-[2px]"
      style={{ top: cadre.top, left: cadre.left, width: cadre.width, height: cadre.height, outline: "1.5px dashed #F5A623", outlineOffset: 1 }}>
      <span className="absolute -top-6 left-0 whitespace-nowrap px-1.5 py-0.5 rounded text-[11.5px] font-semibold bg-[#111111] text-white"
        style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>{cadre.label}</span>
    </div>
  );
  return { survol, onMouseMove: suivre, onMouseLeave: () => setCadre(null) };
}

/** Règle CSS qui encadre l'élément sélectionné (tous ses exemplaires : ex. toutes les cartes produit). */
export function cssSelection(id: string | null): string {
  return id ? `[data-axs-el="${id.replace(/"/g, "")}"]{outline:2px solid #F5A623 !important;outline-offset:2px !important;}` : "";
}
