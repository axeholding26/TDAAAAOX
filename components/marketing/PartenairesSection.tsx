"use client";
import { useEffect, useRef, useState } from "react";

// En attendant les vrais logos partenaires (Orange Money, MTN, Wave, Visa, Mastercard…),
// chaque entrée affiche son nom en attendant `logoUrl`. Il suffira de renseigner
// `logoUrl` pour basculer automatiquement sur le logo réel.
const PARTENAIRES: { nom: string; logoUrl?: string }[] = [
  { nom: "Orange Money" },
  { nom: "MTN MoMo" },
  { nom: "Wave" },
  { nom: "Visa" },
  { nom: "Mastercard" },
  { nom: "M-Pesa" },
  { nom: "Flutterwave" },
];

// Dupliqué pour un défilement en boucle continue sans coupure visible.
const TRACK = [...PARTENAIRES, ...PARTENAIRES];

export function PartenairesSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.2 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-14 bg-white border-y border-gray-100 overflow-hidden"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(16px)", transition: "opacity 0.7s cubic-bezier(0.23,1,0.32,1), transform 0.7s cubic-bezier(0.23,1,0.32,1)" }}>
      <p className="text-center text-[12px] font-bold uppercase tracking-widest text-gray-400 mb-8">
        Ils font confiance à nos partenaires de paiement
      </p>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 w-16 sm:w-28 z-10 pointer-events-none" style={{ background: "linear-gradient(90deg, #fff, transparent)" }} />
        <div className="absolute inset-y-0 right-0 w-16 sm:w-28 z-10 pointer-events-none" style={{ background: "linear-gradient(270deg, #fff, transparent)" }} />

        <div className="ax-marquee-track">
          {TRACK.map((p, i) => (
            <div key={`${p.nom}-${i}`} className="flex items-center justify-center flex-shrink-0 px-8 sm:px-12">
              {p.logoUrl ? (
                <img src={p.logoUrl} alt={p.nom} className="h-8 sm:h-9 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" />
              ) : (
                <span className="text-lg sm:text-xl font-bold text-gray-300 whitespace-nowrap hover:text-[#F5A623] transition-colors">
                  {p.nom}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .ax-marquee-track {
          display: flex;
          align-items: center;
          width: max-content;
          animation: axMarquee 28s linear infinite;
        }
        .ax-marquee-track:hover { animation-play-state: paused; }
        @keyframes axMarquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
