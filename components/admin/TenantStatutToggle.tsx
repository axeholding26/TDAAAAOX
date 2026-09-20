"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, Loader2 } from "lucide-react";

export function TenantStatutToggle({ tenantId, statutActuel }: { tenantId: string; statutActuel: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const suspendu = statutActuel === "suspendu";

  async function toggle() {
    const nouveauStatut = suspendu ? "active" : "suspendu";
    if (!confirm(`Confirmer : passer cette boutique en statut "${nouveauStatut}" ?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/statut`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: nouveauStatut }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(nouveauStatut === "suspendu" ? "Boutique suspendue" : "Boutique réactivée");
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
      style={
        suspendu
          ? { background: "rgba(22,163,74,0.12)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.25)" }
          : { background: "rgba(220,38,38,0.12)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.25)" }
      }
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : suspendu ? <CheckCircle2 size={12} /> : <Ban size={12} />}
      {suspendu ? "Réactiver" : "Suspendre"}
    </button>
  );
}
