"use client";
// Espace livreur : solde (par devise), gains par course et retraits Mobile Money (/api/livreurs/gains).
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { formatMontant } from "@/lib/utils";

type Donnees = {
  soldes: { devise: string; solde: number; minimum: number }[];
  gains: { id: string; numero: string; montant: number; devise: string; paiement: string; createdAt: string }[];
  retraits: { id: string; montant: number; devise: string; destinataire: string; statut: string; createdAt: string }[];
  telephone: string;
};

const STATUT_RETRAIT: Record<string, { label: string; color: string }> = {
  en_attente: { label: "En attente", color: "#F5A623" },
  complete: { label: "Envoyé", color: "#34d399" },
  echoue: { label: "Refusé · remis sur le solde", color: "#f87171" },
};

export function GainsLivreur() {
  const t = useT();
  const [d, setD] = useState<Donnees | null>(null);
  const [form, setForm] = useState<{ devise: string; montant: string; telephone: string; operateur: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const charger = () => fetch("/api/livreurs/gains").then(r => r.ok ? r.json() : null).then(setD).catch(() => {});
  useEffect(() => { charger(); }, []);

  async function retirer(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setEnvoi(true);
    try {
      const res = await fetch("/api/livreurs/gains", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, montant: Number(form.montant) }),
      });
      const r = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(r.error || "Erreur");
      toast.success(t("Demande envoyée : Axso te prévient dès que l'argent est envoyé"));
      setForm(null);
      charger();
    } catch (err: any) { toast.error(t(err.message)); } finally { setEnvoi(false); }
  }

  if (!d || (!d.soldes.length && !d.gains.length && !d.retraits.length)) return null;
  const champ = "w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#F5A623]/50";

  return (
    <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-[#141414] to-[#0d0d0d] p-5 space-y-4">
      <p className="text-white font-semibold text-sm flex items-center gap-2"><Wallet size={15} className="text-[#F5A623]" />{" "}{t("Mes gains")}</p>

      {d.soldes.map(s => (
        <div key={s.devise} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-2xl font-bold text-[#F5A623]">{formatMontant(s.solde, s.devise)}</p>
            <p className="text-gray-500 text-xs">{t("Solde retirable · minimum {0}", formatMontant(s.minimum, s.devise))}</p>
          </div>
          <button type="button" disabled={s.solde < s.minimum}
            onClick={() => setForm({ devise: s.devise, montant: String(Math.floor(s.solde)), telephone: d.telephone, operateur: "MTN" })}
            className="bg-[#F5A623] text-black font-semibold px-4 py-2 rounded-xl text-sm disabled:opacity-40">
            {t("Retirer")}
          </button>
        </div>
      ))}

      {form && (
        <form onSubmit={retirer} className="space-y-2 rounded-2xl border border-[#F5A623]/20 p-3">
          <input className={champ} type="number" min={0} inputMode="decimal" required value={form.montant} onChange={e => setForm({ ...form, montant: e.target.value })} placeholder={t("Montant")} />
          <input className={champ} required value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} placeholder={t("Numéro Mobile Money")} />
          <select className={champ} value={form.operateur} onChange={e => setForm({ ...form, operateur: e.target.value })}>
            {["MTN", "Orange", "Wave", "Moov", "Airtel", "M-Pesa", "Autre"].map(o => <option key={o} value={o} className="text-black">{o}</option>)}
          </select>
          <div className="flex gap-2">
            <button type="submit" disabled={envoi} className="flex-1 flex items-center justify-center gap-2 bg-[#F5A623] text-black font-semibold py-2 rounded-xl text-sm disabled:opacity-50">
              {envoi && <Loader2 size={14} className="animate-spin" />}{t("Demander le retrait")}
            </button>
            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-xl text-sm text-gray-400 border border-white/10">{t("Annuler")}</button>
          </div>
          <p className="text-gray-500 text-[11px]">{t("Axso vérifie puis envoie l'argent sur ce numéro, en général sous 24 h.")}</p>
        </form>
      )}

      {d.gains.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-gray-400 text-xs">{t("Gains par course")}</p>
          {d.gains.map(g => (
            <div key={g.id} className="flex items-center justify-between text-xs bg-white/[0.03] rounded-lg px-3 py-2">
              <span className="font-mono text-gray-400">#{g.numero}</span>
              <span className="text-gray-500 flex-1 mx-3 truncate">{g.paiement === "en_ligne" ? t("Crédité sur ton solde") : t("Gardé sur les espèces")}</span>
              <span className="font-semibold text-white">{formatMontant(g.montant, g.devise)}</span>
            </div>
          ))}
        </div>
      )}

      {d.retraits.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-gray-400 text-xs">{t("Mes retraits")}</p>
          {d.retraits.map(r => (
            <div key={r.id} className="flex items-center justify-between text-xs bg-white/[0.03] rounded-lg px-3 py-2">
              <span className="text-gray-400">{new Date(r.createdAt).toLocaleDateString(t.loc)} · {r.destinataire}</span>
              <span className="text-right">
                <span className="font-semibold text-white block">{formatMontant(r.montant, r.devise)}</span>
                <span style={{ color: STATUT_RETRAIT[r.statut]?.color }}>{t(STATUT_RETRAIT[r.statut]?.label ?? r.statut)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
