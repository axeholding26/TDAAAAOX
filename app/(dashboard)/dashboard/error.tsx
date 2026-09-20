"use client";
import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Une erreur s'est produite
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          Le dashboard n'a pas pu se charger. Nos agents travaillent déjà sur le problème.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mt-2 font-mono">#{error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-6 py-3 bg-[#F5A623] text-white font-semibold rounded-2xl hover:bg-[#e8950f] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#F5A623]/20"
      >
        <RefreshCw size={15} />
        Réessayer
      </button>
    </div>
  );
}
