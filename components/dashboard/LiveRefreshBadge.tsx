"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Rafraîchit silencieusement les données serveur de la page à intervalle
// régulier — le "temps réel" du Palier 2 sur des pages server-rendered
// (analytics), sans conversion complète en client component.
export function LiveRefreshBadge({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
      style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)", color: "#16A34A" }}>
      <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
      Temps réel
    </div>
  );
}
