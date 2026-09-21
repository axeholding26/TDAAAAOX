"use client";

// Choix d'un gabarit de départ pour une boutique digitale — insère un VRAI
// arbre de blocs (voir digitalStarterTemplates.ts), édité ensuite avec
// exactement les mêmes outils que le Constructeur physique (texte, position,
// boutons, couleurs). Affiché une seule fois, quand le canevas est vide
// (voir BuilderCanvas::emptyStateExtra) — après le premier choix, plus de
// picker, juste le canevas comme n'importe quelle boutique.
import type { ThemeConfig } from "@/lib/theme-config";
import { DIGITAL_STARTER_TEMPLATES } from "./digitalStarterTemplates";

interface Props {
  set: (updater: (p: ThemeConfig) => ThemeConfig) => void;
}

export function DigitalStarterPicker({ set }: Props) {
  const choisir = (id: (typeof DIGITAL_STARTER_TEMPLATES)[number]["id"]) => {
    const tpl = DIGITAL_STARTER_TEMPLATES.find((t) => t.id === id)!;
    set((p) => ({
      ...p,
      builderTree: tpl.build(),
      colors: { ...p.colors, ...tpl.colors },
      radius: tpl.radius,
    }));
  };

  return (
    <div className="max-w-2xl mx-auto text-center">
      <p className="text-sm font-semibold text-gray-700 mb-1">Choisis un gabarit pour démarrer</p>
      <p className="text-[13px] text-gray-400 mb-6">Tu pourras ensuite modifier chaque texte, couleur, bouton et position librement.</p>
      <div className="grid grid-cols-2 gap-3">
        {DIGITAL_STARTER_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => choisir(t.id)}
            className="rounded-xl border border-gray-200 hover:border-[#F5A623] overflow-hidden text-left transition-all"
          >
            <div className="h-20 flex items-center gap-1.5 px-4" style={{ backgroundColor: t.colors.fond }}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.colors.accent }} />
              <div className="flex-1 space-y-1.5">
                <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: t.colors.texte, opacity: 0.85 }} />
                <div className="h-2 w-1/2 rounded-full" style={{ backgroundColor: t.colors.texte, opacity: 0.3 }} />
              </div>
            </div>
            <div className="px-3.5 py-3">
              <p className="text-sm font-semibold text-gray-800">{t.label}</p>
              <p className="text-[12px] text-gray-400 mt-0.5">{t.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
