"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Crown } from "lucide-react";
import { useT } from "@/components/I18nProvider";

// Affiché quand un marchand palier Essentiel est redirigé automatiquement
// depuis AXIA (voir app/(dashboard)/dashboard/page.tsx) — explique pourquoi,
// une seule fois, puis nettoie l'URL pour ne pas re-déclencher au rafraîchissement.
export function AxiaProNotice() {
  const t = useT();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("axia") !== "pro") return;
    toast.custom(() => (
      <div className="flex items-start gap-3 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 max-w-sm">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,166,35,0.12)" }}>
          <Crown size={15} className="text-[#F5A623]" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#5E6063]">{t("AXIA plein écran est une fonctionnalité Pro")}</p>
          <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">
            {t("Tu retrouves ici le tableau de bord classique.")}{" "}<Link href="/dashboard/abonnement" className="text-[#F5A623] font-semibold underline">{t("Passer au palier Pro")}</Link>{" "}{t("pour débloquer AXIA en écran d'accueil.")}
          </p>
        </div>
      </div>
    ), { duration: 7000 });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("axia");
    router.replace(params.size ? `/dashboard/accueil?${params}` : "/dashboard/accueil", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}
