"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Radio } from "lucide-react";

const LiveFleetMapInner = dynamic(
  () => import("./LiveFleetMapInner").then((m) => m.LiveFleetMapInner),
  { ssr: false }
);

interface Livreur {
  id: string;
  nom: string;
  vehicule: string;
  disponible: boolean;
  latitude: number | null;
  longitude: number | null;
  positionAt: string | null;
}

export function LiveFleetMap() {
  const [livreurs, setLivreurs] = useState<Livreur[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let annule = false;
    function charger() {
      fetch("/api/livreurs")
        .then((r) => r.json())
        .then((d) => { if (!annule) { setLivreurs(d.livreurs ?? []); setLoading(false); } })
        .catch(() => { if (!annule) setLoading(false); });
    }
    charger();
    const interval = setInterval(charger, 20000);
    return () => { annule = true; clearInterval(interval); };
  }, []);

  const positionnes = livreurs.filter((l) => l.latitude && l.longitude);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[360px] bg-gray-50 rounded-2xl border border-gray-100">
        <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12px] text-gray-400">
          <Radio size={12} className="text-green-500" />
          {positionnes.length} livreur{positionnes.length !== 1 ? "s" : ""} en position sur {livreurs.length}
        </div>
      </div>
      {positionnes.length === 0 ? (
        <div className="flex items-center justify-center h-[360px] bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center px-6">
          <p className="text-[13px] text-gray-400">Aucun livreur ne partage sa position pour le moment — la carte s'activera dès qu'un livreur ouvrira son lien de tracking GPS.</p>
        </div>
      ) : (
        <LiveFleetMapInner livreurs={livreurs} />
      )}
    </div>
  );
}
