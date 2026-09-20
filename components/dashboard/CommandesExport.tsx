"use client";
import { useState } from "react";
import { Download, Loader2, FileSpreadsheet } from "lucide-react";

interface Props {
  total?: number;
}

export function CommandesExport({ total }: Props) {
  const [loading, setLoading] = useState(false);

  const exporter = async (filtre?: "mois" | "tout") => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtre === "mois") {
        const debut = new Date();
        debut.setDate(1);
        params.set("depuis", debut.toISOString());
      }
      const res = await fetch(`/api/commandes/export?${params.toString()}`);
      if (!res.ok) throw new Error("Erreur export");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `commandes-axso-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => exporter("mois")}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />}
        Ce mois
      </button>
      <button
        onClick={() => exporter("tout")}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
        Tout ({total ?? "—"})
      </button>
    </div>
  );
}
