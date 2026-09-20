"use client";

import { useEffect, useState } from "react";
import { Truck, Plus, Trash2, Save, Package, CheckCircle, Clock, MapPin, Bus, LayoutGrid, TableProperties } from "lucide-react";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";
import { FulfillmentKanban } from "@/components/dashboard/logistique/FulfillmentKanban";

interface ReglePort {
  id: string;
  nom: string;
  zone: string;
  poidsMin: number;
  poidsMax: number | null;
  montantMin: number | null;
  frais: number;
  fraisKg: number;
  delai: string;
  transporteur: string | null;
  gratuit: boolean;
  actif: boolean;
  modeLivraison: string;
}

const MODES_LIVRAISON = [
  { id: "livreur_local", label: "Livreur local (moto)" },
  { id: "agence_voyage", label: "Agence de voyage" },
  { id: "transporteur_intl", label: "Transporteur international" },
];

const AGENCES_SUGGEST = ["GEV", "Touristique Express", "Buca Voyages", "Vatican Express", "Finex Voyages"];

interface Commande {
  id: string;
  numero: string;
  clientNom: string;
  montantTotal: number;
  devise: string;
  statut: string;
  livraisonStatut: string;
  transporteur: string | null;
  numeroSuivi: string | null;
  createdAt: string;
}

const STATUT_COLORS: Record<string, string> = {
  non_expediee: "#6b7280",
  en_preparation: "#111111",
  expediee: "#3b82f6",
  livree: "#10b981",
  retour: "#ef4444",
};

const ZONES_SUGGEST = ["Cameroun", "Côte d'Ivoire", "Sénégal", "UEMOA", "CEMAC", "Afrique", "International"];

