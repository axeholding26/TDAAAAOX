"use client";
import { useState } from "react";
import { Loader2, Lock, AlertCircle, Smartphone } from "lucide-react";
import { useT } from "@/components/I18nProvider";

export function NotchPayCheckout({
  commandeId,
  montant,
  devise,
  clientEmail,
  clientNom,
  clientTelephone,
  onError,
}: {
  commandeId: string;
  montant: number;
  devise: string;
  clientEmail: string;
  clientNom: string;
  clientTelephone?: string;
  onError?: (msg: string) => void;
}) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");

  async function payer() {
    setLoading(true);
    setErreur("");
    try {
      const res = await fetch("/api/paiements/notchpay/initier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commandeId,
          montant,
          devise,
          clientEmail,
          clientNom,
          clientTelephone,
          description: `Commande Axso #${commandeId.slice(-6).toUpperCase()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.authorizationUrl) throw new Error(data.error ?? "Erreur d'initialisation du paiement");
      window.location.href = data.authorizationUrl;
    } catch (e: any) {
      const msg = e.message ?? "Impossible de contacter NotchPay";
      setErreur(msg);
      onError?.(msg);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {erreur && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" />
          {t(erreur)}
        </div>
      )}
      <button
        type="button"
        onClick={payer}
        disabled={loading}
        className="w-full bg-[#5E6063] hover:bg-[#333333] text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" />{" "}{t("Redirection en cours...")}</>
        ) : (
          <>
            <Lock size={15} />
            {t("Payer")}{" "}{montant.toLocaleString()} {t(devise)}
          </>
        )}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
        <Smartphone size={12} />{" "}{t("Orange Money, MTN MoMo & carte bancaire · Paiement sécurisé NotchPay")}
      </p>
    </div>
  );
}
