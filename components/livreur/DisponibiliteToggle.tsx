"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";

interface Props {
  livreurId: string;
  disponible: boolean;
}

export function DisponibiliteToggle({ livreurId, disponible: initial }: Props) {
  const t = useT();
  const [disponible, setDisponible] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/livreurs/${livreurId}/disponibilite`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json();
        setDisponible(data.disponible);
        toast.success(data.disponible ? t("Vous êtes disponible") : t("Vous êtes hors service"));
      }
    } catch {
      toast.error(t("Erreur"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
        disponible
          ? "bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20"
          : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
      } disabled:opacity-50`}
    >
      <div className={`w-2 h-2 rounded-full ${disponible ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
      {disponible ? t("Disponible") : t("Hors service")}
    </button>
  );
}
