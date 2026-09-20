"use client";
// Dashboard  Codes Promo
"use client";
import { useState, useEffect } from "react";
import { formatMontant } from "@/lib/utils";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

type CodePromo = {
  id: string;
  code: string;
  type: string;
  valeur: number;
  actif: boolean;
  utilisations: number;
  maxUtilisations: number | null;
  dateExpiration: string | null;
};

export default function CodesPromoPage() {
  const [codes, setCodes] = useState<CodePromo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: "", type: "pourcentage", valeur: 10, maxUtilisations: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/codes-promo").then((r) => r.json()).then(setCodes).finally(() => setLoading(false));
  }, []);

  async function creer() {
    setSaving(true);
    try {
      const res = await fetch("/api/codes-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, valeur: Number(form.valeur), maxUtilisations: form.maxUtilisations ? Number(form.maxUtilisations) : null }),
      });
      if (!res.ok) throw new Error();
      const nouveau = await res.json();
      setCodes((prev) => [nouveau, ...prev]);
      setShowForm(false);
      setForm({ code: "", type: "pourcentage", valeur: 10, maxUtilisations: "" });
      toast.success("Code promo créé !");
    } catch {
      toast.error("Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  }

  async function supprimer(id: string) {
    try {
      await fetch(`/api/codes-promo/${id}`, { method: "DELETE" });
      setCodes((prev) => prev.filter((c) => c.id !== id));
      toast.success("Code supprimé");
    } catch {
      toast.error("Erreur");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-poppins">Codes Promo</h1>
          <p className="text-gray-400 text-sm mt-1">{codes.length} code(s) au total</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90" style={{ backgroundColor: "#F5A623", color: "#0a0a0a" }}>
          <Plus size={16} /> Créer un code
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-[#F5A623]/30 rounded-2xl p-6 space-y-4">
          <h2 className="text-gray-800 font-semibold">Nouveau code promo</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-gray-400 text-xs block mb-2">Code *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SOLDES25" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50 font-mono" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-2">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50">
                <option value="pourcentage">Pourcentage (%)</option>
                <option value="fixe">Montant fixe</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-2">Valeur *</label>
              <input type="number" value={form.valeur} onChange={(e) => setForm({ ...form, valeur: Number(e.target.value) })} min={1} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50" />
            </div>
            <div>
              <label className="text-gray-400 text-xs block mb-2">Max utilisations (vide = illimité)</label>
              <input type="number" value={form.maxUtilisations} onChange={(e) => setForm({ ...form, maxUtilisations: e.target.value })} placeholder="8" min={1} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50" />
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={creer} disabled={!form.code || saving} className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "#F5A623", color: "#0a0a0a" }}>
              {saving ? "Création..." : "Créer"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl text-sm text-gray-400 border border-gray-200 hover:border-[#F5A623]/30">
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Chargement...</div>
        ) : codes.length === 0 ? (
          <div className="p-12 text-center text-gray-500">Aucun code promo  créez-en un !</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {["Code", "Remise", "Utilisations", "Statut", "Actions"].map((h) => (
                  <th key={h} className="text-left text-gray-400 font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {codes.map((code) => (
                <tr key={code.id} className="border-b border-[#111] hover:bg-[#151515]">
                  <td className="px-5 py-4"><code className="text-[#F5A623] bg-[#F5A623]/10 px-2 py-1 rounded font-mono">{code.code}</code></td>
                  <td className="px-5 py-4 text-gray-700">{code.type === "pourcentage" ? `${code.valeur}%` : `${code.valeur} (fixe)`}</td>
                  <td className="px-5 py-4 text-gray-400">{code.utilisations}/{code.maxUtilisations || "8"}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2 py-1 rounded-lg ${code.actif ? "text-green-400 bg-green-400/10 border border-green-400/30" : "text-gray-500 bg-gray-500/10 border border-gray-500/30"}`}>
                      {code.actif ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => supprimer(code.id)} className="text-red-400 hover:text-red-300 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

