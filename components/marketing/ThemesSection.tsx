"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Gem, Cpu, Coffee } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MANIFESTE_LIBRAIRIE } from "@/lib/axso-design-manifest";

const themes: {
  id: string;
  nom: string;
  categorie: string;
  fond: string;
  accent: string;
  texte: string;
  surface: string;
  description: string;
  preview: { hero: string; prix: string; Icon: LucideIcon };
}[] = (() => {
  const parNom = (nom: string) => MANIFESTE_LIBRAIRIE.find((e) => e.nom === nom)!;
  const specs: { nom: string; categorie: string; Icon: LucideIcon; hero: string; prix: string }[] = [
    { nom: "AUBE", categorie: "Bijoux & Joaillerie", Icon: Gem, hero: "Bague Or 18 Carats", prix: "45 000 XOF" },
    { nom: "NEXUS", categorie: "Tech & Électronique", Icon: Cpu, hero: "Smartphone Pro Max", prix: "350 000 XOF" },
    { nom: "IGNITE", categorie: "Alimentation", Icon: Coffee, hero: "Café Arabica Premium", prix: "8 000 XAF" },
  ];
  return specs.map((s) => {
    const e = parNom(s.nom);
    return {
      id: e.fichier,
      nom: e.nom,
      categorie: s.categorie,
      fond: e.couleurs.fond || "#0a0a0a",
      accent: e.couleurs.accent || "#1B4FD8",
      texte: e.couleurs.texte || "#F5F5F0",
      surface: e.couleurs.surface || "#111",
      description: `Design ${e.ambiance.join(", ")} — vos vrais produits déjà branchés dès l'activation.`,
      preview: { hero: s.hero, prix: s.prix, Icon: s.Icon },
    };
  });
})();

export function ThemesSection() {
  const [actif, setActif] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const theme = themes[actif];
  const PreviewIcon = theme.preview.Icon;

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  const handlePreviewMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -15, y: x * 15 });
  };

  const handlePreviewMouseLeave = () => setTilt({ x: 0, y: 0 });

  const selectTheme = (i: number) => {
    if (i === actif) return;
    setTransitioning(true);
    setTimeout(() => { setActif(i); setTransitioning(false); }, 300);
  };

  return (
    <section ref={sectionRef} className="py-24 bg-gray-50/50 relative overflow-hidden" id="themes">
      {/* Decorative orb */}
      <div className="absolute -right-32 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ backgroundColor: `${theme.accent}08`, transition: "background-color 0.5s ease" }} />

      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24 relative">
        <div
          className="text-center mb-16"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "flip3dIn 0.7s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          <span className="text-[#1B4FD8] text-sm font-semibold uppercase tracking-widest mb-4 block">
            Bibliothèque AXSO Design
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold font-playfair text-gray-900 mb-4">
            Votre boutique, votre identité
          </h2>
          <p className="text-gray-400 text-xl max-w-2xl mx-auto">
            15 designs prêts à l'emploi, chacun pensé pour un univers spécifique. Activez-en un, vos vrais produits s'y branchent aussitôt.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Sélecteur de thèmes — staggered reveal */}
          <div className="space-y-4">
            {themes.map((t, i) => {
              const ThemeIcon = t.preview.Icon;
              return (
              <button
                key={t.id}
                onClick={() => selectTheme(i)}
                className={`w-full text-left p-6 rounded-2xl border-2 transition-all duration-400 hover:scale-[1.01]`}
                style={{
                  opacity: visible ? 1 : 0,
                  animation: visible ? `slideRevealLeft 0.7s ${i * 120 + 200}ms cubic-bezier(0.23,1,0.32,1) both` : "none",
                  borderColor: actif === i ? t.accent : "#f3f4f6",
                  backgroundColor: actif === i ? "white" : "rgba(255,255,255,0.6)",
                  boxShadow: actif === i ? `0 8px 32px -8px ${t.accent}30, 0 0 0 1px ${t.accent}20` : "none",
                  transform: actif === i ? "translateX(6px)" : "translateX(0)",
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
                    style={{
                      backgroundColor: t.fond,
                      border: `2px solid ${t.accent}`,
                      boxShadow: actif === i ? `0 0 16px 4px ${t.accent}30` : "none",
                      color: t.accent,
                    }}
                  >
                    <ThemeIcon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-gray-900 font-bold text-lg">{t.nom}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${t.accent}15`, color: t.accent }}>
                        {t.categorie}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">{t.description}</p>
                  </div>
                </div>
              </button>
              );
            })}
          </div>

          {/* Aperçu — 3D mouse tilt */}
          <div
            ref={previewRef}
            className="rounded-3xl overflow-hidden shadow-2xl border cursor-crosshair"
            onMouseMove={handlePreviewMouseMove}
            onMouseLeave={handlePreviewMouseLeave}
            style={{
              backgroundColor: theme.fond,
              borderColor: `${theme.accent}30`,
              transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${tilt.x !== 0 ? 15 : 0}px)`,
              transition: tilt.x === 0
                ? "transform 0.6s cubic-bezier(0.23,1,0.32,1), background-color 0.5s ease, border-color 0.5s ease, box-shadow 0.5s ease"
                : "transform 0.08s linear",
              boxShadow: tilt.x !== 0
                ? `${-tilt.y * 2}px ${tilt.x * 2}px 40px ${theme.accent}25, 0 20px 60px rgba(0,0,0,0.2)`
                : `0 20px 60px ${theme.accent}15`,
              opacity: transitioning ? 0 : 1,
              willChange: "transform",
            }}
          >
            <div className="p-6 border-b" style={{ borderColor: `${theme.accent}20` }}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-xl font-playfair" style={{ color: theme.accent }}>Boutique Demo</span>
                <span className="text-xs px-3 py-1 rounded-full animate-pulse" style={{ backgroundColor: `${theme.accent}20`, color: theme.accent }}>
                  ● Live preview
                </span>
              </div>
              <div
                className="aspect-video rounded-xl flex items-center justify-center transition-all duration-500"
                style={{ backgroundColor: theme.surface }}
              >
                <PreviewIcon size={56} style={{ filter: `drop-shadow(0 0 20px ${theme.accent}60)`, color: theme.accent }} />
              </div>
            </div>
            <div className="p-6">
              <h4 className="text-lg font-bold mb-2" style={{ color: theme.texte }}>{theme.preview.hero}</h4>
              <p className="text-2xl font-bold font-playfair mb-4" style={{ color: theme.accent }}>{theme.preview.prix}</p>
              <button
                className="w-full py-3 rounded-xl font-semibold transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                style={{ backgroundColor: theme.accent, color: theme.fond }}
              >
                Ajouter au panier
              </button>
            </div>
          </div>
        </div>

        <div
          className="text-center mt-12"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "flip3dIn 0.7s 600ms cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          <Link href="/themes"
            className="inline-flex items-center gap-2 border border-[#1B4FD8]/40 text-[#1B4FD8] px-6 py-3 rounded-xl hover:bg-blue-50 hover:scale-105 transition-all font-medium">
            Voir tous les thèmes →
          </Link>
        </div>
      </div>
    </section>
  );
}
