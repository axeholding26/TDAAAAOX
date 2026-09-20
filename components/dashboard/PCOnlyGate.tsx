"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Monitor, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface Props {
  label?: string;
}

export function PCOnlyGate({ label = "Cette fonctionnalité" }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted]   = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!mounted || !isMobile) return null;

  // Portalé vers document.body : un ancêtre avec une animation `transform`
  // (ex. .ax-page-enter) devient le containing block d'un position:fixed
  // et casse inset:0 — le portail échappe à tout ancêtre transformé/scrollé.
  return createPortal((
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(160deg, #080808 0%, #111 60%, #0a0a0a 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "32px 24px",
      fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute", top: "15%", left: "50%", transform: "translateX(-50%)",
        width: 320, height: 320, pointerEvents: "none",
        background: "radial-gradient(ellipse, rgba(245,166,35,0.07) 0%, transparent 70%)",
      }} />

      {/* Logo */}
      <div style={{ marginBottom: 44, position: "relative", zIndex: 1 }}>
        <Image src="/logo-dark.png" alt="Axso" width={88} height={28} style={{ objectFit: "contain", opacity: 0.75 }} />
      </div>

      {/* Icon */}
      <div style={{
        width: 88, height: 88, borderRadius: 28, marginBottom: 28,
        background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 60px rgba(245,166,35,0.06)", position: "relative", zIndex: 1,
      }}>
        <Monitor size={38} style={{ color: "#F5A623" }} />
      </div>

      {/* Text */}
      <h2 style={{
        fontSize: 22, fontWeight: 700, color: "white",
        marginBottom: 12, textAlign: "center", letterSpacing: "-0.3px",
        position: "relative", zIndex: 1,
      }}>
        Mode PC recommandé
      </h2>
      <p style={{
        fontSize: 14, color: "rgba(255,255,255,0.38)", textAlign: "center",
        maxWidth: 290, lineHeight: 1.65, marginBottom: 44,
        position: "relative", zIndex: 1,
      }}>
        {label} est conçue pour grand écran et offre une expérience optimale sur ordinateur. Connectez-vous depuis un PC pour l'utiliser pleinement.
      </p>

      {/* CTA */}
      <button
        onClick={() => router.back()}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 28px", borderRadius: 18, cursor: "pointer",
          background: "rgba(245,166,35,0.09)", border: "1px solid rgba(245,166,35,0.22)",
          color: "#F5A623", fontSize: 14, fontWeight: 600,
          position: "relative", zIndex: 1,
          boxShadow: "0 4px 24px rgba(245,166,35,0.08)",
        }}
      >
        <ArrowLeft size={16} />
        Retour au dashboard
      </button>
    </div>
  ), document.body);
}
