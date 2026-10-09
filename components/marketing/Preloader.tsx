"use client";
import { useEffect, useState } from "react";
import { HeroFond } from "@/components/marketing/HeroSection";

// Affiché une seule fois par chargement complet : au retour sur « / » par navigation interne, rien.
let dejaAffiche = false;

export function Preloader() {
  const [etat, setEtat] = useState<"visible" | "sortie" | "fini">(dejaAffiche ? "fini" : "visible");

  useEffect(() => {
    if (dejaAffiche) return;
    dejaAffiche = true;
    const sortir = () => setEtat(e => (e === "visible" ? "sortie" : e));
    // ponytail: plafond de 3 s — l'événement load peut traîner (vidéo, iframes) ; on n'attend pas plus.
    const plafond = setTimeout(sortir, 3000);
    if (document.readyState === "complete") sortir();
    else window.addEventListener("load", sortir, { once: true });
    return () => { clearTimeout(plafond); window.removeEventListener("load", sortir); };
  }, []);

  if (etat === "fini") return null;
  return (
    <div
      aria-hidden
      onTransitionEnd={() => setEtat("fini")}
      className="fixed inset-0 z-[9999] bg-white overflow-hidden flex items-center justify-center transition-opacity duration-500"
      style={{ opacity: etat === "sortie" ? 0 : 1, pointerEvents: etat === "sortie" ? "none" : "auto" }}
    >
      <HeroFond />
      <img src="/logo.png" alt="" className="ax-preload-logo relative w-[180px] sm:w-[240px] h-auto" />
      <style>{`
        @keyframes axPreload { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.06); opacity: .85 } }
        .ax-preload-logo { animation: axPreload 1.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ax-preload-logo { animation: none; } }
      `}</style>
    </div>
  );
}
