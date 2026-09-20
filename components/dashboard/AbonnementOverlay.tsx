"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Lock } from "lucide-react";
import { PlansGrid } from "@/components/dashboard/PlansGrid";
import { NOMS_PALIERS, type Palier } from "@/lib/plans";

interface Etat {
  planActuel: Palier;
  nomPlan: string;
  nomBoutique: string | null;
  devise: string;
}

// Prend le dessus sur tout le dashboard (sidebar comprise) via un portail —
// c'est le point d'entrée unique déclenché par chaque cadenas de fonctionnalité
// hors plan, ainsi que par le lien "Abonnement" de la sidebar.
export function AbonnementOverlay({ palierRequis, onClose }: { palierRequis?: Palier; onClose: () => void }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    fetch("/api/abonnement/etat")
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setEtat)
      .catch(() => setErreur(true));
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] bg-white flex flex-col" style={{ animation: "axFadeIn 0.15s ease-out" }}>
      <style>{`@keyframes axFadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

      {/* Barre supérieure */}
      <div className="flex-shrink-0 h-14 flex items-center justify-between px-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {palierRequis && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/25">
              <Lock size={10} /> Réservé au Palier {NOMS_PALIERS[palierRequis]}
            </span>
          )}
        </div>
        <button onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Fermer">
          <X size={18} />
        </button>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {erreur && (
            <p className="text-center text-sm text-red-500 py-20">Impossible de charger votre abonnement. Réessayez.</p>
          )}
          {!erreur && !etat && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={22} className="animate-spin text-gray-300" />
            </div>
          )}
          {etat && (
            <PlansGrid planActuel={etat.planActuel} nomPlan={etat.nomPlan} devise={etat.devise} compact />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
