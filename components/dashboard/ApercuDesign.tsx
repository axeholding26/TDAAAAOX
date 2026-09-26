"use client";

import { useEffect, useRef, useState } from "react";

// Vrai aperçu d'un design AXSO (page rendue par /api/preview-theme, avec les
// produits de la boutique), réduit pour tenir dans sa carte quelle que soit
// sa largeur.
const LARGEUR = 1280;

export function ApercuDesign({ fichier, fond, params = "", className = "h-48" }: { fichier: string; fond?: string; params?: string; className?: string }) {
  const boite = useRef<HTMLDivElement>(null);
  const [taille, setTaille] = useState<{ l: number; h: number } | null>(null);
  useEffect(() => {
    const el = boite.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTaille({ l: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const echelle = taille ? taille.l / LARGEUR : 0;
  return (
    <div ref={boite} className={`relative overflow-hidden ${className}`} style={{ background: fond || "#F5F5F5" }}>
      {echelle > 0 && (
        <iframe
          src={`/api/preview-theme?fichier=${encodeURIComponent(fichier)}${params}`}
          title="Aperçu du design"
          loading="lazy"
          sandbox="allow-same-origin allow-scripts"
          scrolling="no"
          tabIndex={-1}
          className="absolute top-0 left-0 border-0 pointer-events-none origin-top-left"
          style={{ width: LARGEUR, height: taille!.h / echelle, transform: `scale(${echelle})` }}
        />
      )}
    </div>
  );
}

/** Paramètres d'aperçu : nom, devise et produits réels de la boutique. */
export function parametresApercu(tenant: { nomBoutique?: string; devise?: string } | null, produits: { nom: string; prix: number; description?: string }[]) {
  return `&nom=${encodeURIComponent(tenant?.nomBoutique || "Ma Boutique")}&devise=${encodeURIComponent(tenant?.devise || "XAF")}&produits=${encodeURIComponent(JSON.stringify(produits))}`;
}

/** Fichier du design d'un Theme provisionné (« axso-design-<fichier>-<horodatage> »), sinon null. */
export function fichierDuTheme(slug?: string | null): string | null {
  const m = typeof slug === "string" ? slug.match(/^axso-design-(.+)-\d+$/) : null;
  return m ? `${m[1]}.html` : null;
}

/** Message de confirmation avant de remplacer le design actif. */
export const CONFIRMER_CHANGEMENT = (nom: string) =>
  `Activer « ${nom} » ?\n\nTa page d'accueil sera remplacée par ce design : les modifications faites sur ton design actuel (textes, images, styles, réglages) seront perdues.\n\nTes produits, ta fiche produit et tes pages À propos / Contact sont conservés.`;
