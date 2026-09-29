"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

// Filtres du catalogue des designs AXSO. Les pastilles sont reconstruites
// côté serveur avec les vraies catégories de la boutique
// (lib/vitrine-design.ts) ; ici, le comportement — AXSO n'exécute jamais le
// script d'origine du design. Délégation d'événements sur le document :
// aucun HTML du design n'est modifié avant l'hydratation, seulement au clic.
const CARTES = "[data-axs-embed-html] #plpGrid > [data-cat]";

const sansAccents = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function filtrer(garder: (carte: HTMLElement) => boolean) {
  let visibles = 0;
  document.querySelectorAll<HTMLElement>(CARTES).forEach((carte) => {
    const ok = garder(carte);
    carte.style.display = ok ? "" : "none";
    if (ok) visibles++;
  });
  document.querySelectorAll<HTMLElement>("[data-axs-embed-html] #plpCount").forEach((el) => {
    const mot = el.textContent?.trim().match(/^\d+\s+(.+?)s?$/)?.[1];
    if (mot) el.textContent = `${visibles} ${mot}${visibles > 1 ? "s" : ""}`;
  });
  document.querySelectorAll<HTMLElement>("[data-axs-embed-html] #plpEmpty").forEach((el) => { el.style.display = visibles ? "none" : "block"; });
}

export function FiltresCatalogue() {
  // Recherche (?q=, depuis la barre ou la fenêtre de recherche) : la page
  // catalogue d'un design ne filtre pas côté serveur — on masque ici les
  // cartes dont le texte (nom, catégorie…) ne contient pas la recherche.
  const q = useSearchParams().get("q")?.trim() ?? "";
  useEffect(() => {
    if (q) filtrer((carte) => sansAccents(carte.textContent || "").includes(sansAccents(q)));
  }, [q]);

  useEffect(() => {
    const clic = (e: MouseEvent) => {
      const pastille = (e.target as HTMLElement).closest<HTMLElement>("[data-axs-embed-html] [data-cat]");
      if (!pastille || pastille.closest("#plpGrid, #homeGrid")) return; // une carte produit, pas un filtre
      pastille.parentElement?.querySelectorAll("[data-cat]").forEach((p) => p.classList.remove("active"));
      pastille.classList.add("active");
      const cat = pastille.dataset.cat ?? "all";
      filtrer((carte) => cat === "all" || carte.dataset.cat === cat);
    };
    // Tri (<select data-axs-tri> : recent | asc | desc) — réordonne les cartes
    // d'après data-prix / data-rang posés par lib/vitrine-design.ts.
    const tri = (e: Event) => {
      const select = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-axs-embed-html] select[data-axs-tri]");
      if (!select) return;
      const nb = (c: HTMLElement, k: string) => Number(c.dataset[k]) || 0;
      const comparer = select.value === "asc" ? (a: HTMLElement, b: HTMLElement) => nb(a, "prix") - nb(b, "prix")
        : select.value === "desc" ? (a: HTMLElement, b: HTMLElement) => nb(b, "prix") - nb(a, "prix")
        : (a: HTMLElement, b: HTMLElement) => nb(a, "rang") - nb(b, "rang");
      document.querySelectorAll<HTMLElement>("[data-axs-embed-html] #plpGrid").forEach((grille) => {
        [...grille.querySelectorAll<HTMLElement>(":scope > [data-cat]")].sort(comparer).forEach((c) => grille.appendChild(c));
      });
    };
    document.addEventListener("click", clic);
    document.addEventListener("change", tri);
    return () => { document.removeEventListener("click", clic); document.removeEventListener("change", tri); };
  }, []);
  return null;
}
