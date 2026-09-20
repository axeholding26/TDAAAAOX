import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function QuotaBanner() {
  return (
    <Link href="/dashboard/abonnement"
      className="flex items-center gap-3 px-4 py-3 mb-4 rounded-2xl border transition-all hover:opacity-90"
      style={{ background: "rgba(239,68,68,0.06)", borderColor: "rgba(239,68,68,0.25)" }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(239,68,68,0.12)" }}>
        <AlertTriangle size={15} className="text-red-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-red-600">Quota de 30 commandes/mois atteint</p>
        <p className="text-xs text-red-500/80 leading-snug">
          Vous ne pouvez plus gérer vos commandes ni utiliser WhatsApp ce mois-ci — passez à un palier supérieur pour continuer sans interruption.
        </p>
      </div>
      <span className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full text-white whitespace-nowrap" style={{ background: "#ef4444" }}>
        Mettre à niveau
      </span>
    </Link>
  );
}
