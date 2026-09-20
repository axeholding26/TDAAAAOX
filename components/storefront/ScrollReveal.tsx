"use client";

import { useEffect, useRef, useState } from "react";

export type RevealType = "none" | "fade-in" | "slide-up" | "slide-left" | "zoom-in" | "flip" | "blur-in";

const CLASS_MAP: Record<RevealType, string> = {
  none: "",
  "fade-in": "ax-reveal-fade",
  "slide-up": "ax-reveal-up",
  "slide-left": "ax-reveal-left",
  "zoom-in": "ax-reveal-zoom",
  flip: "ax-reveal-flip",
  "blur-in": "ax-reveal-blur",
};

const SPEED_MS: Record<string, number> = { fast: 400, normal: 650, slow: 950 };

// Anime une section de boutique au scroll, pilotée par ThemeAnimations
// (lib/theme-config.ts) — le réglage vient du builder (preset, vitesse,
// animation par section), jamais codé en dur dans les pages elles-mêmes.
export function ScrollReveal({
  type = "fade-in",
  vitesse = "normal",
  delay = 0,
  className,
  children,
}: {
  type?: RevealType;
  vitesse?: "fast" | "normal" | "slow";
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(type === "none");

  useEffect(() => {
    if (type === "none") return;
    const el = ref.current;
    if (!el) return;
    // Respecte les utilisateurs qui préfèrent moins d'animations
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [type]);

  const cls = CLASS_MAP[type] || "";

  return (
    <div
      ref={ref}
      className={[cls, visible ? "ax-reveal-visible" : "", className].filter(Boolean).join(" ")}
      style={{ transitionDuration: `${SPEED_MS[vitesse] ?? 650}ms`, transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
