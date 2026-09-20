"use client";
import { Lock, Sparkles } from "lucide-react";
import { useAbonnementOverlay } from "@/components/dashboard/AbonnementOverlayProvider";

interface Props {
  titre: string;
  description: string;
  palierRequis?: "palier1" | "palier2";
  // Contenu flouté en arrière-plan pour donner envie d'upgrader (aperçu de ce
  // qui est débloqué), optionnel — sans lui, affiche juste la carte verrouillée.
  apercu?: React.ReactNode;
}

const LABEL_PALIER: Record<string, string> = { palier1: "Pro", palier2: "Illimité" };

export function UpgradeGate({ titre, description, palierRequis = "palier2", apercu }: Props) {
  const { openAbonnement } = useAbonnementOverlay();
  return (
    <div className="relative rounded-2xl overflow-hidden border border-gray-100 bg-white">
      {apercu && (
        <div className="pointer-events-none select-none opacity-40" style={{ filter: "blur(3px)" }}>
          {apercu}
        </div>
      )}
      <div className={apercu ? "absolute inset-0 flex items-center justify-center p-6" : "flex items-center justify-center p-10"}
        style={apercu ? { background: "rgba(255,255,255,0.55)" } : undefined}>
        <div className="max-w-sm text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F5A623]/10 border border-[#F5A623]/25 flex items-center justify-center mx-auto">
            <Lock size={18} className="text-[#F5A623]" />
          </div>
          <h3 className="font-bold text-gray-900">{titre}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
          <button type="button" onClick={() => openAbonnement(palierRequis)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-white px-4 py-2.5 rounded-xl transition-all hover:opacity-90"
            style={{ background: "#F5A623", boxShadow: "0 4px 16px rgba(245,166,35,0.3)" }}>
            <Sparkles size={13} /> Passer au Palier {LABEL_PALIER[palierRequis]}
          </button>
        </div>
      </div>
    </div>
  );
}
