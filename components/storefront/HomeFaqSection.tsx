"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FaqItem { question: string; reponse: string }

export function HomeFaqSection({
  titre, layout, items, accent, texte, surface,
}: {
  titre: string;
  layout?: "accordion" | "grid" | "columns";
  items: FaqItem[];
  accent: string;
  texte: string;
  surface: string;
}) {
  const [ouvert, setOuvert] = useState<number | null>(0);
  if (!items?.length) return null;

  if (layout === "grid" || layout === "columns") {
    return (
      <section className="py-16 sm:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold font-playfair text-center mb-12" style={{ color: texte }}>{titre}</h2>
          <div className={`grid gap-5 ${layout === "columns" ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {items.map((it, i) => (
              <div key={i} className="p-5 rounded-2xl" style={{ background: surface, border: `1px solid ${accent}12` }}>
                <p className="font-semibold text-sm mb-2" style={{ color: texte }}>{it.question}</p>
                <p className="text-sm leading-relaxed" style={{ color: texte, opacity: 0.65 }}>{it.reponse}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  // accordion (défaut)
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold font-playfair text-center mb-12" style={{ color: texte }}>{titre}</h2>
        <div className="space-y-3">
          {items.map((it, i) => {
            const actif = ouvert === i;
            return (
              <div key={i} className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${accent}15`, background: surface }}>
                <button
                  onClick={() => setOuvert(actif ? null : i)}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                >
                  <span className="font-semibold text-sm" style={{ color: texte }}>{it.question}</span>
                  <ChevronDown size={16} style={{ color: accent, transform: actif ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                </button>
                {actif && (
                  <div className="px-5 pb-4 text-sm leading-relaxed" style={{ color: texte, opacity: 0.65 }}>
                    {it.reponse}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
