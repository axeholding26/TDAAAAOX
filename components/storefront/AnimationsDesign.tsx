"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Animations d'apparition des designs AXSO importés (panneau « Animations »).
// Jouées avec l'API Web Animations : aucun attribut ni style n'est écrit dans
// le HTML du design (dans le Constructeur, ce HTML est enregistré tel quel).
// Chaque section — et, avec « décalage », chaque carte d'une grille — attend
// hors écran dans l'état de départ et s'anime quand elle devient visible.
// Dans l'aperçu du Constructeur, tout est rejoué à chaque changement de réglage.
type Anim = { global?: string; vitesse?: string; stagger?: boolean };

const KEYFRAMES: Record<string, Keyframe[]> = {
  "fade-in": [{ opacity: 0 }, { opacity: 1 }],
  "slide-up": [{ opacity: 0, transform: "translateY(40px)" }, { opacity: 1, transform: "none" }],
  "slide-left": [{ opacity: 0, transform: "translateX(-40px)" }, { opacity: 1, transform: "none" }],
  "zoom-in": [{ opacity: 0, transform: "scale(.92)" }, { opacity: 1, transform: "none" }],
  flip: [{ opacity: 0, transform: "perspective(600px) rotateX(20deg)" }, { opacity: 1, transform: "none" }],
  "blur-in": [{ opacity: 0, filter: "blur(12px)" }, { opacity: 1, filter: "none" }],
};
const DUREE: Record<string, number> = { fast: 400, normal: 600, slow: 900 };
const GRILLES = `[data-axs-embed-html] [class*="grid"]:not([class*="foot"]) > *`;

/** `racine` : conteneur qui défile (aperçu du Constructeur) ; par défaut la fenêtre. */
export function AnimationsDesign({ animations, racine }: { animations: Anim; racine?: () => Element | null }) {
  const chemin = usePathname();
  const cle = JSON.stringify([animations.global, animations.vitesse, animations.stagger !== false]);

  useEffect(() => {
    const kf = KEYFRAMES[animations.global || ""];
    if (!kf || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const duration = DUREE[animations.vitesse || "normal"] ?? 600;
    const cibles: [HTMLElement, number][] = [...document.querySelectorAll<HTMLElement>("[data-axs-embed-html] section")].map((el) => [el, 0]);
    if (animations.stagger !== false) {
      document.querySelectorAll<HTMLElement>(GRILLES).forEach((el) => {
        const rang = [...(el.parentElement?.children ?? [])].indexOf(el);
        cibles.push([el, Math.min(rang, 8) * 80]);
      });
    }
    const joues = new Map<Element, Animation>();
    for (const [el, delay] of cibles) {
      const a = el.animate(kf, { duration, delay, easing: "cubic-bezier(.16,1,.3,1)", fill: "both" });
      a.pause(); // état de départ tant que l'élément n'est pas visible
      a.onfinish = () => a.cancel(); // terminé : le design retrouve ses propres styles (survol des cartes…)
      joues.set(el, a);
    }
    const io = new IntersectionObserver((entrees) => entrees.forEach((e) => {
      if (!e.isIntersecting) return;
      joues.get(e.target)?.play();
      io.unobserve(e.target);
    }), { root: racine?.() ?? null, threshold: 0.12 });
    joues.forEach((_, el) => io.observe(el));
    return () => { io.disconnect(); joues.forEach((a) => a.cancel()); };
  }, [cle, chemin]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
