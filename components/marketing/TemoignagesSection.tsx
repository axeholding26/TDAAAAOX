"use client";
import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Star, BadgeCheck } from "lucide-react";
import type { AvisPublic } from "@/lib/avis-plateforme";
import { useT } from "@/components/I18nProvider";

type Temoignage = { nom: string; role: string; pays: string; note: number; texte: string; avatar: string; couleur: string; verifie?: boolean };

const COULEURS = ["#F5A623", "#10b981", "#111111", "#3b82f6", "#7c3aed"];

// Témoignages d'exemple, conservés pour l'instant (décision du 17/10/2026) : les avis réels
// validés dans /admin/avis passent devant eux. À retirer quand il y aura assez d'avis réels.
const temoignages: Temoignage[] = [
  {
    nom: "Fatou N.", role: "Cosmétiques · Douala-Akwa · Plan Pro depuis 3 mois", pays: "CM", note: 5,
    texte: "Avant AXSO, je vendais sur WhatsApp et je perdais des commandes tous les jours. Avec AXSO, j'encaisse tout via Orange Money directement.",
    avatar: "F", couleur: "#F5A623",
  },
  {
    nom: "Eric M.", role: "Mode homme · Yaoundé-Bastos · Plan Essentiel", pays: "CM", note: 5,
    texte: "J'avais peur que ce soit compliqué. En 3 minutes ma boutique était en ligne. Le premier paiement Orange Money est arrivé le même jour.",
    avatar: "E", couleur: "#10b981",
  },
  {
    nom: "Sandrine K.", role: "Alimentation · Douala-Bonamoussadi · Plan Illimité", pays: "CM", note: 5,
    texte: "Shopify, c'était impossible à payer en mobile money. AXSO est en français, je paie mon abonnement en Orange Money et le support me répond sur WhatsApp.",
    avatar: "S", couleur: "#111111",
  },
];

type Particle = { size: number; x: number; y: number; delay: number; duration: number };

function generateParticles(): Particle[] {
  return Array.from({ length: 12 }, (_, i) => ({
    size: 2 + Math.random() * 3,
    x: Math.random() * 100,
    y: Math.random() * 100,
    delay: i * 0.4,
    duration: 4 + Math.random() * 4,
  }));
}