export function LivraisonPanel() {
  const [tab, setTab] = useState<"commandes" | "regles">("commandes");
  const [vue, setVue] = useState<"kanban" | "table">("kanban");
  const [regles, setRegles] = useState<ReglePort[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: "", zone: "", poidsMin: 0, poidsMax: "", montantMin: "",
    frais: 0, fraisKg: 0, delai: "3-5 jours", transporteur: "", gratuit: false,
    modeLivraison: "livreur_local",
  });
  const [zonesConfigurees, setZonesConfigurees] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/livraison/regles").then((r) => r.json()),
      fetch("/api/commandes").then((r) => r.json()),
      fetch("/api/tenants/moi").then((r) => r.json()),
    ]).then(([{ regles }, data, tenantData]) => {
      setRegles(regles ?? []);
      setCommandes(data?.commandes ?? []);
      const zones = tenantData?.tenant?.parametresLivraison?.zones ?? [];
      if (zones.length > 0) setZonesConfigurees(zones);
    }).finally(() => setLoading(false));
  }, []);

  const zonesSuggestions = zonesConfigurees.length > 0 ? zonesConfigurees : ZONES_SUGGEST;

  async function saveRegle() {
    setSaving(true);
    const res = await fetch("/api/livraison/regles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        poidsMax: form.poidsMax ? Number(form.poidsMax) : null,
        montantMin: form.montantMin ? Number(form.montantMin) : null,
        frais: Number(form.frais),
        fraisKg: Number(form.fraisKg),
      }),
    });
    const data = await res.json();
    if (data.regle) {
      setRegles((prev) => [data.regle, ...prev]);
      setForm({ nom: "", zone: "", poidsMin: 0, poidsMax: "", montantMin: "", frais: 0, fraisKg: 0, delai: "3-5 jours", transporteur: "", gratuit: false, modeLivraison: "livreur_local" });
      setShowForm(false);
    }
    setSaving(false);
  }

  async function deleteRegle(id: string) {
    await fetch(`/api/livraison/regles?id=${id}`, { method: "DELETE" });
    setRegles((prev) => prev.filter((r) => r.id !== id));
  }

  async function toggleRegle(regle: ReglePort) {
    const res = await fetch("/api/livraison/regles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: regle.id, actif: !regle.actif }),
    });
    const data = await res.json();
    if (data.regle) setRegles((prev) => prev.map((r) => r.id === regle.id ? data.regle : r));
  }

  const stats = {
    enPrep: commandes.filter((c) => c.livraisonStatut === "en_preparation").length,
    expediees: commandes.filter((c) => c.livraisonStatut === "expediee").length,
    livrees: commandes.filter((c) => c.livraisonStatut === "livree").length,
    nonExpediees: commandes.filter((c) => c.livraisonStatut === "non_expediee").length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-[#F5A623] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <AgentActiveIndicator label="Agent Livraison actif" />
        {tab === "regles" && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[13px] font-semibold ml-auto"
            style={{ background: "#F5A623" }}
          >
            <Plus size={14} /> Nouvelle règle
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Non expédiées", value: stats.nonExpediees, color: "#6b7280", icon: Clock },
          { label: "En préparation", value: stats.enPrep, color: "#111111", icon: Package },
          { label: "Expédiées", value: stats.expediees, color: "#3b82f6", icon: Truck },
          { label: "Livrées", value: stats.livrees, color: "#10b981", icon: CheckCircle },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-white border border-[#F0F0F0] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={14} style={{ color }} />
              <span className="text-[11px] text-[#888]">{label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Sous-onglets */}
      <div className="flex gap-1 bg-[#F5F5F5] p-1 rounded-xl w-fit">
        {(["commandes", "regles"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-lg text-[13px] font-medium transition-all"
            style={tab === t ? { background: "white", color: "#111", boxShadow: "0 1px 3px rgba(0,0,0,.08)" } : { color: "#888" }}
          >
            {t === "commandes" ? "Commandes" : "Règles tarifaires"}
          </button>
        ))}
      </div>

      {/* Règles tarifaires */}
      {tab === "regles" && (
        <div className="space-y-4">
          {showForm && (
            <div className="bg-white border border-[#F0F0F0] rounded-xl p-5">
              <h3 className="text-[14px] font-semibold text-[#111] mb-4">Nouvelle règle de port</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Nom de la règle</label>
                  <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" placeholder="ex: Standard Cameroun" value={form.nom} onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Zone</label>
                  <input list="zones-list" className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" placeholder="Cameroun" value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))} />
                  <datalist id="zones-list">{zonesSuggestions.map((z) => <option key={z} value={z} />)}</datalist>
                  {zonesConfigurees.length === 0 && (
                    <p className="text-[10px] text-[#AAA] mt-1">Configurez vos zones/quartiers dans Ma boutique → Livraison pour un sélecteur précis au checkout.</p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Mode de livraison</label>
                  <select className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.modeLivraison} onChange={(e) => setForm((f) => ({ ...f, modeLivraison: e.target.value }))}>
                    {MODES_LIVRAISON.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Frais (devise boutique)</label>
                  <input type="number" className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.frais} onChange={(e) => setForm((f) => ({ ...f, frais: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Frais/kg supplémentaire</label>
                  <input type="number" className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.fraisKg} onChange={(e) => setForm((f) => ({ ...f, fraisKg: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Délai estimé</label>
                  <input className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" value={form.delai} onChange={(e) => setForm((f) => ({ ...f, delai: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">{form.modeLivraison === "agence_voyage" ? "Agence de voyage" : "Transporteur (optionnel)"}</label>
                  <input list={form.modeLivraison === "agence_voyage" ? "agences-list" : undefined}
                    className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]"
                    placeholder={form.modeLivraison === "agence_voyage" ? "GEV, Touristique Express..." : "Campost, DHL, MTN..."}
                    value={form.transporteur} onChange={(e) => setForm((f) => ({ ...f, transporteur: e.target.value }))} />
                  {form.modeLivraison === "agence_voyage" && (
                    <datalist id="agences-list">{AGENCES_SUGGEST.map((a) => <option key={a} value={a} />)}</datalist>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1">Montant commande min (optionnel)</label>
                  <input type="number" className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-[13px]" placeholder="0" value={form.montantMin} onChange={(e) => setForm((f) => ({ ...f, montantMin: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input type="checkbox" id="gratuit" checked={form.gratuit} onChange={(e) => setForm((f) => ({ ...f, gratuit: e.target.checked }))} />
                  <label htmlFor="gratuit" className="text-[13px] text-[#444]">Livraison gratuite (ignorer les frais)</label>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveRegle} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-semibold" style={{ background: "#F5A623" }}>
                  <Save size={14} /> {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-[13px] text-[#666] border border-[#E5E5E5]">Annuler</button>
              </div>
            </div>
          )}

          {regles.length === 0 ? (
            <div className="bg-white border border-dashed border-[#E5E5E5] rounded-xl p-10 text-center">
              <MapPin size={32} className="mx-auto mb-3 text-[#DDD]" />
              <p className="text-[13px] text-[#888]">Aucune règle de livraison. Crée ta première règle tarifaire.</p>
              <button onClick={() => setShowForm(true)} className="mt-4 px-4 py-2 rounded-lg text-white text-[13px] font-semibold" style={{ background: "#F5A623" }}>
                Créer une règle
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {regles.map((r) => (
                <div key={r.id} className={`bg-white border rounded-xl p-4 flex items-center justify-between gap-4 ${!r.actif ? "opacity-50" : ""}`} style={{ borderColor: "#F0F0F0" }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "#FFF8EC" }}>
                      <MapPin size={16} style={{ color: "#F5A623" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-semibold text-[#111] truncate">{r.nom}</p>
                        {r.modeLivraison === "agence_voyage" && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#4338CA]"><Bus size={9} /> Agence</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#888]">{r.zone} · {r.delai} {r.transporteur ? `· ${r.transporteur}` : ""}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-[#111]">
                      {r.gratuit ? "Gratuit" : `${r.frais.toLocaleString()} + ${r.fraisKg}/kg`}
                    </p>
                    {r.montantMin && <p className="text-[10px] text-[#AAA]">dès {r.montantMin.toLocaleString()}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleRegle(r)}
                      className="w-8 h-5 rounded-full relative transition-all"
                      style={{ background: r.actif ? "#10b981" : "#E5E5E5" }}
                    >
                      <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: r.actif ? "14px" : "2px" }} />
                    </button>
                    <button onClick={() => deleteRegle(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 size={13} className="text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Commandes */}
      {tab === "commandes" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <div className="flex gap-1 bg-[#F5F5F5] p-1 rounded-xl w-fit">
              <button onClick={() => setVue("kanban")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                style={vue === "kanban" ? { background: "white", color: "#111", boxShadow: "0 1px 3px rgba(0,0,0,.08)" } : { color: "#888" }}>
                <LayoutGrid size={12} /> Kanban
              </button>
              <button onClick={() => setVue("table")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
                style={vue === "table" ? { background: "white", color: "#111", boxShadow: "0 1px 3px rgba(0,0,0,.08)" } : { color: "#888" }}>
                <TableProperties size={12} /> Tableau
              </button>
            </div>
          </div>

          {vue === "kanban" && <FulfillmentKanban />}
        </div>
      )}

      {tab === "commandes" && vue === "table" && (
        <div className="bg-white border border-[#F0F0F0] rounded-xl overflow-hidden">
          {commandes.length === 0 ? (
            <div className="p-10 text-center">
              <Truck size={32} className="mx-auto mb-3 text-[#DDD]" />
              <p className="text-[13px] text-[#888]">Aucune commande à expédier pour l'instant.</p>
            </div>
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-[#F0F0F0]">
                  <th className="text-left px-4 py-3 font-semibold text-[#888]">Commande</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#888]">Client</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#888]">Montant</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#888]">Livraison</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#888]">Suivi</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map((c) => (
                  <tr key={c.id} className="border-b border-[#F8F8F8] hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3 font-mono text-[#111]">{c.numero}</td>
                    <td className="px-4 py-3 text-[#444]">{c.clientNom}</td>
                    <td className="px-4 py-3 font-semibold text-[#111]">{c.montantTotal.toLocaleString()} {c.devise}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ background: STATUT_COLORS[c.livraisonStatut] ?? "#999" }}>
                        {c.livraisonStatut.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#888]">{c.numeroSuivi ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
