"use client";
import { useEffect } from "react";

// Met en pause les animations CSS des sections de la page d'accueil qui ne sont pas à
// l'écran (classe .ax-hors-ecran, voir globals.css). Une trentaine d'animations
// tournaient en permanence et saturaient le processeur des téléphones pendant le défilement.
export function PauseHorsEcran() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entrees) => entrees.forEach((e) => e.target.classList.toggle("ax-hors-ecran", !e.isIntersecting)),
      { rootMargin: "200px 0px" },
    );
    document.querySelectorAll("main > section").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  return null;
}