export function TemoignagesSection({ reels = [] }: { reels?: AvisPublic[] }) {
  const tr = useT();
  const liste: Temoignage[] = [
    ...reels.map((a, i) => ({
      nom: a.auteurNom, pays: a.pays.length === 2 ? a.pays.toUpperCase() : a.pays, note: a.note, texte: a.texte, verifie: true,
      role: [a.auteurRole, a.boutique, a.ville].filter(Boolean).join(" · "),
      avatar: a.auteurNom.trim().charAt(0).toUpperCase(), couleur: COULEURS[i % COULEURS.length],
    })),
    ...temoignages,
  ];
  const [actif, setActif] = useState(0);
  const [dir, setDir] = useState<"left" | "right">("right");
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const sectionRef = useRef<HTMLElement>(null);

  // Généré côté client uniquement (après le montage) pour éviter un mismatch
  // d'hydratation : Math.random() donnerait des valeurs différentes entre le
  // rendu serveur et le rendu client s'il était calculé au niveau du module.
  useEffect(() => {
    setParticles(generateParticles());
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.2 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => navigate("right"), 5000);
    return () => clearInterval(timer);
  }, [actif, visible]);

  const navigate = (direction: "left" | "right") => {
    setDir(direction);
    setActif((p) =>
      direction === "right"
        ? (p + 1) % liste.length
        : (p - 1 + liste.length) % liste.length
    );
  };

  const t = liste[actif];

  return (
    <section ref={sectionRef} className="py-16 sm:py-24 bg-white relative overflow-hidden" id="temoignages">
      {/* Floating star particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute text-[#F5A623]"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              fontSize: `${p.size * 4}px`,
              opacity: 0,
              animation: visible
                ? `floatParticle ${p.duration}s ${p.delay}s ease-in-out infinite`
                : "none",
            }}
          >
            ★
          </div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div
          className="text-center mb-10 sm:mb-16"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "flip3dIn 0.7s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          <span className="text-[#111111] text-sm font-semibold uppercase tracking-widest mb-4 block">
            {tr("Témoignages")}
          </span>
          <h2 className="text-3xl sm:text-5xl font-bold text-gray-900">
            {tr("Ils vendent déjà avec Axso")}
          </h2>
        </div>

        {/* 3D Testimonial card */}
        <div
          className="relative mb-8 overflow-hidden"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "scaleReveal3d 0.7s 0.2s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          <div
            className="relative bg-gradient-to-br from-[#FFFBF2] to-white rounded-3xl border border-[#F5A623]/25 p-6 sm:p-12 text-center shadow-lg shadow-[#F5A623]/10"
            style={{
              transform: "perspective(1000px)",
              transformStyle: "preserve-3d",
            }}
          >
            {/* Glow behind avatar */}
            <div
              className="absolute top-8 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full blur-2xl opacity-30 transition-all duration-500"
              style={{ backgroundColor: t.couleur }}
            />

            <div className="flex justify-center gap-1 mb-4 sm:mb-6">
              {[...Array(t.note)].map((_, i) => (
                <Star
                  key={i}
                  className="text-[#F5A623]"
                  size={20}
                  fill="#F5A623"
                  style={{
                    animation: visible ? `floatParticle 2s ${i * 0.1}s ease-in-out infinite` : "none",
                    filter: "drop-shadow(0 0 4px rgba(245,166,35,0.6))",
                  }}
                />
              ))}
            </div>

            <blockquote
              className="text-base sm:text-xl text-gray-600 leading-relaxed mb-6 sm:mb-8 italic transition-all duration-400"
              key={actif}
              style={{
                animation: `${dir === "right" ? "slideRevealRight" : "slideRevealLeft"} 0.4s cubic-bezier(0.23,1,0.32,1) both`,
              }}
            >
              "{t.verifie ? t.texte : tr(t.texte)}"
            </blockquote>

            <div
              className="flex items-center justify-center gap-3 sm:gap-4 transition-all duration-400"
              key={`avatar-${actif}`}
              style={{
                animation: `scaleReveal3d 0.4s 0.1s cubic-bezier(0.23,1,0.32,1) both`,
              }}
            >
              <div
                className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold text-white shadow-2xl transition-all duration-500"
                style={{
                  backgroundColor: t.couleur,
                  boxShadow: `0 0 0 4px ${t.couleur}30, 0 8px 32px ${t.couleur}50`,
                }}
              >
                {tr(t.avatar)}
              </div>
              <div className="text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-gray-900 font-bold text-base sm:text-lg">{t.verifie ? t.nom : tr(t.nom)}</span>
                  {t.verifie && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700"><BadgeCheck size={11} />{tr("Avis vérifié")}</span>}
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 tracking-wide">{tr(t.pays)}</span>
                </div>
                <p className="text-gray-400 text-xs sm:text-sm">{t.verifie ? t.role : tr(t.role)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div
          className="flex items-center justify-center gap-4 sm:gap-6"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "flip3dIn 0.7s 0.5s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          <button
            onClick={() => navigate("left")}
            aria-label={tr("Témoignage précédent")}
            className="w-10 h-10 rounded-full bg-white border border-[#F5A623]/30 shadow-sm flex items-center justify-center text-[#F5A623] hover:bg-[#F5A623] hover:text-white active:scale-95 transition-all duration-200"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex gap-2">
            {liste.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDir(i > actif ? "right" : "left"); setActif(i); }}
                aria-label={`${i + 1}`}
                className="py-3 px-0.5"
              >
                <span
                  className={`block h-2 rounded-full transition-all duration-300 ${i === actif ? "w-8" : "w-2"}`}
                  style={{ backgroundColor: i === actif ? t.couleur : "#e5e7eb" }}
                />
              </button>
            ))}
          </div>
          <button
            onClick={() => navigate("right")}
            aria-label={tr("Témoignage suivant")}
            className="w-10 h-10 rounded-full bg-white border border-[#F5A623]/30 shadow-sm flex items-center justify-center text-[#F5A623] hover:bg-[#F5A623] hover:text-white active:scale-95 transition-all duration-200"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
