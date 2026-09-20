"use client";
import { useState } from "react";
import { Check, Loader2, PackageCheck } from "lucide-react";

interface Props {
  commandeId: string;
  slug: string;
  accent: string;
  fond: string;
}

export function ConfirmReceptionButton({ commandeId, slug, accent, fond }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function confirmer() {
    if (state !== "idle") return;
    setState("loading");
    try {
      const res = await fetch(`/api/commandes/${commandeId}/confirmer-reception`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setState("done");
    } catch {
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div
        className="flex flex-col items-center gap-3 py-6 text-center"
        style={{ animation: "fadeIn .4s ease" }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            boxShadow: `0 0 32px ${accent}55`,
            animation: "scaleIn .35s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <Check size={32} color={fond} strokeWidth={3} />
        </div>
        <p className="font-bold text-base" style={{ color: accent }}>Réception confirmée !</p>
        <p className="text-sm opacity-60">Merci. Le marchand a été notifié.</p>
        <style>{`
          @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
          @keyframes scaleIn { from{transform:scale(0)} to{transform:scale(1)} }
        `}</style>
      </div>
    );
  }

  return (
    <button
      onClick={confirmer}
      disabled={state === "loading"}
      className="relative w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-base transition-all overflow-hidden group"
      style={{
        background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
        color: fond,
        boxShadow: `0 4px 20px ${accent}40`,
        opacity: state === "loading" ? 0.8 : 1,
      }}
    >
      {/* shimmer */}
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.25) 50%, transparent 70%)`,
          backgroundSize: "200% 100%",
          animation: "shimmerBtn 1.4s linear infinite",
        }}
      />
      {state === "loading" ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          <span>Confirmation en cours…</span>
        </>
      ) : (
        <>
          <PackageCheck size={18} />
          <span>J'ai bien reçu ma commande</span>
        </>
      )}
      <style>{`@keyframes shimmerBtn { 0%{background-position:-200% 0} 100%{background-position:200% 0} }`}</style>
    </button>
  );
}
