"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, RefreshCw, LifeBuoy } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { lienSignalement, CLE_DERNIERE_ERREUR } from "@/lib/signalements";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  const pathname = usePathname();
  useEffect(() => {
    console.error("[Dashboard Error]", error);
    // Gardée pour « Signaler un problème » : jointe automatiquement au signalement.
    const texte = [error.message, error.digest && `#${error.digest}`].filter(Boolean).join(" ").slice(0, 2000);
    try { sessionStorage.setItem(CLE_DERNIERE_ERREUR, JSON.stringify({ texte, date: Date.now() })); } catch {}
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <div className="text-center max-w-md">
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {t("Une erreur s'est produite")}
        </h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          {t("Le tableau de bord n'a pas pu se charger. Réessaie dans un instant.")}
        </p>
        {/* Texte exact de l'erreur : à envoyer au support (capture d'écran). */}
        {error.message && <p className="text-xs text-gray-500 mt-3 font-mono break-words">{error.message}</p>}
        {error.digest && (
          <p className="text-xs text-gray-400 mt-2 font-mono">#{error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-6 py-3 bg-[#F5A623] text-white font-semibold rounded-2xl hover:bg-[#e8950f] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#F5A623]/20"
      >
        <RefreshCw size={15} />
        {t("Réessayer")}
      </button>
      {/* Nouvelle version mise en ligne pendant que la page était ouverte : seul un vrai rechargement récupère ses fichiers. */}
      <button onClick={() => window.location.reload()} className="text-sm text-gray-500 underline hover:text-gray-800">
        {t("Recharger la page")}
      </button>
      <Link href={lienSignalement(pathname)} className="flex items-center gap-1.5 text-sm text-gray-500 underline hover:text-gray-800">
        <LifeBuoy size={14} />{t("Signaler ce problème")}
      </Link>
    </div>
  );
}
