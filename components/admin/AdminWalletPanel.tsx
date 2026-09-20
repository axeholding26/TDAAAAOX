"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet, ArrowUpFromLine, Loader2, Smartphone, Building2, ShieldCheck } from "lucide-react";

interface RetraitItem {
  id: string; montant: number; devise: string; methode: string;
  destinataire: string; operateur?: string; statut: string; createdAt: string;
}
interface WalletData {
  solde: number; totalRecu: number; totalRetire: number; devise: string;
  retraits: RetraitItem[];
}

const OPERATEURS = [
  { id: "MTN", label: "MTN Mobile Money" },
  { id: "Orange", label: "Orange Money" },
];

function fmt(n: number, devise = "XAF") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: devise, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

const STATUT_LABEL: Record<string, { label: string; color: string }> = {
  en_attente: { label: "En attente", color: "#D97706" },
  traitement: { label: "En traitement", color: "#AAAAAA" },
  complete: { label: "Complété", color: "#16A34A" },
  echoue: { label: "Échoué (remboursé)", color: "#DC2626" },
};

export function AdminWalletPanel({ peutRetirer }: { peutRetirer: boolean }) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ montant: "", methode: "mobile_money" as "mobile_money" | "virement_bancaire", operateur: "MTN", destinataire: "" });

  async function charger() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/wallet");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur de chargement");
      // Un wallet fraîchement créé (aucune commission encaissée pour l'instant)
      // n'a pas encore de ligne en base — on affiche un état à 0, jamais un
      // chargement infini.
      setWallet(data.wallet ?? { solde: 0, totalRecu: 0, totalRetire: 0, devise: "XAF", retraits: [] });
    } catch (e: any) {
      toast.error(e.message ?? "Impossible de charger le wallet plateforme");
      setWallet({ solde: 0, totalRecu: 0, totalRetire: 0, devise: "XAF", retraits: [] });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { charger(); }, []);

  async function retirer(e: React.FormEvent) {
    e.preventDefault();
    if (!form.montant || Number(form.montant) <= 0) { toast.error("Montant invalide"); return; }
    if (!form.destinataire.trim()) { toast.error("Destinataire requis"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/wallet/retrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Retrait initié");
      setForm({ montant: "", methode: "mobile_money", operateur: "MTN", destinataire: "" });
      setShowForm(false);
      charger();
    } catch (e: any) {
      toast.error(e.message ?? "Erreur retrait");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl p-6 border" style={{ background: "#1A1A1A", borderColor: "rgba(245,166,35,0.25)" }}>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.25)" }}>
            <Wallet size={18} style={{ color: "#F5A623" }} />
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: "#ffffff" }}>Wallet Axso</h2>
            <p className="text-xs" style={{ color: "#AAAAAA" }}>Commission + revenus d'abonnement — argent réellement reçu via NotchPay</p>
          </div>
        </div>
        {peutRetirer && (
          <button
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
            style={{ background: "linear-gradient(135deg,#F5A623,#D4911A)", color: "#111111" }}
          >
            <ArrowUpFromLine size={14} /> Retirer
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: "#AAAAAA" }} /></div>
      ) : wallet ? (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-2xl font-bold" style={{ color: "#F5A623" }}>{fmt(wallet.solde, wallet.devise)}</p>
              <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>Solde disponible</p>
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: "#ffffff" }}>{fmt(wallet.totalRecu, wallet.devise)}</p>
              <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>Total encaissé</p>
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: "#ffffff" }}>{fmt(wallet.totalRetire, wallet.devise)}</p>
              <p className="text-xs mt-1" style={{ color: "#AAAAAA" }}>Total retiré</p>
            </div>
          </div>

          {showForm && peutRetirer && (
            <form onSubmit={retirer} className="rounded-xl p-4 mb-6 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "#16A34A" }}>
                <ShieldCheck size={12} /> Débit atomique + remboursement automatique en cas d'échec NotchPay
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <input
                  type="number" placeholder="Montant (FCFA)" value={form.montant}
                  onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                  className="px-3 py-2.5 text-sm rounded-lg border focus:outline-none"
                  style={{ background: "#141414", borderColor: "rgba(255,255,255,0.1)", color: "#ffffff" }}
                />
                <select
                  value={form.methode}
                  onChange={e => setForm(f => ({ ...f, methode: e.target.value as any }))}
                  className="px-3 py-2.5 text-sm rounded-lg border focus:outline-none"
                  style={{ background: "#141414", borderColor: "rgba(255,255,255,0.1)", color: "#ffffff" }}
                >
                  <option value="mobile_money">Mobile Money</option>
                  <option value="virement_bancaire">Virement bancaire</option>
                </select>
              </div>
              {form.methode === "mobile_money" && (
                <div className="flex gap-2">
                  {OPERATEURS.map(op => (
                    <button key={op.id} type="button" onClick={() => setForm(f => ({ ...f, operateur: op.id }))}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all"
                      style={form.operateur === op.id
                        ? { background: "rgba(245,166,35,0.15)", borderColor: "#F5A623", color: "#F5A623" }
                        : { background: "transparent", borderColor: "rgba(255,255,255,0.1)", color: "#AAAAAA" }}>
                      <Smartphone size={11} /> {op.label}
                    </button>
                  ))}
                </div>
              )}
              <input
                placeholder={form.methode === "mobile_money" ? "Numéro (+237 6XX XXX XXX)" : "IBAN / numéro de compte"}
                value={form.destinataire}
                onChange={e => setForm(f => ({ ...f, destinataire: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm rounded-lg border focus:outline-none"
                style={{ background: "#141414", borderColor: "rgba(255,255,255,0.1)", color: "#ffffff" }}
              />
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#F5A623,#D4911A)", color: "#111111" }}>
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpFromLine size={14} />}
                Confirmer le retrait
              </button>
            </form>
          )}

          <div className="space-y-2">
            {wallet.retraits.length === 0 && <p className="text-xs text-center py-4" style={{ color: "#666666" }}>Aucun retrait pour l'instant</p>}
            {wallet.retraits.map(r => {
              const s = STATUT_LABEL[r.statut] ?? { label: r.statut, color: "#AAAAAA" };
              return (
                <div key={r.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-2.5">
                    {r.methode === "mobile_money" ? <Smartphone size={13} style={{ color: "#AAAAAA" }} /> : <Building2 size={13} style={{ color: "#AAAAAA" }} />}
                    <div>
                      <p className="text-xs font-medium" style={{ color: "#ffffff" }}>{fmt(r.montant, r.devise)}</p>
                      <p className="text-[10px]" style={{ color: "#AAAAAA" }}>{r.destinataire}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${s.color}18`, color: s.color }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
