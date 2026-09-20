"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BadgeCheck, Ban, CheckCircle2, Crown, Gift, Loader2, Trash2, RotateCcw } from "lucide-react";

const PLANS = [
  { id: "palier0", label: "Essentiel (gratuit)" },
  { id: "palier1", label: "Pro" },
  { id: "palier2", label: "Illimité" },
];

interface Props {
  tenantId: string;
  statut: string;
  planType: string;
  certifie: boolean;
  devise: string;
}

const btnBase = "flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-50";
const inputCls = "px-3 py-2.5 text-sm rounded-lg border focus:outline-none w-full";
const inputStyle = { background: "#141414", borderColor: "rgba(255,255,255,0.12)", color: "#FFFFFF" };

export function BoutiqueActionsPanel({ tenantId, statut, planType, certifie, devise }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [plan, setPlan] = useState(planType);
  const [jours, setJours] = useState("30");
  const [bonus, setBonus] = useState({ montant: "", raison: "", titre: "", emoji: "🏆" });

  async function appel(key: string, url: string, body: any, msg: string) {
    setLoading(key);
    try {
      const res = await fetch(url, { method: url.includes("recompense") ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(msg);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Statut & suppression */}
      <div className="rounded-2xl p-6 border space-y-4" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <h3 className="font-semibold text-sm" style={{ color: "#FFFFFF" }}>Statut de la boutique</h3>
        <div className="flex flex-wrap gap-2">
          {statut !== "active" && statut !== "supprime" && (
            <button disabled={loading !== null} onClick={() => appel("active", `/api/admin/tenants/${tenantId}/statut`, { statut: "active" }, "Boutique réactivée")}
              className={btnBase} style={{ background: "rgba(22,163,74,0.12)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.25)" }}>
              {loading === "active" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Réactiver
            </button>
          )}
          {statut === "active" && (
            <button disabled={loading !== null} onClick={() => appel("suspendu", `/api/admin/tenants/${tenantId}/statut`, { statut: "suspendu" }, "Boutique suspendue")}
              className={btnBase} style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.25)" }}>
              {loading === "suspendu" ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Suspendre
            </button>
          )}
          {statut !== "supprime" ? (
            <button disabled={loading !== null} onClick={() => { if (confirm("Supprimer cette boutique ? Elle disparaît de la vitrine publique et des listes marchandes. Les données restent conservées (audit/finance) et une restauration reste possible.")) appel("supprime", `/api/admin/tenants/${tenantId}/statut`, { statut: "supprime" }, "Boutique supprimée"); }}
              className={btnBase} style={{ background: "rgba(220,38,38,0.12)", color: "#DC2626", border: "1px solid rgba(220,38,38,0.25)" }}>
              {loading === "supprime" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Supprimer
            </button>
          ) : (
            <button disabled={loading !== null} onClick={() => appel("restaure", `/api/admin/tenants/${tenantId}/statut`, { statut: "active" }, "Boutique restaurée")}
              className={btnBase} style={{ background: "rgba(96,165,250,0.12)", color: "#F5A623", border: "1px solid rgba(96,165,250,0.25)" }}>
              {loading === "restaure" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Restaurer
            </button>
          )}
        </div>

        <h3 className="font-semibold text-sm pt-2" style={{ color: "#FFFFFF" }}>Certification</h3>
        <button disabled={loading !== null} onClick={() => appel("certifie", `/api/admin/tenants/${tenantId}/certifie`, { certifie: !certifie }, certifie ? "Certification retirée" : "Boutique certifiée")}
          className={btnBase} style={certifie
            ? { background: "rgba(96,165,250,0.12)", color: "#F5A623", border: "1px solid rgba(96,165,250,0.25)" }
            : { background: "rgba(255,255,255,0.04)", color: "#AAAAAA", border: "1px solid rgba(255,255,255,0.1)" }}>
          {loading === "certifie" ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
          {certifie ? "Retirer la certification" : "Certifier cette boutique"}
        </button>
      </div>

      {/* Plan */}
      <div className="rounded-2xl p-6 border space-y-3" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <Crown size={15} style={{ color: "#F5A623" }} />
          <h3 className="font-semibold text-sm" style={{ color: "#FFFFFF" }}>Changer le palier</h3>
        </div>
        <select value={plan} onChange={e => setPlan(e.target.value)} className={inputCls} style={inputStyle}>
          {PLANS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {plan !== "palier0" && (
          <input type="number" placeholder="Durée (jours)" value={jours} onChange={e => setJours(e.target.value)} className={inputCls} style={inputStyle} />
        )}
        <button disabled={loading !== null} onClick={() => appel("plan", `/api/admin/tenants/${tenantId}/plan`, { plan, jours }, "Plan mis à jour")}
          className={btnBase} style={{ background: "linear-gradient(135deg,#F5A623,#D4911A)", color: "#111111" }}>
          {loading === "plan" ? <Loader2 size={14} className="animate-spin" /> : <Crown size={14} />} Appliquer le plan
        </button>
      </div>

      {/* Récompense */}
      <div className="rounded-2xl p-6 border space-y-3 lg:col-span-2" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <Gift size={15} style={{ color: "#F5A623" }} />
          <h3 className="font-semibold text-sm" style={{ color: "#FFFFFF" }}>Récompenser ce marchand</h3>
        </div>
        <p className="text-xs" style={{ color: "#AAAAAA" }}>Le bonus est prélevé sur le wallet plateforme (argent réel) et crédité directement au marchand. Le trophée est purement symbolique.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="number" placeholder={`Bonus (${devise}) — optionnel`} value={bonus.montant} onChange={e => setBonus(b => ({ ...b, montant: e.target.value }))} className={inputCls} style={inputStyle} />
          <input placeholder="Raison" value={bonus.raison} onChange={e => setBonus(b => ({ ...b, raison: e.target.value }))} className={inputCls} style={inputStyle} />
          <input placeholder="Titre du trophée — optionnel" value={bonus.titre} onChange={e => setBonus(b => ({ ...b, titre: e.target.value }))} className={inputCls} style={inputStyle} />
          <input placeholder="Emoji" value={bonus.emoji} onChange={e => setBonus(b => ({ ...b, emoji: e.target.value }))} className={inputCls} style={inputStyle} />
        </div>
        <button disabled={loading !== null} onClick={() => appel("recompense", `/api/admin/tenants/${tenantId}/recompense`, bonus, "Récompense envoyée")}
          className={btnBase} style={{ background: "linear-gradient(135deg,#F5A623,#D4911A)", color: "#111111" }}>
          {loading === "recompense" ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />} Envoyer la récompense
        </button>
      </div>
    </div>
  );
}
