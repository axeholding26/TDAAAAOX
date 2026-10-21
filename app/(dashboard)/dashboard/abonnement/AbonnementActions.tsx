"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/I18nProvider";

interface AbonnementActionsProps {
  planId: string;
  planActuel: string;
  couleur: string;
}

const ORDRE: Record<string, number> = {
  palier0: 0,
  palier1: 1,
  palier2: 2,
};

export default function AbonnementActions({
  planId,
  planActuel,
  couleur,
}: AbonnementActionsProps) {
  const t = useT();
  const router = useRouter();
  const [loading, setLoading] = useState<"" | "notchpay">("");

  const estActuel = planId === planActuel;
  const estSuperieur = ORDRE[planId] > ORDRE[planActuel];

  async function appeler(url: string, body: object) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erreur inconnue");
    return data;
  }

  async function choisirPlan() {
    if (estActuel && planId === "palier0") return;
    try {
      if (planId === "palier0") {
        if (!window.confirm(t("Toutes tes boutiques repasseront en Essentiel et les jours payés restants seront perdus. Continuer ?"))) return;
        setLoading("notchpay");
        await appeler("/api/abonnement/changer", { plan: planId });
        toast.success(t("Plan Essentiel activé"));
        router.refresh();
      } else {
        setLoading("notchpay");
        const data = await appeler("/api/abonnement/paiement", { plan: planId });
        window.location.href = data.authorizationUrl;
      }
    } catch (err: any) {
      toast.error(t(err.message) ?? t("Erreur lors du changement de plan"));
    } finally {
      setLoading("");
    }
  }

  if (estActuel && planId === "palier0") {
    return (
      <button
        disabled
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-gray-400 bg-gray-100 border border-gray-200 cursor-default"
      >
        {t("Plan actuel")}
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={choisirPlan}
        disabled={!!loading}
        className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-70"
        style={
          estSuperieur || estActuel
            ? {
                backgroundColor: couleur,
                color: couleur === "#F5A623" ? "#1a1a1a" : "#ffffff",
                boxShadow: `0 2px 8px ${couleur}30`,
              }
            : {
                backgroundColor: "#f3f4f6",
                color: "#6b7280",
                border: "1px solid #e5e7eb",
              }
        }
      >
        {loading === "notchpay" && <Loader2 size={14} className="animate-spin" />}
        {loading === "notchpay"
          ? t("Changement...")
          : estActuel
          ? t("Renouveler (+30 jours)")
          : estSuperieur
          ? t("Choisir ce plan")
          : t("Rétrograder")}
      </button>
    </div>
  );
}
