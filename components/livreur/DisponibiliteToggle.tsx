"use client";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  livreurId: string;
  disponible: boolean;
}

export function DisponibiliteToggle({ livreurId, disponible: initial }: Props) {
  const [disponible, setDisponible] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/livreurs/${livreurId}/disponibilite`, { method: "PATCH" });
      if (res.ok) {
        const data = await res.json();
        setDisponible(data.disponible);
        toast.success(data.disponible ? "Vous êtes disponible" : "Vous êtes hors service");
      }
    } catch {
      toast.error("Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
        disponible
          ? "bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20"
          : "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20"
      } disabled:opacity-50`}
    >
      <div className={`w-2 h-2 rounded-full ${disponible ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
      {disponible ? "Disponible" : "Hors service"}
    </button>
  );
}
