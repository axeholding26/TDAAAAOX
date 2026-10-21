"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Lock } from "lucide-react";
import { PlansGrid } from "@/components/dashboard/PlansGrid";
import { NOMS_PALIERS, type Palier } from "@/lib/plans";
import { useT } from "@/components/I18nProvider";
import type { EssaiGrille } from "@/components/dashboard/PlansGrid";

interface Etat {
  planActuel: Palier;
  nomPlan: string;
  nomBoutique: string | null;
  devise: string;
  essai?: EssaiGrille;
}

// Prend le dessus sur tout le dashboard (sidebar comprise) via un portail —
// c'est le point d'entrée unique déclenché par chaque cadenas de fonctionnalité
// hors plan, ainsi que par le lien "Abonnement" de la sidebar.
// `actionSecondaire` : libellé d'un bouton qui ferme aussi (ex. « Continuer en Essentiel » à la fin de l'essai).
export function AbonnementOverlay({ palierRequis, message, onClose, actionSecondaire }: { palierRequis?: Palier; message?: string; onClose: () => void; actionSecondaire?: string }) {
  const t = useT();
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
    <div className="fixed inset-0 z-[10002] bg-white flex flex-col" style={{ animation: "axFadeIn 0.15s ease-out" }}>
      <style>{`@keyframes axFadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>

      {/* Barre supérieure */}
      <div className="flex-shrink-0 h-14 flex items-center justify-between px-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {palierRequis && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/25">
              <Lock size={10} />{" "}{t("Réservé au Palier")}{" "}{t(NOMS_PALIERS[palierRequis])}
            </span>
          )}
          {message && <p className="text-[13px] font-semibold text-[#111]">{t(message)}</p>}
        </div>
        <div className="flex items-center gap-2">
        {actionSecondaire && (
          <button onClick={onClose} className="h-9 px-4 rounded-xl text-[13px] font-semibold border border-gray-200 text-[#333] hover:bg-gray-50">{t(actionSecondaire)}</button>
        )}
        <button onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label={t("Fermer")}>
          <X size={18} />
        </button>
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {erreur && (
            <p className="text-center text-sm text-red-500 py-20">{t("Impossible de charger votre abonnement. Réessayez.")}</p>
          )}
          {!erreur && !etat && (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={22} className="animate-spin text-gray-300" />
            </div>
          )}
          {etat && (
            <PlansGrid planActuel={etat.planActuel} nomPlan={etat.nomPlan} devise={etat.devise} essai={etat.essai} compact />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
