"use client";
import { useEffect, useRef, useState } from "react";
import { ShoppingBag, Users, Globe, TrendingUp } from "lucide-react";
import { CartParallax } from "./CartParallax";

const STATS_CARTS = [
  { size: 400, top: "15%", duration: 22, delay: 2,  opacity: 0.04, direction: "rtl" as const },
  { size: 560, top: "55%", duration: 17, delay: 8,  opacity: 0.03, direction: "ltr" as const },
];

const stats = [
  { icone: ShoppingBag, valeur: 1247, suffixe: "+", label: "Boutiques actives", couleur: "#1B4FD8" },
  { icone: Users, valeur: 48200, suffixe: "+", label: "Clients servis", couleur: "#7c3aed" },
  { icone: Globe, valeur: 23, suffixe: " pays", label: "Pays couverts", couleur: "#c2622d" },
  { icone: TrendingUp, valeur: 98, suffixe: "%", label: "Satisfaction marchands", couleur: "#10b981" },
];

function AnimatedNumber({ cible, suffixe }: { cible: number; suffixe: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duree = 1800;
        const pas = Math.ceil(cible / (duree / 16));
        const timer = setInterval(() => {
          setVal((p) => {
            if (p + pas >= cible) { clearInterval(timer); return cible; }
            return p + pas;
          });
        }, 16);
      }
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [cible]);

  return <span ref={ref}>{val.toLocaleString("fr-FR")}{suffixe}</span>;
}

export function StatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 bg-white border-y border-gray-100 relative overflow-hidden">
      <CartParallax carts={STATS_CARTS} color="#1B4FD8" />
      {/* Ambient glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[200px] bg-[#1B4FD8]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 relative">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => {
            const Icone = s.icone;
            const isHovered = hoverIdx === i;
            return (
              <div
                key={i}
                className="text-center group cursor-default"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                style={{
                  opacity: visible ? 1 : 0,
                  animation: visible ? `flip3dIn 0.7s ${i * 120}ms cubic-bezier(0.23,1,0.32,1) both` : "none",
                }}
              >
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 transition-all duration-500"
                  style={{
                    backgroundColor: `${s.couleur}12`,
                    border: `1px solid ${s.couleur}25`,
                    transform: isHovered ? "scale(1.2) rotateY(360deg)" : "scale(1) rotateY(0deg)",
                    boxShadow: isHovered ? `0 0 30px 8px ${s.couleur}30, 0 0 60px 20px ${s.couleur}10` : "none",
                    transition: "transform 0.6s cubic-bezier(0.23,1,0.32,1), box-shadow 0.4s ease",
                  }}
                >
                  <Icone style={{ color: s.couleur }} size={26} />
                </div>

                <div
                  className="text-3xl sm:text-4xl font-bold font-playfair mb-2"
                  style={{
                    color: s.couleur,
                    textShadow: isHovered ? `0 0 20px ${s.couleur}60` : "none",
                    transition: "text-shadow 0.3s ease",
                  }}
                >
                  <AnimatedNumber cible={s.valeur} suffixe={s.suffixe} />
                </div>
                <p className="text-gray-400 text-sm">{s.label}</p>

                {/* Under-card glow line */}
                <div
                  className="mt-4 mx-auto h-0.5 rounded-full transition-all duration-500"
                  style={{
                    width: isHovered ? "60%" : "0%",
                    backgroundColor: s.couleur,
                    boxShadow: `0 0 8px 2px ${s.couleur}`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
