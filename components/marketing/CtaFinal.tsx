"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Rocket } from "lucide-react";
import { CartParallax } from "./CartParallax";
import { useT } from "@/components/I18nProvider";

const CTA_CARTS = [
  { size: 500, top: "10%", duration: 19, delay: 0,  opacity: 0.05, direction: "rtl" as const },
  { size: 350, top: "60%", duration: 24, delay: 7,  opacity: 0.04, direction: "ltr" as const },
  { size: 650, top: "30%", duration: 15, delay: 12, opacity: 0.025, direction: "rtl" as const },
];

export function CtaFinal() {
  const tr = useT();
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
    <section ref={sectionRef} className="py-16 sm:py-24 bg-gradient-to-b from-orange-50/60 to-white relative overflow-hidden">
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
          style={{ animation: "axRespire 4s ease-in-out infinite" }}
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
        {/* Headline */}
        <h2
          className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "slideRevealLeft 0.8s 0.2s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          {tr("Arrête de perdre des ventes sur WhatsApp.")}
          <br />
          <span
            className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5A623] via-[#FFD280] to-[#E09015]"
            style={{ backgroundSize: "200% auto" }}
          >
            {tr("Ta boutique professionnelle t'attend.")}
          </span>
        </h2>

        <p
          className="text-gray-400 text-base sm:text-xl mb-8 sm:mb-10 max-w-2xl mx-auto"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "flip3dIn 0.7s 0.4s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          {tr("En 3 minutes, tu as une boutique en ligne professionnelle avec Orange Money intégré.")}{" "}
          <br className="hidden sm:block" />
          {tr("Gratuit pour commencer, sans carte bancaire.")}
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
            className="inline-flex items-center gap-2 sm:gap-3 bg-[#F5A623] text-white font-bold px-6 py-4 sm:px-10 sm:py-5 rounded-2xl text-base sm:text-xl hover:bg-[#D4911A] transition-colors shadow-2xl shadow-[#F5A623]/25 active:scale-95 relative overflow-hidden group"
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
              }}
            />
            <Sparkles size={22} className="relative z-10 hidden sm:block" />
            <Rocket size={20} className="relative z-10" />
            <span className="relative z-10">{tr("Créer ma boutique gratuite maintenant")}</span>
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
          {tr("Gratuit pour toujours · Orange Money & MTN acceptés · Boutique live en 3 minutes")}
        </p>
      </div>
    </section>
  );
}
