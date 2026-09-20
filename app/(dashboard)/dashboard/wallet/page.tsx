"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Wallet, ArrowDownToLine, ArrowUpFromLine, Clock, CheckCircle2,
  XCircle, TrendingUp, ShieldCheck, Loader2, RefreshCw,
  Smartphone, Building2, AlertCircle, Info,
} from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const WALLET_TUTORIAL_STEPS = [
  { Icon: ShieldCheck,     titre: "Séquestre 48h",   description: "Chaque paiement client est placé en séquestre 48h (protection acheteur) avant d'être crédité sur ton solde disponible." },
  { Icon: ArrowUpFromLine, titre: "Retirer tes fonds", description: "Clique \"Retirer les fonds\" dès que ton solde le permet (minimum 1 000 XAF) — par Mobile Money ou virement bancaire." },
  { Icon: TrendingUp,      titre: "Suivi complet",     description: "Total reçu, total retiré, commissions Axso et montant en séquestre — tout est visible en un coup d'œil." },
  { Icon: Clock,           titre: "Historique détaillé", description: "Bascule entre l'onglet Transactions et Retraits pour suivre chaque mouvement et son statut (en attente, en cours, complété)." },
];

interface Transaction {
  id: string; type: string; montant: number; devise: string;
  description: string; reference?: string; statut: string; createdAt: string;
}
interface RetraitItem {
  id: string; montant: number; devise: string; methode: string;
  destinataire: string; operateur?: string; statut: string;
  reference?: string; createdAt: string;
}
interface WalletData {
  solde: number; totalRecu: number; totalRetire: number;
  totalCommission: number; soldeSequestre: number;
  retraitsEnAttente: number; devise: string;
  transactions: Transaction[]; retraits: RetraitItem[];
}

const OPERATEURS = [
  { id: "MTN",    label: "MTN Mobile Money"  },
  { id: "Orange", label: "Orange Money"      },
  { id: "Wave",   label: "Wave"              },
  { id: "Moov",   label: "Moov Money"        },
  { id: "Mpesa",  label: "M-Pesa"            },
  { id: "Airtel", label: "Airtel Money"      },
  { id: "Free",   label: "Free Money"        },
];

