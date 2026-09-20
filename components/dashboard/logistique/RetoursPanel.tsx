"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle, Clock, Plus, ChevronDown } from "lucide-react";
import { ModuleTutorial } from "@/components/dashboard/ModuleTutorial";

const RETOURS_TUTORIAL_STEPS = [
  { Icon: Plus,         titre: "Crée un retour",       description: "Renseigne l'ID commande, la raison et le type de résolution (remboursement, échange, avoir)." },
  { Icon: Clock,        titre: "Suis la progression",  description: "Fais passer un retour de \"Ouvert\" à \"En cours\" pendant qu'il est traité." },
  { Icon: CheckCircle,  titre: "Accepte ou rejette",   description: "Décide du sort du retour : accepter, rejeter ou clore une fois la décision prise." },
  { Icon: ChevronDown,  titre: "Consulte les détails", description: "Clique sur une ligne pour voir la description, l'email du client et les notes internes." },
];

interface Retour {
  id: string;
  commandeId: string;
  clientNom: string;
  clientEmail: string;
  raison: string;
  description: string | null;
  type: string;
  statut: string;
  montant: number | null;
  notes: string | null;
  createdAt: string;
  commande: { numero: string; montantTotal: number; devise: string };
}

interface Stats {
  total: number;
  ouverts: number;
  enCours: number;
  acceptes: number;
}

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  ouvert: { label: "Ouvert", color: "#f59e0b" },
  en_cours: { label: "En cours", color: "#111111" },
  accepte: { label: "Accepté", color: "#10b981" },
  rejete: { label: "Rejeté", color: "#ef4444" },
  clos: { label: "Clos", color: "#6b7280" },
};

const RAISON_LABELS: Record<string, string> = {
  defaut: "Produit défectueux",
  erreur_commande: "Erreur de commande",
  change_avis: "Changement d'avis",
  endommage: "Produit endommagé",
  non_recu: "Non reçu",
};

const TYPE_LABELS: Record<string, string> = {
  remboursement: "Remboursement",
  echange: "Échange",
  avoir: "Avoir",
};

