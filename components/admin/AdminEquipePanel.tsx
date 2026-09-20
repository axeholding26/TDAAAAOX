"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2, Loader2, ShieldCheck, Eye } from "lucide-react";

interface Membre { id: string; email: string; name: string | null; role: string; createdAt: string }

export function AdminEquipePanel({ peutInviter, monId }: { peutInviter: boolean; monId: string }) {
  const [membres, setMembres] = useState<Membre[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "" });

  async function charger() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/equipe");
      const data = await res.json();
      setMembres(data.membres ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { charger(); }, []);

  async function inviter(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() || form.password.length < 6) { toast.error("Email valide et mot de passe (6+ caractères) requis"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/equipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Membre invité en lecture seule");
      setForm({ email: "", password: "", name: "" });
      charger();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setSubmitting(false);
    }
  }

  async function revoquer(id: string) {
    if (!confirm("Révoquer l'accès de ce membre ?")) return;
    try {
      const res = await fetch(`/api/admin/equipe/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Accès révoqué");
      charger();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    }
  }

  return (
    <div className="space-y-6">
      {peutInviter && (
        <form onSubmit={inviter} className="rounded-2xl p-6 border space-y-3" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-1">
            <UserPlus size={16} style={{ color: "#F5A623" }} />
            <h2 className="font-semibold" style={{ color: "#FFFFFF" }}>Inviter un membre (lecture seule)</h2>
          </div>
          <p className="text-xs mb-3" style={{ color: "#AAAAAA" }}>
            Le compte pourra consulter tout le panneau admin (boutiques, finances, abonnements) mais ne pourra jamais suspendre une boutique, retirer des fonds ou inviter d'autres membres.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <input placeholder="Nom" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="px-3 py-2.5 text-sm rounded-lg border focus:outline-none" style={{ background: "#141414", borderColor: "rgba(255,255,255,0.1)", color: "#FFFFFF" }} />
            <input type="email" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="px-3 py-2.5 text-sm rounded-lg border focus:outline-none" style={{ background: "#141414", borderColor: "rgba(255,255,255,0.1)", color: "#FFFFFF" }} />
            <input type="password" placeholder="Mot de passe" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="px-3 py-2.5 text-sm rounded-lg border focus:outline-none" style={{ background: "#141414", borderColor: "rgba(255,255,255,0.1)", color: "#FFFFFF" }} />
          </div>
          <button type="submit" disabled={submitting}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#F5A623,#D4911A)", color: "#111111" }}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Inviter
          </button>
        </form>
      )}

      <div className="rounded-2xl overflow-hidden border" style={{ background: "#1A1A1A", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="px-6 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="font-semibold" style={{ color: "#FFFFFF" }}>Membres du panneau admin</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={18} className="animate-spin" style={{ color: "#AAAAAA" }} /></div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            {membres.map(m => (
              <div key={m.id} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "rgba(245,166,35,0.12)", color: "#F5A623" }}>
                    {(m.name || m.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: "#FFFFFF" }}>{m.name || m.email}</p>
                    <p className="text-xs" style={{ color: "#AAAAAA" }}>{m.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={m.role === "admin" ? { background: "rgba(22,163,74,0.15)", color: "#16A34A" } : { background: "rgba(245,166,35,0.15)", color: "#F5A623" }}>
                    {m.role === "admin" ? <ShieldCheck size={10} /> : <Eye size={10} />}
                    {m.role === "admin" ? "Super Admin" : "Lecture seule"}
                  </span>
                  {peutInviter && m.role === "admin_lecteur" && m.id !== monId && (
                    <button onClick={() => revoquer(m.id)} className="p-1.5 rounded-lg transition-all hover:bg-white/5" style={{ color: "#DC2626" }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