function fmt(n: number, devise = "XAF") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: devise,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
    completed:  { label: "Complété",   color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0", icon: CheckCircle2 },
    complete:   { label: "Complété",   color: "#15803D", bg: "#F0FDF4", border: "#BBF7D0", icon: CheckCircle2 },
    en_attente: { label: "En attente", color: "#B45309", bg: "#FFFBEB", border: "#FDE68A", icon: Clock       },
    traitement: { label: "En cours",   color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", icon: Loader2     },
    en_cours:   { label: "En cours",   color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", icon: Loader2     },
    echoue:     { label: "Échoué",     color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", icon: XCircle     },
  };
  const s = map[statut] ?? map["en_attente"];
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      <Icon size={9} /> {s.label}
    </span>
  );
}

function TxIcon({ type }: { type: string }) {
  const map: Record<string, { bg: string; color: string; Icon: any }> = {
    CREDIT:        { bg: "#F0FDF4", color: "#16A34A", Icon: ArrowDownToLine  },
    COMMISSION:    { bg: "#FAF5FF", color: "#7C3AED", Icon: ShieldCheck      },
    RETRAIT:       { bg: "#EFF6FF", color: "#3B82F6", Icon: ArrowUpFromLine  },
    REMBOURSEMENT: { bg: "#FFF7ED", color: "#D97706", Icon: RefreshCw        },
  };
  const s = map[type] ?? map["CREDIT"];
  const Icon = s.Icon;
  return (
    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: s.bg }}>
      <Icon size={15} style={{ color: s.color }} />
    </div>
  );
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRetrait, setShowRetrait] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"transactions" | "retraits">("transactions");

  const [form, setForm] = useState({
    montant: "",
    methode: "mobile_money" as "mobile_money" | "virement_bancaire",
    destinataire: "",
    operateur: "MTN",
    notes: "",
  });

  async function charger() {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet");
      const data = await res.json();
      setWallet(data.wallet);
    } catch { toast.error("Erreur chargement wallet"); }
    finally { setLoading(false); }
  }

  useEffect(() => { charger(); }, []);

  async function soumettrRetrait(e: React.FormEvent) {
    e.preventDefault();
    if (!form.montant || Number(form.montant) <= 0) { toast.error("Montant invalide"); return; }
    if (!form.destinataire.trim()) { toast.error("Numéro / IBAN requis"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/wallet/retrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, montant: Number(form.montant) }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erreur retrait"); return; }
      toast.success("Retrait initié ! Traitement sous 24–48h.");
      setShowRetrait(false);
      setForm({ montant: "", methode: "mobile_money", destinataire: "", operateur: "MTN", notes: "" });
      charger();
    } finally { setSubmitting(false); }
  }

  const devise = wallet?.devise ?? "XAF";

  return (
    <div className="space-y-5 max-w-5xl"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="wallet" titre="Wallet" sousTitre="Ton solde et tes mouvements" steps={WALLET_TUTORIAL_STEPS} />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">Wallet Axso</h1>
            <BoutonRevoirTutoriel moduleKey="wallet" />
          </div>
          <p className="text-[12.5px] text-[#AAAAAA] mt-0.5">Votre compte de paiement sécurisé</p>
        </div>
        <button onClick={charger}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[#888888] border border-[#E8E8E8] rounded-2xl px-3.5 py-2 hover:text-[#111111] hover:border-[#CCCCCC] transition-all">
          <RefreshCw size={13} /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="ax-card flex items-center justify-center h-64">
          <Loader2 size={28} className="animate-spin text-[#F5A623]" />
        </div>
      ) : (
        <>
          {/* ── Wallet card ── */}
          <div className="relative rounded-[24px] overflow-hidden p-8 text-white"
            style={{
              background: "linear-gradient(135deg, #1a0e02 0%, #c17f14 45%, #F5A623 75%, #e09010 100%)",
              boxShadow: "0 20px 60px rgba(245,166,35,0.30), 0 4px 16px rgba(0,0,0,0.12)",
            }}>
            <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-[0.07]"
              style={{ background: "radial-gradient(circle, white, transparent 70%)", transform: "translate(30%,-30%)" }} />
            <div className="absolute bottom-0 left-20 w-48 h-48 rounded-full opacity-[0.06]"
              style={{ background: "radial-gradient(circle, white, transparent 70%)", transform: "translateY(40%)" }} />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-5 opacity-60">
                  <ShieldCheck size={13} />
                  <span className="text-[11px] font-semibold tracking-[0.15em] uppercase">Wallet Axso · Sécurisé</span>
                </div>
                <p className="text-[13px] opacity-60 mb-1.5">Solde disponible</p>
                <p className="text-[48px] font-black tracking-tight leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {fmt(wallet?.solde ?? 0, devise)}
                </p>
                {(wallet?.soldeSequestre ?? 0) > 0 && (
                  <div className="mt-3.5 flex items-center gap-2 bg-white/10 rounded-2xl px-3.5 py-2 w-fit">
                    <Clock size={12} className="opacity-70" />
                    <p className="text-[12px] opacity-80">
                      <strong>{fmt(wallet!.soldeSequestre, devise)}</strong> en séquestre (libération 48h)
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:items-end gap-2.5">
                <button
                  onClick={() => setShowRetrait(true)}
                  disabled={(wallet?.solde ?? 0) <= 0}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-[#D97706] font-bold rounded-2xl text-[13px] hover:bg-amber-50 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed">
                  <ArrowUpFromLine size={15} /> Retirer les fonds
                </button>
                <p className="text-[11px] opacity-40 sm:text-right">Minimum 1 000 {devise}</p>
              </div>
            </div>
          </div>

          {/* ── Stat cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { Icon: TrendingUp,      label: "Total reçu",       val: wallet?.totalRecu ?? 0,       iconBg: "#F0FDF4", iconColor: "#16A34A" },
              { Icon: ArrowUpFromLine, label: "Total retiré",      val: wallet?.totalRetire ?? 0,     iconBg: "#FFF8EC", iconColor: "#F5A623", accent: true },
              { Icon: ShieldCheck,     label: "Commissions Axso",  val: wallet?.totalCommission ?? 0, iconBg: "#FAF5FF", iconColor: "#7C3AED" },
              { Icon: Clock,           label: "En séquestre",      val: wallet?.soldeSequestre ?? 0,  iconBg: "#FFF7ED", iconColor: "#D97706" },
            ].map((s, i) => {
              const Icon = s.Icon;
              return (
                <div key={i} className={`ax-card p-5 relative overflow-hidden group cursor-default ${s.accent ? "border-[#F5A623]/20" : ""}`}>
                  {s.accent && (
                    <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[20px]"
                      style={{ background: "linear-gradient(90deg, #F5A623, #FFD280, #F5A623)" }} />
                  )}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <span className="ax-label">{s.label}</span>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
                      style={{ background: s.iconBg, border: `1px solid ${s.iconColor}20` }}>
                      <Icon size={14} style={{ color: s.iconColor }} strokeWidth={1.8} />
                    </div>
                  </div>
                  <p className="text-[20px] font-bold text-[#111111] leading-none tabular-nums tracking-tight">
                    {fmt(s.val, devise)}
                  </p>
                </div>
              );
            })}
          </div>

          {/* ── Info banner ── */}
          <div className="ax-card-flat p-4 flex items-start gap-3 border-[#FDE68A]/60"
            style={{ background: "#FFFBEB" }}>
            <Info size={15} className="text-[#F5A623] mt-0.5 flex-shrink-0" />
            <p className="text-[12.5px] text-[#92400E] leading-relaxed">
              <strong>Comment fonctionne le Wallet Axso ?</strong><br />
              Chaque paiement client est placé en <strong>séquestre 48h</strong> (protection acheteur).
              Après confirmation de livraison ou expiration du délai, les fonds sont crédités — vous recevez l'intégralité de votre prix, la commission Axso (6%) est ajoutée au prix payé par le client.
            </p>
          </div>

          {/* ── Onglets + historique ── */}
          <div className="ax-card overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-[#F3F3F3]">
              {([
                { key: "transactions", label: `Transactions (${wallet?.transactions?.length ?? 0})` },
                { key: "retraits",     label: `Retraits (${wallet?.retraits?.length ?? 0})` },
              ] as const).map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className="flex-1 py-3.5 text-[12.5px] font-semibold transition-colors border-b-2"
                  style={tab === t.key
                    ? { color: "#F5A623", borderColor: "#F5A623" }
                    : { color: "#AAAAAA", borderColor: "transparent" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Transactions */}
            {tab === "transactions" && (
              <div className="divide-y divide-[#F9F9F9]">
                {(wallet?.transactions ?? []).length === 0 ? (
                  <div className="py-16 text-center">
                    <Wallet size={28} className="mx-auto mb-3 text-[#DDDDDD]" />
                    <p className="text-[13px] text-[#AAAAAA] font-medium">Aucune transaction pour le moment</p>
                    <p className="text-[11.5px] text-[#CCCCCC] mt-1">Les mouvements apparaîtront ici après vos premières ventes</p>
                  </div>
                ) : (wallet?.transactions ?? []).map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors">
                    <TxIcon type={tx.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-[#222] truncate">{tx.description}</p>
                      {tx.reference && <p className="text-[11px] text-[#CCCCCC] font-mono">{tx.reference}</p>}
                      <p className="text-[11px] text-[#AAAAAA]">
                        {new Date(tx.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-[14px] font-bold tabular-nums`}
                        style={{ color: tx.montant >= 0 ? "#16A34A" : "#DC2626" }}>
                        {tx.montant >= 0 ? "+" : ""}{fmt(tx.montant, tx.devise)}
                      </p>
                      <div className="mt-0.5"><StatutBadge statut={tx.statut} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Retraits */}
            {tab === "retraits" && (
              <div className="divide-y divide-[#F9F9F9]">
                {(wallet?.retraits ?? []).length === 0 ? (
                  <div className="py-16 text-center">
                    <ArrowUpFromLine size={28} className="mx-auto mb-3 text-[#DDDDDD]" />
                    <p className="text-[13px] text-[#AAAAAA] font-medium">Aucun retrait effectué</p>
                  </div>
                ) : (wallet?.retraits ?? []).map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: r.methode === "mobile_money" ? "#FFF7ED" : "#EFF6FF" }}>
                      {r.methode === "mobile_money"
                        ? <Smartphone size={15} className="text-[#D97706]" />
                        : <Building2 size={15} className="text-[#3B82F6]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-[#222]">
                        {r.methode === "mobile_money" ? `Mobile Money · ${r.operateur ?? ""}` : "Virement bancaire"}
                      </p>
                      <p className="text-[11px] text-[#AAAAAA] truncate">{r.destinataire}</p>
                      <p className="text-[11px] text-[#AAAAAA]">
                        {new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[14px] font-bold text-[#111] tabular-nums">-{fmt(r.montant, r.devise)}</p>
                      <div className="mt-0.5"><StatutBadge statut={r.statut} /></div>
                      {r.reference && <p className="text-[10px] text-[#CCCCCC] font-mono mt-0.5">{r.reference}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal Retrait ── */}
      {showRetrait && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowRetrait(false); }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            style={{ maxHeight: "92vh", overflowY: "auto" }}>

            <div className="px-6 py-5 border-b border-[#F3F3F3] flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-bold text-[#111111]">Retirer des fonds</h2>
                <p className="text-[12px] text-[#AAAAAA] mt-0.5">
                  Disponible : <strong className="text-[#F5A623]">{fmt(wallet?.solde ?? 0, devise)}</strong>
                </p>
              </div>
              <button onClick={() => setShowRetrait(false)}
                className="w-8 h-8 flex items-center justify-center text-[#888] hover:text-[#111] rounded-xl hover:bg-[#F5F5F7] transition-all text-[16px]">
                ✕
              </button>
            </div>

            <form onSubmit={soumettrRetrait} className="p-5 space-y-4">
              {/* Montant */}
              <div>
                <label className="ax-label block mb-2">Montant</label>
                <div className="relative">
                  <input
                    type="number"
                    value={form.montant}
                    onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                    placeholder="Ex: 50 000"
                    min="1000"
                    max={wallet?.solde ?? 0}
                    className="w-full border border-[#E8E8E8] rounded-2xl px-4 py-3 text-[#111111] text-[18px] font-bold outline-none focus:border-[#F5A623]/50 pr-14 transition-colors"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-[#AAAAAA]">{devise}</span>
                </div>
                <div className="flex gap-2 mt-2">
                  {[25, 50, 75, 100].map(pct => (
                    <button key={pct} type="button"
                      onClick={() => setForm(f => ({ ...f, montant: String(Math.floor((wallet?.solde ?? 0) * pct / 100)) }))}
                      className="flex-1 py-1.5 text-[11px] font-bold border border-[#E8E8E8] rounded-xl text-[#888] hover:border-[#F5A623]/60 hover:text-[#F5A623] transition-all">
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Méthode */}
              <div>
                <label className="ax-label block mb-2">Méthode</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: "mobile_money",     label: "Mobile Money",  Icon: Smartphone, desc: "MTN, Orange, Wave…" },
                    { id: "virement_bancaire", label: "Virement",      Icon: Building2,  desc: "IBAN / Compte" },
                  ].map(m => {
                    const Icon = m.Icon;
                    const active = form.methode === m.id;
                    return (
                      <button key={m.id} type="button"
                        onClick={() => setForm(f => ({ ...f, methode: m.id as any }))}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all"
                        style={active
                          ? { borderColor: "#F5A623", background: "#FFFBEB" }
                          : { borderColor: "#EBEBEB", background: "#FAFAFA" }}>
                        <Icon size={20} style={{ color: active ? "#F5A623" : "#AAAAAA" }} />
                        <span className="text-[12px] font-bold" style={{ color: active ? "#D97706" : "#666666" }}>{m.label}</span>
                        <span className="text-[11px] text-[#AAAAAA]">{m.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Opérateur (Mobile Money) */}
              {form.methode === "mobile_money" && (
                <div>
                  <label className="ax-label block mb-2">Opérateur</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {OPERATEURS.map(op => (
                      <button key={op.id} type="button"
                        onClick={() => setForm(f => ({ ...f, operateur: op.id }))}
                        className="py-2 text-[11px] font-bold rounded-xl border transition-all"
                        style={form.operateur === op.id
                          ? { borderColor: "#F5A623", background: "#FFFBEB", color: "#D97706" }
                          : { borderColor: "#EBEBEB", background: "#FAFAFA", color: "#888888" }}>
                        {op.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Numéro / IBAN */}
              <div>
                <label className="ax-label block mb-2">
                  {form.methode === "mobile_money" ? "Numéro Mobile Money" : "IBAN ou numéro de compte"}
                </label>
                <input
                  type="text"
                  value={form.destinataire}
                  onChange={e => setForm(f => ({ ...f, destinataire: e.target.value }))}
                  placeholder={form.methode === "mobile_money" ? "+237 6XX XXX XXX" : "FR76 XXXX XXXX XXXX"}
                  className="w-full border border-[#E8E8E8] rounded-2xl px-4 py-3 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 transition-colors"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="ax-label block mb-2">Note (optionnel)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ex: Virement mensuel…"
                  className="w-full border border-[#E8E8E8] rounded-2xl px-4 py-3 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 transition-colors"
                />
              </div>

              {/* Récap */}
              {form.montant && Number(form.montant) > 0 && (
                <div className="bg-[#F9F9F9] border border-[#F0F0F0] rounded-2xl p-4 space-y-2">
                  {[
                    { label: "Montant demandé", value: fmt(Number(form.montant), devise), bold: false },
                    { label: "Frais de virement", value: "Inclus", bold: false },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-[12.5px]">
                      <span className="text-[#AAAAAA]">{row.label}</span>
                      <span className="font-semibold text-[#888]">{row.value}</span>
                    </div>
                  ))}
                  <div className="border-t border-[#EBEBEB] pt-2 flex justify-between text-[13px] font-bold">
                    <span className="text-[#111111]">Vous recevrez</span>
                    <span className="text-[#F5A623]" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {fmt(Number(form.montant), devise)}
                    </span>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-2xl p-3">
                <AlertCircle size={13} className="text-[#D97706] mt-0.5 flex-shrink-0" />
                <p className="text-[11.5px] text-[#92400E]">
                  Traitement sous 24–48h ouvrées. Les fonds sont débités immédiatement de votre wallet.
                </p>
              </div>

              <button type="submit"
                disabled={submitting || !form.montant || Number(form.montant) <= 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-[13px] transition-all disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: "linear-gradient(135deg, #F5A623, #D4911A)", boxShadow: "0 4px 20px rgba(245,166,35,0.30)" }}>
                {submitting
                  ? <><Loader2 size={15} className="animate-spin" /> Traitement…</>
                  : <><ArrowUpFromLine size={15} /> Confirmer le retrait</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