export function RetoursPanel() {
  const [retours, setRetours] = useState<Retour[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, ouverts: 0, enCours: 0, acceptes: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({
    commandeId: "", clientNom: "", clientEmail: "",
    raison: "defaut", description: "", type: "remboursement", montant: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/retours")
      .then((r) => r.json())
      .then((d) => { setRetours(d.retours ?? []); setStats(d.stats ?? {}); })
      .finally(() => setLoading(false));
  }, []);

  async function updateStatut(id: string, statut: string) {
    const res = await fetch("/api/retours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, statut }),
    });
    const data = await res.json();
    if (data.retour) setRetours((prev) => prev.map((r) => r.id === id ? { ...r, statut } : r));
  }

  async function createRetour() {
    setSaving(true);
    const res = await fetch("/api/retours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, montant: form.montant ? Number(form.montant) : undefined }),
    });
    const data = await res.json();
    if (data.retour) {
      setRetours((prev) => [data.retour, ...prev]);
      setShowForm(false);
    }
    setSaving(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <ModuleTutorial moduleKey="logistique-retours" titre="Retours" sousTitre="Gestion des retours & RMA" steps={RETOURS_TUTORIAL_STEPS} />
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-semibold"
          style={{ background: "#F5A623" }}
        >
          <Plus size={14} /> Créer un retour
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, color: "#111" },
          { label: "Ouverts", value: stats.ouverts, color: "#f59e0b" },
          { label: "En cours", value: stats.enCours, color: "#111111" },
          { label: "Acceptés", value: stats.acceptes, color: "#10b981" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-[#F0F0F0] rounded-xl p-4">
            <p className="text-[11px] text-[#888] mb-1">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div className="bg-white border border-[#F0F0F0] rounded-xl p-5">
          <h3 className="text-[14px] font-semibold text-[#111] mb-4">Nouveau retour</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#888] mb-1">ID Commande</label>
              <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" placeholder="cuid..." value={form.commandeId} onChange={(e) => setForm((f) => ({ ...f, commandeId: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Nom client</label>
              <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.clientNom} onChange={(e) => setForm((f) => ({ ...f, clientNom: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Email client</label>
              <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.clientEmail} onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Raison</label>
              <select className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.raison} onChange={(e) => setForm((f) => ({ ...f, raison: e.target.value }))}>
                {Object.entries(RAISON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Type de résolution</label>
              <select className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#888] mb-1">Montant à rembourser (optionnel)</label>
              <input type="number" className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.montant} onChange={(e) => setForm((f) => ({ ...f, montant: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-[#888] mb-1">Description (optionnel)</label>
              <textarea className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={createRetour} disabled={saving} className="px-4 py-2 rounded-lg text-white text-[13px] font-semibold" style={{ background: "#F5A623" }}>
              {saving ? "Enregistrement..." : "Créer le retour"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-[13px] text-[#666] border border-[#E5E5E5]">Annuler</button>
          </div>
        </div>
      )}

      {/* Liste des retours */}
      {retours.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E5E5E5] rounded-xl p-10 text-center">
          <RefreshCw size={32} className="mx-auto mb-3 text-[#DDD]" />
          <p className="text-[13px] text-[#888]">Aucun retour pour l'instant. C'est bon signe !</p>
        </div>
      ) : (
        <div className="space-y-2">
          {retours.map((r) => {
            const sc = STATUT_CONFIG[r.statut] ?? { label: r.statut, color: "#888" };
            const isExpanded = expanded === r.id;
            return (
              <div key={r.id} className="bg-white border border-[#F0F0F0] rounded-xl overflow-hidden">
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : r.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] font-semibold text-[#111]">{r.clientNom}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: sc.color }}>{sc.label}</span>
                      <span className="text-[10px] text-[#AAA]">{TYPE_LABELS[r.type] ?? r.type}</span>
                    </div>
                    <p className="text-[11px] text-[#888] mt-0.5">
                      Cmd {r.commande.numero} · {RAISON_LABELS[r.raison] ?? r.raison}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {r.montant && <p className="text-[13px] font-bold text-[#111]">{r.montant.toLocaleString()} {r.commande.devise}</p>}
                    <p className="text-[10px] text-[#AAA]">{new Date(r.createdAt).toLocaleDateString("fr")}</p>
                  </div>
                  <ChevronDown size={14} className="text-[#CCC] shrink-0" style={{ transform: isExpanded ? "rotate(180deg)" : "none" }} />
                </div>

                {isExpanded && (
                  <div className="border-t border-[#F0F0F0] p-4 bg-[#FAFAFA]">
                    {r.description && <p className="text-[12px] text-[#555] mb-3">{r.description}</p>}
                    <p className="text-[11px] text-[#888] mb-3">Email client : {r.clientEmail}</p>
                    {r.notes && <p className="text-[11px] text-[#666] mb-3 italic">Note : {r.notes}</p>}
                    <div className="flex gap-2 flex-wrap">
                      {r.statut !== "accepte" && (
                        <button onClick={() => updateStatut(r.id, "accepte")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold" style={{ background: "#10b981" }}>
                          <CheckCircle size={12} /> Accepter
                        </button>
                      )}
                      {r.statut !== "en_cours" && r.statut !== "clos" && (
                        <button onClick={() => updateStatut(r.id, "en_cours")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold" style={{ background: "#111111" }}>
                          <Clock size={12} /> En cours
                        </button>
                      )}
                      {r.statut !== "rejete" && (
                        <button onClick={() => updateStatut(r.id, "rejete")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold" style={{ background: "#ef4444" }}>
                          <XCircle size={12} /> Rejeter
                        </button>
                      )}
                      {r.statut !== "clos" && (
                        <button onClick={() => updateStatut(r.id, "clos")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-[#666] border border-[#E5E5E5]">
                          Clore
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
