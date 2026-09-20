"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Props {
  slug: string; accent: string; texte: string;
  titre?: string; texteDesc?: string; dateFin?: string; ctaTexte?: string;
}

function calc(dateFin?: string) {
  if (!dateFin) return { j: 0, h: 0, m: 0, s: 0, fini: true };
  const diff = new Date(dateFin).getTime() - Date.now();
  if (diff <= 0) return { j: 0, h: 0, m: 0, s: 0, fini: true };
  return {
    j: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    fini: false,
  };
}

export function SectionCountdown({ slug, accent, texte, titre, texteDesc, dateFin, ctaTexte }: Props) {
  const [t, setT] = useState(() => calc(dateFin));

  useEffect(() => {
    const id = setInterval(() => setT(calc(dateFin)), 1000);
    return () => clearInterval(id);
  }, [dateFin]);

  if (t.fini) return null;

  return (
    <section className="py-16" style={{ background: `${accent}08` }}>
      <div className="max-w-3xl mx-auto px-4 text-center">
        {titre && <h2 className="text-3xl font-bold font-playfair mb-3" style={{ color: texte }}>{titre}</h2>}
        {texteDesc && <p className="text-base mb-8" style={{ color: texte, opacity: 0.65 }}>{texteDesc}</p>}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[["Jours", t.j], ["Heures", t.h], ["Min", t.m], ["Sec", t.s]].map(([label, val]) => (
            <div key={label as string} className="flex flex-col items-center">
              <div className="rounded-2xl w-16 h-16 flex items-center justify-center text-2xl font-bold"
                style={{ background: "white", color: accent, border: `2px solid ${accent}30` }}>
                {String(val).padStart(2, "0")}
              </div>
              <span className="text-xs mt-2 uppercase tracking-widest" style={{ color: texte, opacity: 0.4 }}>{label}</span>
            </div>
          ))}
        </div>
        {ctaTexte && (
          <Link href={`/${slug}/produits`} className="inline-flex px-8 py-4 rounded-2xl font-bold text-sm text-white" style={{ background: accent }}>
            {ctaTexte}
          </Link>
        )}
      </div>
    </section>
  );
}
