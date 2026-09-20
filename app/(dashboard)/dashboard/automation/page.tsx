"use client";

import { useEffect, useState } from "react";
import { Plus, Zap, Trash2, Mail, MessageSquare, Phone, ShoppingCart, Hand, Package, Gift, Clock } from "lucide-react";

interface Workflow {
  id: string;
  nom: string;
  type: string;
  actif: boolean;
  delaiHeures: number;
  canal: string;
  sujet: string | null;
  message: string;
  declenchements: number;
  conversions: number;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { label: string; Icon: any; description: string }> = {
  panier_abandonne: { label: "Panier abandonné", Icon: ShoppingCart, description: "Relance les visiteurs qui n'ont pas finalisé leur achat" },
  bienvenue: { label: "Bienvenue", Icon: Hand, description: "Accueille les nouveaux clients avec un message personnalisé" },
  apres_achat: { label: "Après achat", Icon: Package, description: "Remercie et fidélise après une commande confirmée" },
  anniversaire: { label: "Anniversaire", Icon: Gift, description: "Felicite tes clients le jour de leur anniversaire" },
  inactif: { label: "Client inactif", Icon: Clock, description: "Relance les clients sans achat depuis 30+ jours" },
};

const CANAL_ICONS: Record<string, any> = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
};

export default function AutomationPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: "", type: "panier_abandonne", delaiHeures: 1,
    canal: "email", sujet: "", message: "",
  });

  useEffect(() => {
    fetch("/api/automation")
      .then((r) => r.json())
      .then((d) => setWorkflows(d.workflows ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function saveWorkflow() {
    setSaving(true);
    const res = await fetch("/api/automation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.workflow) {
      setWorkflows((prev) => [data.workflow, ...prev]);
      setForm({ nom: "", type: "panier_abandonne", delaiHeures: 1, canal: "email", sujet: "", message: "" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function toggleWorkflow(workflow: Workflow) {
    const res = await fetch("/api/automation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: workflow.id, actif: !workflow.actif }),
    });
    const data = await res.json();
    if (data.workflow) setWorkflows((prev) => prev.map((w) => w.id === workflow.id ? data.workflow : w));
  }

  async function deleteWorkflow(id: string) {
    await fetch(`/api/automation?id=${id}`, { method: "DELETE" });
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const activeCount = workflows.filter((w) => w.actif).length;
  const totalDeclenchements = workflows.reduce((s, w) => s + w.declenchements, 0);
  const totalConversions = workflows.reduce((s, w) => s + w.conversions, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">Automation</h1>
          <p className="text-[12.5px] text-[#AAAAAA] mt-0.5">Séquences marketing automatiques</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-semibold"
          style={{ background: "#F5A623" }}
        >
          <Plus size={14} /> Nouveau workflow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-4">
          <p className="text-[11px] text-[#888] mb-1">Workflows actifs</p>
          <p className="text-2xl font-bold text-[#111]">{activeCount}</p>
        </div>
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-4">
          <p className="text-[11px] text-[#888] mb-1">Déclenchements</p>
          <p className="text-2xl font-bold text-[#111]">{totalDeclenchements}</p>
        </div>
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-4">
          <p className="text-[11px] text-[#888] mb-1">Conversions</p>
          <p className="text-2xl font-bold" style={{ color: "#10b981" }}>{totalConversions}</p>
        </div>
      </div>

      {/* Templates disponibles */}
      {!showForm && workflows.length === 0 && (
        <div>
          <p className="text-[13px] font-semibold text-[#111] mb-3">Workflows disponibles</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(TYPE_CONFIG).map(([type, config]) => (
              <div
                key={type}
                className="bg-white border border-[#F0F0F0] rounded-xl p-4 cursor-pointer hover:border-[#F5A623] transition-colors"
                onClick={() => { setForm((f) => ({ ...f, type, nom: config.label })); setShowForm(true); }}
              >
                <div className="flex items-start gap-3">
                  <config.Icon size={24} className="text-[#F5A623] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#111]">{config.label}</p>
                    <p className="text-[11px] text-[#888] mt-0.5">{config.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-5">
          <h3 className="text-[14px] font-semibold text-[#111] mb-4">Nouveau workflow</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Nom *</label>
              <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Type</label>
              <select className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Canal</label>
              <select className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.canal} onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))}>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Délai de déclenchement (heures)</label>
              <input type="number" className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.delaiHeures} min={0.5} step={0.5} onChange={(e) => setForm((f) => ({ ...f, delaiHeures: Number(e.target.value) }))} />
            </div>
            {form.canal === "email" && (
              <div>
                <label className="block text-[11px] text-[#888] mb-1">Sujet de l'email</label>
                <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.sujet} onChange={(e) => setForm((f) => ({ ...f, sujet: e.target.value }))} />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-[#888] mb-1">Message *</label>
              <textarea className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" rows={3} placeholder="Bonjour {{nom}}, tu as oublié quelque chose..." value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />
              <p className="text-[10px] text-[#AAA] mt-1">Variables: {"{{nom}}"}, {"{{email}}"}, {"{{montant}}"}, {"{{boutique}}"}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={saveWorkflow} disabled={saving || !form.nom || !form.message} className="px-4 py-2 rounded-lg text-white text-[13px] font-semibold disabled:opacity-50" style={{ background: "#F5A623" }}>
              {saving ? "Enregistrement..." : "Créer"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-[13px] text-[#666] border border-[#E5E5E5]">Annuler</button>
          </div>
        </div>
      )}

      {/* Liste workflows */}
      {workflows.length > 0 && (
        <div className="space-y-2">
          {workflows.map((w) => {
            const tc = TYPE_CONFIG[w.type] ?? { label: w.type, Icon: Zap, description: "" };
            const CanalIcon = CANAL_ICONS[w.canal] ?? Mail;
            const cvr = w.declenchements > 0 ? ((w.conversions / w.declenchements) * 100).toFixed(1) : "0";
            return (
              <div key={w.id} className={`bg-white border border-[#F0F0F0] rounded-xl p-4 flex items-center gap-4 ${!w.actif ? "opacity-60" : ""}`}>
                <tc.Icon size={24} className="shrink-0 text-[#F5A623]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#111] truncate">{w.nom}</p>
                    <CanalIcon size={11} className="text-[#888] shrink-0" />
                  </div>
                  <p className="text-[11px] text-[#888]">{tc.label} · {w.delaiHeures}h · {w.declenchements} décl. · {cvr}% conv.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleWorkflow(w)}
                    className="w-8 h-5 rounded-full relative transition-all"
                    style={{ background: w.actif ? "#10b981" : "#E5E5E5" }}
                  >
                    <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: w.actif ? "14px" : "2px" }} />
                  </button>
                  <button onClick={() => deleteWorkflow(w.id)} className="p-1.5 rounded-lg hover:bg-red-50">
                    <Trash2 size={13} className="text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
