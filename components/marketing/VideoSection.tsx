"use client";
// v4 — lucide icons only, no emoji
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Lock, Rocket, Zap, Bot, Globe } from "lucide-react";
import { CartParallax } from "./CartParallax";

const HIGHFIELD_VIDEO_URL = "";
const HIGHFIELD_IFRAME_URL = "";

const VIDEO_CARTS = [
  { size: 600, top: "5%",  duration: 20, delay: 0,  opacity: 0.05, direction: "rtl" as const },
  { size: 400, top: "60%", duration: 16, delay: 5,  opacity: 0.04, direction: "ltr" as const },
  { size: 280, top: "38%", duration: 28, delay: 11, opacity: 0.055, direction: "rtl" as const },
];

export function VideoSection() {
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          if (videoRef.current && HIGHFIELD_VIDEO_URL) {
            videoRef.current.play().catch(() => {});
          }
        }
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  // Effet parallax lié au scroll écrit directement dans le DOM (via rAF) au lieu
  // de passer par le state React — évite un re-render de toute la section à
  // chaque event de scroll (c'était la cause du blocage/saccades au défilement).
  // useLayoutEffect + appel immédiat pour appliquer la bonne position dès que
  // la section devient visible, sans attendre le prochain scroll (pas de flash).
  useLayoutEffect(() => {
    if (!visible) return;
    let ticking = false;
    const appliquer = () => {
      const y = window.scrollY;
      if (playerRef.current) {
        playerRef.current.style.transform =
          `translateY(${-y * 0.04}px) perspective(1200px) rotateX(${Math.min(y * 0.005, 4)}deg)`;
      }
      ticking = false;
    };
    appliquer();
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(appliquer);
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [visible]);

  const hasVideo = !!HIGHFIELD_VIDEO_URL;
  const hasIframe = !!HIGHFIELD_IFRAME_URL;

  return (
    <section
      id="video-demo"
      ref={sectionRef}
      className="relative py-28 overflow-hidden bg-gradient-to-b from-white via-orange-50/20 to-white"
    >
      <CartParallax carts={VIDEO_CARTS} color="#F5A623" />

      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.08) 0%, transparent 65%)" }}
        />
      </div>

      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 relative z-10">

        {/* Header */}
        <div
          className="text-center mb-16"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "none" : "translateY(30px)",
            transition: "all 0.8s cubic-bezier(0.23,1,0.32,1)",
          }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6 bg-[#F5A623]/10 border border-[#F5A623]/25 text-[#F5A623]">
            <span className="w-2 h-2 rounded-full bg-[#F5A623] animate-pulse"/>
            Vois ton empire naître en direct
          </span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-5 leading-tight"
            style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
            3 minutes.
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #F5A623, #e8950f, #FFD280)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "shimmer 3s linear infinite",
              }}
            >
              C'est tout ce qu'il faut.
            </span>
          </h2>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto">
            Dis-nous ce que tu vends. AXSO crée ta boutique, tes prix, tes visuels et ton
            premier post Instagram. En direct. Sous tes yeux.
          </p>
        </div>

        {/* Player vidéo */}
        <div
          ref={playerRef}
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? undefined : "translateY(60px) perspective(1200px) rotateX(8deg)",
            transition: visible ? "opacity 0.9s 0.2s, transform 0.9s 0.2s cubic-bezier(0.23,1,0.32,1)" : "none",
            willChange: "transform",
          }}
        >
          {/* Glow */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{
              background: "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(245,166,35,0.18), transparent)",
              filter: "blur(30px)",
              transform: "translateY(20px) scale(1.05)",
            }}
          />

          <div
            className="relative rounded-3xl overflow-hidden border"
            style={{
              borderColor: "rgba(245,166,35,0.2)",
              boxShadow: "0 0 80px rgba(245,166,35,0.12), 0 40px 100px rgba(0,0,0,0.12), 0 0 0 1px rgba(245,166,35,0.08)",
              background: "#f9fafb",
            }}
          >
            {/* Browser chrome */}
            <div className="bg-white px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
              <div className="flex gap-2">
                <div className="w-3.5 h-3.5 rounded-full bg-red-400/80"/>
                <div className="w-3.5 h-3.5 rounded-full bg-yellow-400/80"/>
                <div className="w-3.5 h-3.5 rounded-full bg-green-400/80"/>
              </div>
              <div className="flex-1 bg-gray-50 rounded-xl px-4 py-2 flex items-center gap-2 border border-gray-200/80">
                <Lock size={14} className="text-gray-300 flex-shrink-0" />
                <span className="text-sm text-gray-400 flex-1 text-center">app.axso.africa — Construction de ton empire</span>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#F5A623]/10 text-[#F5A623]">
                ● LIVE
              </span>
            </div>

            {/* Zone vidéo */}
            <div className="relative bg-gray-950" style={{ aspectRatio: "16/9" }}>
              {hasVideo && (
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  src={HIGHFIELD_VIDEO_URL}
                  muted loop playsInline autoPlay
                />
              )}
              {hasIframe && !hasVideo && (
                <iframe
                  className="w-full h-full"
                  src={HIGHFIELD_IFRAME_URL}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  style={{ border: "none" }}
                />
              )}
              {!hasVideo && !hasIframe && (
                <div className="absolute inset-0 flex flex-col items-center justify-center"
                  style={{ background: "linear-gradient(145deg, #0d0d0d, #141414, #0e0e0e)" }}>
                  <div className="relative flex items-center justify-center mb-8">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="absolute rounded-full border"
                        style={{
                          width: `${i * 80}px`,
                          height: `${i * 80}px`,
                          borderColor: `rgba(245,166,35,${0.35 / i})`,
                          animation: `ripple ${1.5 + i * 0.5}s ease-out ${i * 0.3}s infinite`,
                        }}
                      />
                    ))}
                    <div
                      className="relative w-20 h-20 rounded-full flex items-center justify-center text-4xl cursor-pointer z-10 transition-transform hover:scale-110"
                      style={{
                        background: "linear-gradient(135deg, #F5A623, #e8950f)",
                        boxShadow: "0 0 40px rgba(245,166,35,0.5)",
                      }}
                    >
                      ▶
                    </div>
                  </div>
                  <p className="text-white/60 text-lg font-medium mb-2">Démo AXSO en direct</p>
                  <p className="text-white/35 text-sm text-center max-w-xs px-4">
                    La vidéo de démo arrive bientôt — ton empire se construit en temps réel
                  </p>
                  <div className="absolute bottom-8 left-8 right-8">
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: "42%",
                          background: "linear-gradient(90deg, #F5A623, #FFD280)",
                          animation: "progressLoop 8s linear infinite",
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-white/30 text-xs">0:00</span>
                      <span className="text-white/30 text-xs inline-flex items-center gap-1"><Rocket size={12} /> Empire en construction</span>
                      <span className="text-white/30 text-xs">1:00</span>
                    </div>
                  </div>
                </div>
              )}
              {(hasVideo || hasIframe) && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4), transparent)" }}
                />
              )}
            </div>

            {/* Bottom bar */}
            <div className="bg-white px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#F5A623]/10 flex items-center justify-center text-[#F5A623]"><Bot size={16} /></div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Agent Onboarding</p>
                  <p className="text-[10px] text-gray-400">Empire créé en 58 secondes</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-semibold">✓ Boutique live</span>
                <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#F5A623]/10 text-[#F5A623] font-semibold inline-flex items-center gap-1"><Zap size={10} /> Agents actifs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Points de réassurance */}
        <div
          className="grid grid-cols-3 gap-8 mt-16 text-center"
          style={{ opacity: visible ? 1 : 0, transition: "opacity 1s 0.6s" }}
        >
          {[
            { icon: <Zap size={36} />, title: "3 min pour lancer", desc: "De ta vision à la boutique live" },
            { icon: <Bot size={36} />, title: "11 IA qui bossent pour toi", desc: "Travaillent pour toi en continu" },
            { icon: <Globe size={36} />, title: "Actif dans 10 pays africains", desc: "Paiements et livraisons localisés" },
          ].map((item) => (
            <div key={item.title} className="group">
              <div
                className="mb-3 inline-block transition-transform duration-300 group-hover:scale-125"
                style={{ filter: "drop-shadow(0 0 12px rgba(245,166,35,0.3))", color: "#F5A623" }}
              >
                {item.icon}
              </div>
              <p className="font-bold text-gray-900 mb-1">{item.title}</p>
              <p className="text-sm text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes ripple { 0%{transform:scale(0.8);opacity:0.8} 100%{transform:scale(1.6);opacity:0} }
        @keyframes progressLoop { 0%{width:0%} 100%{width:100%} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
      `}</style>
    </section>
  );
}
