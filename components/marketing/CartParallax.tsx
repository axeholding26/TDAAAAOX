"use client";
// Charriots géants animés — défilent sur toute la largeur des sections
// Légers, 100% GPU (transform only), pointer-events: none

interface CartConfig {
  size: number;
  top: string;
  duration: number;
  delay: number;
  opacity: number;
  direction: "rtl" | "ltr";
  color?: string;
}

const CartSVG = ({ color = "#1B4FD8" }: { color?: string }) => (
  <svg viewBox="0 0 300 255" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "100%" }}>
    {/* Handle */}
    <path d="M12 38 L68 38" stroke={color} strokeWidth="9" strokeLinecap="round"/>
    {/* Neck */}
    <path d="M68 38 L68 68" stroke={color} strokeWidth="9" strokeLinecap="round"/>
    {/* Body outline */}
    <path d="M68 68 L102 68 L125 178 L262 178 L285 72 L102 72" stroke={color} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    {/* Base bar */}
    <path d="M125 178 L262 178" stroke={color} strokeWidth="9" strokeLinecap="round"/>
    {/* Wheel left — outer */}
    <circle cx="148" cy="222" r="28" stroke={color} strokeWidth="9" fill="none"/>
    {/* Wheel left — hub */}
    <circle cx="148" cy="222" r="9" stroke={color} strokeWidth="6" fill="none"/>
    {/* Wheel right — outer */}
    <circle cx="238" cy="222" r="28" stroke={color} strokeWidth="9" fill="none"/>
    {/* Wheel right — hub */}
    <circle cx="238" cy="222" r="9" stroke={color} strokeWidth="6" fill="none"/>
    {/* Item — box left */}
    <rect x="120" y="85" width="48" height="72" rx="7" stroke={color} strokeWidth="7" fill="none"/>
    {/* Item — box middle */}
    <rect x="180" y="85" width="62" height="72" rx="7" stroke={color} strokeWidth="7" fill="none"/>
    {/* Item — thin strip */}
    <rect x="103" y="92" width="12" height="60" rx="4" stroke={color} strokeWidth="5" fill="none"/>
    {/* Sparkle big */}
    <path d="M272 16 L277 30 L291 24 L277 40 L272 54 L267 40 L253 24 L267 30 Z" stroke={color} strokeWidth="3.5" fill="none" strokeLinejoin="round"/>
    {/* Sparkle small */}
    <path d="M18 55 L21 64 L30 60 L21 69 L18 78 L15 69 L6 60 L15 64 Z" stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
    {/* Speed lines */}
    <path d="M10 88 L42 88" stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.5"/>
    <path d="M6 108 L28 108" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.35"/>
    <path d="M12 128 L35 128" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity="0.25"/>
  </svg>
);

const DEFAULT_CARTS: CartConfig[] = [
  { size: 520, top: "8%",  duration: 16, delay: 0,   opacity: 0.09, direction: "rtl" },
  { size: 320, top: "55%", duration: 22, delay: 5,   opacity: 0.055, direction: "ltr" },
  { size: 680, top: "72%", duration: 13, delay: 2,   opacity: 0.04, direction: "rtl" },
  { size: 240, top: "30%", duration: 28, delay: 9,   opacity: 0.07, direction: "ltr" },
  { size: 440, top: "15%", duration: 19, delay: 14,  opacity: 0.035, direction: "rtl" },
];

interface CartParallaxProps {
  carts?: CartConfig[];
  color?: string;
  className?: string;
}

export function CartParallax({ carts = DEFAULT_CARTS, color = "#1B4FD8", className = "" }: CartParallaxProps) {
  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ perspective: "1400px", perspectiveOrigin: "50% 50%" }}
      aria-hidden
    >
      {carts.map((c, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: c.top,
            width: c.size,
            height: c.size * 0.85,
            opacity: c.opacity,
            willChange: "transform",
            animation: `${c.direction === "rtl" ? "cartRTL" : "cartLTR"} ${c.duration}s linear ${c.delay}s infinite`,
          }}
        >
          <CartSVG color={color} />
        </div>
      ))}

      <style>{`
        @keyframes cartRTL {
          0%   { transform: translateX(110vw)  translateZ(-80px) rotateY(-18deg) rotateZ(-2.5deg) scale(1); }
          30%  { transform: translateX(60vw)   translateZ(40px)  rotateY(-5deg)  rotateZ(-0.5deg) scale(1.04); }
          50%  { transform: translateX(5vw)    translateZ(120px) rotateY(0deg)   rotateZ(0deg)    scale(1.07); }
          70%  { transform: translateX(-50vw)  translateZ(40px)  rotateY(5deg)   rotateZ(0.5deg)  scale(1.04); }
          100% { transform: translateX(-115vw) translateZ(-80px) rotateY(18deg)  rotateZ(2.5deg)  scale(1); }
        }
        @keyframes cartLTR {
          0%   { transform: translateX(-115vw) translateZ(-80px) rotateY(18deg)  rotateZ(2.5deg)  scale(1); }
          30%  { transform: translateX(-60vw)  translateZ(40px)  rotateY(5deg)   rotateZ(0.5deg)  scale(1.04); }
          50%  { transform: translateX(-5vw)   translateZ(120px) rotateY(0deg)   rotateZ(0deg)    scale(1.07); }
          70%  { transform: translateX(50vw)   translateZ(40px)  rotateY(-5deg)  rotateZ(-0.5deg) scale(1.04); }
          100% { transform: translateX(110vw)  translateZ(-80px) rotateY(-18deg) rotateZ(-2.5deg) scale(1); }
        }
      `}</style>
    </div>
  );
}
