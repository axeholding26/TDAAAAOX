"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Receipt, Plus, Trash2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { EtatErreur, EtatNonAutorise } from "@/components/pos/ui";

const CHARGES_TUTORIAL_STEPS = [
  { Icon: Plus,          titre: "Enregistrer une charge", description: "Loyer, salaires, électricité, fournitures... Choisis une catégorie, un montant et une fréquence (ponctuelle ou récurrente)." },
  { Icon: Clock,         titre: "Suivi du paiement",       description: "Marque une charge \"En attente\" tant qu'elle n'est pas réglée, puis clique \"Payer\" une fois le paiement effectué." },
  { Icon: CheckCircle2,  titre: "Impact sur la rentabilité", description: "Toutes tes charges alimentent automatiquement le module Comptabilité pour calculer ton vrai bénéfice net." },
];

interface Charge {
  id: string; categorie: string; description: string; montant: number; devise: string;
  frequence: string; dateEnregistrement: string; statut: string; fournisseur: string | null;
}

const CATEGORIES = [
  { v: "loyer", l: "Loyer" }, { v: "electricite", l: "Électricité" }, { v: "eau", l: "Eau" },
  { v: "internet", l: "Internet" }, { v: "fournitures", l: "Fournitures" }, { v: "equipement", l: "Équipement" },
  { v: "salaires", l: "Salaires" }, { v: "transport", l: "Transport" }, { v: "autre", l: "Autre" },
];
const FREQUENCES = [
  { v: "ponctuelle", l: "Ponctuelle" }, { v: "hebdomadaire", l: "Hebdomadaire" },
  { v: "mensuelle", l: "Mensuelle" }, { v: "annuelle", l: "Annuelle" },
];
const STATUT_CFG: Record<string, { label: string; cls: string; Icon: any }> = {
  payee:      { label: "Payée",      cls: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  en_attente: { label: "En attente", cls: "bg-amber-100 text-amber-700", Icon: Clock },
  en_retard:  { label: "En retard",  cls: "bg-red-100 text-red-600",     Icon: AlertCircle },
};
const EMPTY = { categorie: "loyer", description: "", montant: "", frequence: "ponctuelle", statut: "payee", fournisseur: "" };

export default function ChargesPage() {
  const t = useT();
  const { fmt, devise } = useDevise();
  const [charges, setCharges] = useState<Charge[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  // Échec du chargement : 403 (droit voir_couts / rapprochement manquant) ou autre, avec la phrase du serveur.
  const [echec, setEchec] = useState<{ interdit: boolean; message: string } | null>(null);

  const charger = useCallback(() => {
    fetch("/api/pos/charges").then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setEchec({ interdit: r.status === 403, message: d.error ?? "Les charges n'ont pas pu être chargées. Réessayez dans un instant." });
      else { setEchec(null); setCharges(d.charges ?? []); setStats(d.stats ?? null); }
      setLoading(false);
    }).catch(() => { setEchec({ interdit: false, message: "Connexion interrompue. Vérifiez le réseau puis réessayez." }); setLoading(false); });
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function creer() {
    if (!form.description || !form.montant) { toast.error(t("Description et montant requis")); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/pos/charges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "La charge n'a pas pu être enregistrée. Réessayez dans un instant.");
      toast.success(t("Charge enregistrée"));
      setForm({ ...EMPTY }); setShowForm(false); charger();
    } catch (e: any) {
      toast.error(t(e instanceof TypeError ? "Connexion interrompue. Vérifiez le réseau puis réessayez." : e.message));
    } finally {
      setSaving(false);
    }
  }

  // Le serveur peut refuser (dépense sortie d'une caisse, droit manquant) : sa phrase est affichée.
  async function modifier(appel: Promise<Response>) {
    try {
      const res = await appel;
      if (!res.ok) toast.error(t((await res.json().catch(() => ({}))).error ?? "Un problème est survenu. Réessayez dans un instant."));
    } catch { toast.error(t("Connexion interrompue. Vérifiez le réseau puis réessayez.")); }
    charger();
  }

  async function marquerPayee(id: string) {
    await modifier(fetch(`/api/pos/charges/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut: "payee" }) }));
  }

  async function supprimer(id: string) {
    if (!confirm(t("Supprimer cette charge ?"))) return;
    await modifier(fetch(`/api/pos/charges/${id}`, { method: "DELETE" }));
  }

  const inp = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60";

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="pos-charges" titre={t("Charges d'exploitation")} sousTitre={t("Module Point de vente")} steps={CHARGES_TUTORIAL_STEPS} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold text-[#111]">{t("Charges d'exploitation")}</h1>
            <BoutonRevoirTutoriel moduleKey="pos-charges" />
          </div>
          <p className="text-[12px] text-gray-500">{t("Loyer, salaires, énergie... les coûts fixes de votre boutique physique")}</p>
        </div>
        {!echec && <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 bg-[#F5A623] text-white rounded-xl text-[12px] font-bold flex items-center gap-1.5">
          <Plus size={13} />{" "}{t("Nouvelle charge")}
        </button>}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0 bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-[17px] sm:text-[20px] [overflow-wrap:anywhere] font-bold text-[#111]">{fmt(stats.total)}</p>
            <p className="text-[10.5px] text-gray-400 mt-0.5">{t("Total enregistré")}</p>
          </div>
          <div className="min-w-0 bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-[17px] sm:text-[20px] [overflow-wrap:anywhere] font-bold text-amber-500">{fmt(stats.enAttente)}</p>
            <p className="text-[10.5px] text-gray-400 mt-0.5">{t("En attente de paiement")}</p>
          </div>
        </div>
      )}

      {showForm && !echec && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("Catégorie")}</label>
              <select aria-label={t("Catégorie")} value={form.categorie} onChange={e => setForm(v => ({ ...v, categorie: e.target.value }))} className={`${inp} bg-white`}>
                {CATEGORIES.map(c => <option key={c.v} value={c.v}>{t(c.l)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("Montant")} ({devise})</label>
              <input type="number" aria-label={t("Montant")} value={form.montant} onChange={e => setForm(v => ({ ...v, montant: e.target.value }))} className={inp} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("Description")}</label>
              <input aria-label={t("Description")} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} placeholder={t("Ex: Loyer boutique — Janvier")} className={inp} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("Fréquence")}</label>
              <select aria-label={t("Fréquence")} value={form.frequence} onChange={e => setForm(v => ({ ...v, frequence: e.target.value }))} className={`${inp} bg-white`}>
                {FREQUENCES.map(f => <option key={f.v} value={f.v}>{t(f.l)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("Statut")}</label>
              <select aria-label={t("Statut")} value={form.statut} onChange={e => setForm(v => ({ ...v, statut: e.target.value }))} className={`${inp} bg-white`}>
                {Object.entries(STATUT_CFG).map(([v, c]) => <option key={v} value={v}>{t(c.label)}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t("Fournisseur (optionnel)")}</label>
              <input aria-label={t("Fournisseur (optionnel)")} value={form.fournisseur} onChange={e => setForm(v => ({ ...v, fournisseur: e.target.value }))} className={inp} />
            </div>
          </div>
          <button onClick={creer} disabled={saving} className="px-5 py-2.5 bg-[#F5A623] text-white rounded-xl text-[12.5px] font-bold disabled:opacity-50">
            {saving ? "…" : t("Enregistrer")}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">{t("Chargement…")}</div>
      ) : echec ? (
        echec.interdit ? <EtatNonAutorise texte={echec.message} /> : <EtatErreur texte={echec.message} onReessayer={() => { setLoading(true); charger(); }} />
      ) : charges.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <Receipt size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-[#111]">{t("Aucune charge enregistrée")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {charges.map(c => {
            const cfg = STATUT_CFG[c.statut] ?? STATUT_CFG.payee;
            return (
              <div key={c.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-wrap items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#F5A62312" }}>
                  <Receipt size={14} className="text-[#F5A623]" />
                </div>
                <div className="flex-1 min-w-[10rem]">
                  <p className="text-[13px] font-semibold text-[#111] truncate">{c.description}</p>
                  <p className="text-[11px] text-gray-400">
                    {t(CATEGORIES.find(x => x.v === c.categorie)?.l)} · {t(FREQUENCES.find(x => x.v === c.frequence)?.l)} · {new Date(c.dateEnregistrement).toLocaleDateString(t.loc)}
                    {c.fournisseur && ` · ${c.fournisseur}`}
                  </p>
                </div>
                <p className="text-[13px] font-bold text-[#111] flex-shrink-0">{fmt(c.montant)}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1 ${cfg.cls}`}>
                  <cfg.Icon size={9} /> {t(cfg.label)}
                </span>
                {c.statut !== "payee" && (
                  <button onClick={() => marquerPayee(c.id)} className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-500 text-white flex-shrink-0">{t("Payer")}</button>
                )}
                <button onClick={() => supprimer(c.id)} aria-label={t("Supprimer cette charge")} className="p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0">
                  <Trash2 size={12} className="text-gray-300" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
