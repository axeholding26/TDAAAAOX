"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2 } from "lucide-react";

export function MarquerRemisButton({ commandeIds }: { commandeIds: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function marquerRemis() {
    setLoading(true);
    try {
      const res = await fetch("/api/commandes/remise-cod", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandeIds }),
      });
      if (!res.ok) throw new Error();
      toast.success("Encaissement confirmé");
      router.refresh();
    } catch {
      toast.error("Erreur lors de la confirmation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={marquerRemis}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-semibold disabled:opacity-50"
      style={{ background: "#10b981" }}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
      {loading ? "Confirmation..." : "Marquer comme remis"}
    </button>
  );
}
