"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Rocket } from "lucide-react";
import { CartParallax } from "./CartParallax";

const CTA_CARTS = [
  { size: 500, top: "10%", duration: 19, delay: 0,  opacity: 0.05, direction: "rtl" as const },
  { size: 350, top: "60%", duration: 24, delay: 7,  opacity: 0.04, direction: "ltr" as const },
  { size: 650, top: "30%", duration: 15, delay: 12, opacity: 0.025, direction: "rtl" as const },
];

function FlipDigit({ valeur, label }: { valeur: number; label: string }) {
  const [prev, setPrev] = useState(valeur);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (valeur !== prev) {
      setFlipping(true);
      const t = setTimeout(() => { setPrev(valeur); setFlipping(false); }, 300);
      return () => clearTimeout(t);
    }
  }, [valeur, prev]);

  return (
    <div className="flex flex-col items-center">
      <div
        className="bg-white border-2 border-[#F5A623]/30 rounded-2xl w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center text-2xl sm:text-3xl font-bold text-[#F5A623] shadow-lg shadow-[#F5A623]/10 overflow-hidden"
        style={{ perspective: "400px" }}
      >
        <span
          style={{
            display: "block",
            animation: flipping ? "flipDigit 0.3s ease-in-out" : "none",
            willChange: "transform",
          }}
        >
          {String(valeur).padStart(2, "0")}
        </span>
      </div>
      <span className="text-gray-400 text-xs mt-2 uppercase tracking-widest">{label}</span>
    </div>
  );
}

export function CtaFinal() {
  const [temps, setTemps] = useState({ h: 47, m: 59, s: 59 });
  const [visible, setVisible] = useState(false);
  const [magnetOffset, setMagnetOffset] = useState({ x: 0, y: 0 });
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    // Ne décompte que quand la section est visible — évite un re-render de
    // toute la section (+ des 3 FlipDigit) chaque seconde pendant que
    // l'utilisateur scrolle ailleurs sur la page, ce qui causait du jank.
    if (!visible) return;
    const timer = setInterval(() => {
      setTemps((prev) => {
        let { h, m, s } = prev;
        if (s > 0) return { h, m, s: s - 1 };
        if (m > 0) return { h, m: m - 1, s: 59 };
        if (h > 0) return { h: h - 1, m: 59, s: 59 };
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const handleBtnMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setMagnetOffset({
      x: (e.clientX - cx) * 0.35,
      y: (e.clientY - cy) * 0.35,
    });
  };

  return (
    <section ref={sectionRef} className="py-24 bg-gradient-to-b from-orange-50/60 to-white relative overflow-hidden">
      <CartParallax carts={CTA_CARTS} color="#F5A623" />
      {/* Aurora background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-[#F5A623]/10 rounded-full blur-3xl"
          style={{ animation: "aurora 8s ease-in-out infinite" }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-amber-100/50 rounded-full blur-3xl"
          style={{ animation: "aurora 10s ease-in-out 3s infinite" }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#F5A623]/5 rounded-full blur-3xl"
          style={{ animation: "glowPulse 4s ease-in-out infinite" }}
        />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(#F5A623 1px, transparent 1px), linear-gradient(90deg, #F5A623 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
        {/* Launch badge */}
        <div
          className="inline-flex items-center gap-2 bg-[#F5A623]/10 border border-[#F5A623]/25 rounded-full px-4 py-2 mb-8"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "scaleReveal3d 0.6s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
          <span className="text-[#F5A623] text-sm font-medium">Offre de lancement — encore</span>
        </div>

        {/* 3D Flip Countdown */}
        <div
          className="flex items-center justify-center gap-4 sm:gap-6 mb-12"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "flip3dIn 0.7s 0.1s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          <FlipDigit valeur={temps.h} label="Heures" />
          <span className="text-[#F5A623] text-3xl font-bold animate-pulse" style={{ textShadow: "0 0 20px rgba(245,166,35,0.5)" }}>:</span>
          <FlipDigit valeur={temps.m} label="Minutes" />
          <span className="text-[#F5A623] text-3xl font-bold animate-pulse" style={{ textShadow: "0 0 20px rgba(245,166,35,0.5)" }}>:</span>
          <FlipDigit valeur={temps.s} label="Secondes" />
        </div>

        {/* Headline */}
        <h2
          className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "slideRevealLeft 0.8s 0.2s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          Arrête de perdre des ventes sur WhatsApp.
          <br />
          <span
            className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5A623] via-[#FFD280] to-[#E09015]"
            style={{
              backgroundSize: "200% auto",
              animation: "shimmer 3s linear infinite",
            }}
          >
            Ta boutique professionnelle t'attend.
          </span>
        </h2>

        <p
          className="text-gray-400 text-xl mb-10 max-w-2xl mx-auto"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "flip3dIn 0.7s 0.4s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          En 3 minutes, tu as une boutique en ligne professionnelle avec Orange Money intégré.
          <br className="hidden sm:block" />
          Gratuit pour commencer — tu paies seulement quand tu vends.
        </p>

        {/* Magnetic CTA button */}
        <div
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "scaleReveal3d 0.8s 0.5s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          <Link
            href="/inscription"
            className="inline-flex items-center gap-3 bg-[#F5A623] text-white font-bold px-10 py-5 rounded-2xl text-xl hover:bg-[#D4911A] transition-colors shadow-2xl shadow-[#F5A623]/25 active:scale-95 relative overflow-hidden group"
            onMouseMove={handleBtnMouseMove}
            onMouseLeave={() => setMagnetOffset({ x: 0, y: 0 })}
            style={{
              transform: `translate(${magnetOffset.x}px, ${magnetOffset.y}px)`,
              transition: magnetOffset.x === 0
                ? "transform 0.5s cubic-bezier(0.23,1,0.32,1), background-color 0.2s, box-shadow 0.3s"
                : "transform 0.1s linear",
              boxShadow: `0 0 40px ${Math.abs(magnetOffset.x) > 5 ? "16px" : "8px"} rgba(245,166,35,0.4), 0 20px 60px rgba(245,166,35,0.25)`,
              willChange: "transform",
            }}
          >
            {/* Button shimmer */}
            <span
              className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s linear infinite",
              }}
            />
            <Sparkles size={22} className="relative z-10" />
            <Rocket size={20} className="relative z-10" />
            <span className="relative z-10">Créer ma boutique gratuite maintenant</span>
            <ArrowRight size={22} className="relative z-10 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <p
          className="text-gray-400 text-sm mt-6"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "flip3dIn 0.6s 0.7s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          Gratuit pour toujours · Orange Money & MTN acceptés · Boutique live en 3 minutes
        </p>
      </div>
    </section>
  );
}
