"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

const THEMES_PREVIEW = [
  { nom: "Noir Obsidien", fond: "#0a0a0a", accent: "#F5A623", texte: "#F5F5F0" },
  { nom: "Or Royal",      fond: "#FFFBF2", accent: "#F5A623", texte: "#111111" },
  { nom: "Encre & Or",    fond: "#111111", accent: "#FFD280", texte: "#FFF6E0" },
  { nom: "Kente Royal",   fond: "#141414", accent: "#F5A623", texte: "#FFF8E8" },
];

const POINTS = [
  "Glisser-déposer, sans code",
  "Sous-sections personnalisées dans chaque bloc",
  "Thèmes adaptés aux marchés africains",
];

export function ConstructeurSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.15 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 bg-white overflow-hidden">
      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="grid lg:grid-cols-2 gap-14 items-center max-w-[1400px] mx-auto">

          <div style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-24px)", transition: "all 0.8s cubic-bezier(0.23,1,0.32,1)" }}>
            <span className="text-[#F5A623] text-sm font-bold uppercase tracking-widest mb-4 block">Constructeur</span>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#111111] mb-5 leading-[1.08]">
              Crée une boutique sur-mesure en quelques secondes
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-lg">
              Des thèmes prêts à vendre, personnalisables jusqu'au moindre détail — sans une ligne de code.
            </p>
            <ul className="space-y-3 mb-9">
              {POINTS.map(p => (
                <li key={p} className="flex items-center gap-3 text-[15px] text-gray-700">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#F5A62318" }}>
                    <Check size={11} style={{ color: "#F5A623" }} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
            <Link href="/inscription" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-white transition-transform hover:scale-[1.03]"
              style={{ background: "#111111" }}>
              Essayer le constructeur →
            </Link>
          </div>

          <div style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(24px)", transition: "all 0.8s 0.1s cubic-bezier(0.23,1,0.32,1)" }}>
            <div className="grid grid-cols-2 gap-4">
              {THEMES_PREVIEW.map((t, i) => (
                <div key={t.nom} className="rounded-2xl overflow-hidden shadow-lg border border-gray-100"
                  style={{ animation: visible ? `flip3dIn 0.7s ${i * 100}ms cubic-bezier(0.23,1,0.32,1) both` : "none" }}>
                  <div className="h-24 flex items-center justify-center" style={{ backgroundColor: t.fond }}>
                    <span className="font-bold text-sm" style={{ color: t.accent }}>{t.nom}</span>
                  </div>
                  <div className="p-3 space-y-1.5" style={{ backgroundColor: t.fond }}>
                    <div className="h-2 w-3/4 rounded-full" style={{ background: `${t.texte}25` }} />
                    <div className="h-2 w-1/2 rounded-full" style={{ background: `${t.texte}18` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
