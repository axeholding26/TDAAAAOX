"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Eye, MousePointer, Megaphone } from "lucide-react";

interface Popup {
  id: string;
  nom: string;
  type: string;
  declencheur: string;
  delaiSec: number;
  titre: string;
  message: string;
  ctaTexte: string | null;
  ctaUrl: string | null;
  imageUrl: string | null;
  codePromo: string | null;
  actif: boolean;
  affichages: number;
  clics: number;
}

const TYPE_LABELS: Record<string, string> = {
  popup: "Popup centré",
  bandeau: "Bandeau haut",
  slide_in: "Slide-in coin",
};

const DECLENCHEUR_LABELS: Record<string, string> = {
  delai: "Après délai",
  exit_intent: "Exit intent",
  scroll: "Au scroll",
  premiere_visite: "1ère visite",
};

export default function PopupsPage() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: "", type: "popup", declencheur: "delai", delaiSec: 5,
    titre: "", message: "", ctaTexte: "", ctaUrl: "", imageUrl: "", codePromo: "",
  });

  useEffect(() => {
    fetch("/api/popups")
      .then((r) => r.json())
      .then((d) => setPopups(d.popups ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function savePopup() {
    setSaving(true);
    const res = await fetch("/api/popups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.popup) {
      setPopups((prev) => [data.popup, ...prev]);
      setForm({ nom: "", type: "popup", declencheur: "delai", delaiSec: 5, titre: "", message: "", ctaTexte: "", ctaUrl: "", imageUrl: "", codePromo: "" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function togglePopup(popup: Popup) {
    const res = await fetch("/api/popups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: popup.id, actif: !popup.actif }),
    });
    const data = await res.json();
    if (data.popup) setPopups((prev) => prev.map((p) => p.id === popup.id ? data.popup : p));
  }

  async function deletePopup(id: string) {
    await fetch(`/api/popups?id=${id}`, { method: "DELETE" });
    setPopups((prev) => prev.filter((p) => p.id !== id));
  }

  const totalAffichages = popups.reduce((s, p) => s + p.affichages, 0);
  const totalClics = popups.reduce((s, p) => s + p.clics, 0);
  const tauxClics = totalAffichages > 0 ? ((totalClics / totalAffichages) * 100).toFixed(1) : "0";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">Popups & Bandeaux</h1>
          <p className="text-[12.5px] text-[#AAAAAA] mt-0.5">Campagnes d'engagement sur ta boutique</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-semibold"
          style={{ background: "#F5A623" }}
        >
          <Plus size={14} /> Créer un popup
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-4">
          <p className="text-[11px] text-[#888] mb-1">Affichages</p>
          <p className="text-2xl font-bold text-[#111]">{totalAffichages.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-4">
          <p className="text-[11px] text-[#888] mb-1">Clics</p>
          <p className="text-2xl font-bold text-[#111]">{totalClics.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-4">
          <p className="text-[11px] text-[#888] mb-1">Taux clics</p>
          <p className="text-2xl font-bold" style={{ color: "#F5A623" }}>{tauxClics}%</p>
        </div>
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-5">
          <h3 className="text-[14px] font-semibold text-[#111] mb-4">Nouveau popup</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Nom interne *</label>
              <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Type</label>
              <select className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Déclencheur</label>
              <select className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.declencheur} onChange={(e) => setForm((f) => ({ ...f, declencheur: e.target.value }))}>
                {Object.entries(DECLENCHEUR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {form.declencheur === "delai" && (
              <div>
                <label className="block text-[11px] text-[#888] mb-1">Délai (secondes)</label>
                <input type="number" className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.delaiSec} min={1} onChange={(e) => setForm((f) => ({ ...f, delaiSec: Number(e.target.value) }))} />
              </div>
            )}
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Titre *</label>
              <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" placeholder="Offre spéciale !" value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Code promo (optionnel)</label>
              <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" placeholder="PROMO20" value={form.codePromo} onChange={(e) => setForm((f) => ({ ...f, codePromo: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Texte du bouton CTA</label>
              <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" placeholder="Profiter de l'offre" value={form.ctaTexte} onChange={(e) => setForm((f) => ({ ...f, ctaTexte: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">URL du bouton</label>
              <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" placeholder="/produits" value={form.ctaUrl} onChange={(e) => setForm((f) => ({ ...f, ctaUrl: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-[#888] mb-1">Message *</label>
              <textarea className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" rows={2} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={savePopup} disabled={saving || !form.nom || !form.titre || !form.message} className="px-4 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50" style={{ background: "#F5A623" }}>
              {saving ? "Enregistrement..." : "Créer"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-[13px] text-[#666] border border-[#E5E5E5]">Annuler</button>
          </div>
        </div>
      )}

      {/* Liste */}
      {popups.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E5E5E5] rounded-xl p-10 text-center">
          <Megaphone size={32} className="mx-auto mb-3 text-[#DDD]" />
          <p className="text-[13px] text-[#888]">Aucun popup actif. Crée ton premier bandeau d'engagement.</p>
          <button onClick={() => setShowForm(true)} className="mt-4 px-4 py-2 rounded-lg text-white text-[13px] font-semibold" style={{ background: "#F5A623" }}>
            Créer un popup
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {popups.map((p) => (
            <div key={p.id} className={`bg-white border border-[#F0F0F0] rounded-xl p-4 flex items-center justify-between gap-4 ${!p.actif ? "opacity-60" : ""}`}>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#FFF8EC" }}>
                  <Megaphone size={16} style={{ color: "#F5A623" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#111] truncate">{p.nom}</p>
                  <p className="text-[11px] text-[#888]">{TYPE_LABELS[p.type]} · {DECLENCHEUR_LABELS[p.declencheur]}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-[11px] text-[#888]">
                <span className="flex items-center gap-1"><Eye size={11} /> {p.affichages}</span>
                <span className="flex items-center gap-1"><MousePointer size={11} /> {p.clics}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => togglePopup(p)}
                  className="w-8 h-5 rounded-full relative transition-all"
                  style={{ background: p.actif ? "#10b981" : "#E5E5E5" }}
                >
                  <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: p.actif ? "14px" : "2px" }} />
                </button>
                <button onClick={() => deletePopup(p.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                  <Trash2 size={13} className="text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
