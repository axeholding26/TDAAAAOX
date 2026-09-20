"use client";
import { useEffect, useState } from "react";
import { Plus, Star, Package, Warehouse } from "lucide-react";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const ENTREPOTS_TUTORIAL_STEPS = [
  { Icon: Plus,      titre: "Ajoute un entrepôt",           description: "Renseigne le nom, la ville et l'adresse pour créer un nouveau point de stockage." },
  { Icon: Star,      titre: "Définis l'entrepôt principal", description: "Marque un entrepôt comme principal — c'est celui utilisé par défaut pour ton stock." },
  { Icon: Package,   titre: "Suis le stock par site",       description: "Chaque entrepôt affiche le nombre de SKUs qui y sont stockés." },
  { Icon: Warehouse, titre: "Active ou désactive",          description: "Désactive temporairement un entrepôt sans perdre son historique de stock." },
];

interface Entrepot {
  id: string;
  nom: string;
  adresse: string | null;
  ville: string | null;
  pays: string;
  principal: boolean;
  actif: boolean;
  _count: { stocks: number };
}

const EMPTY = { nom: "", adresse: "", ville: "", pays: "Cameroun", principal: false };

export default function EntrepotsPage() {
  const [entrepots, setEntrepots] = useState<Entrepot[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/entrepots").then(r => r.json());
    setEntrepots(r.entrepots ?? []);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setLoading(true);
    const method = editId ? "PATCH" : "POST";
    const body = editId ? { ...form, id: editId } : form;
    await fetch("/api/entrepots", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setForm({ ...EMPTY });
    setEditId(null);
    await load();
    setLoading(false);
  }

  async function toggleActif(e: Entrepot) {
    await fetch("/api/entrepots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id, actif: !e.actif }) });
    load();
  }

  async function setPrincipal(e: Entrepot) {
    await fetch("/api/entrepots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: e.id, principal: true }) });
    load();
  }

  async function del(id: string) {
    if (!confirm("Supprimer cet entrepôt ?")) return;
    await fetch(`/api/entrepots?id=${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(e: Entrepot) {
    setEditId(e.id);
    setForm({ nom: e.nom, adresse: e.adresse ?? "", ville: e.ville ?? "", pays: e.pays, principal: e.principal });
  }

  const inp = "w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#F5A623]/60";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <ModuleTutorial moduleKey="entrepots" titre="Entrepôts" sousTitre="Tes points de stockage" steps={ENTREPOTS_TUTORIAL_STEPS} />
      <div>
        <h1 className="text-[22px] font-bold text-[#111] inline-flex items-center gap-2">
          Entrepôts <AgentActiveIndicator label="Agent Stock actif" />
          <BoutonRevoirTutoriel moduleKey="entrepots" />
        </h1>
        <p className="text-[13px] text-[#888] mt-0.5">Gestion des stocks multi-entrepôts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", v: entrepots.length },
          { label: "Actifs", v: entrepots.filter(e => e.actif).length },
          { label: "SKUs stockés", v: entrepots.reduce((s, e) => s + e._count.stocks, 0) },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#F0F0F0] rounded-2xl p-4 text-center">
            <p className="text-[24px] font-bold text-[#111]">{s.v}</p>
            <p className="text-[11px] text-[#AAA] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="bg-white border border-[#F0F0F0] rounded-2xl p-5 space-y-3">
        <h2 className="text-[14px] font-bold text-[#111]">{editId ? "Modifier l'entrepôt" : "Nouvel entrepôt"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <input className={inp} placeholder="Nom (ex: Entrepôt Douala)" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
          <input className={inp} placeholder="Ville" value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} />
          <input className={inp} placeholder="Adresse" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
          <input className={inp} placeholder="Pays" value={form.pays} onChange={e => setForm(f => ({ ...f, pays: e.target.value }))} />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-[#555] cursor-pointer">
          <input type="checkbox" checked={form.principal} onChange={e => setForm(f => ({ ...f, principal: e.target.checked }))} />
          Entrepôt principal
        </label>
        <div className="flex gap-2">
          <button
            onClick={save} disabled={!form.nom || loading}
            className="px-5 py-2 rounded-xl text-white text-[13px] font-semibold disabled:opacity-40"
            style={{ background: "#F5A623" }}
          >
            {loading ? "..." : editId ? "Modifier" : "Créer"}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm({ ...EMPTY }); }} className="px-4 py-2 rounded-xl border border-[#E8E8E8] text-[13px] text-[#666]">
              Annuler
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {entrepots.map(e => (
          <div key={e.id} className="bg-white border border-[#F0F0F0] rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[#111]">{e.nom}</span>
                {e.principal && <span className="text-[10px] bg-[#F5A623]/15 text-[#F5A623] px-2 py-0.5 rounded-full font-bold">Principal</span>}
                {!e.actif && <span className="text-[10px] bg-[#F0F0F0] text-[#AAA] px-2 py-0.5 rounded-full">Inactif</span>}
              </div>
              <p className="text-[12px] text-[#888] mt-0.5">{[e.adresse, e.ville, e.pays].filter(Boolean).join(", ")} · {e._count.stocks} SKU(s)</p>
            </div>
            <div className="flex items-center gap-2">
              {!e.principal && (
                <button onClick={() => setPrincipal(e)} className="text-[11px] text-[#F5A623] border border-[#F5A623]/30 px-2 py-1 rounded-lg">
                  Définir principal
                </button>
              )}
              <button onClick={() => startEdit(e)} className="text-[11px] text-[#666] border border-[#E8E8E8] px-2 py-1 rounded-lg">Modifier</button>
              <button onClick={() => toggleActif(e)} className="text-[11px] text-[#666] border border-[#E8E8E8] px-2 py-1 rounded-lg">
                {e.actif ? "Désactiver" : "Activer"}
              </button>
              <button onClick={() => del(e.id)} className="text-[11px] text-red-500 border border-red-100 px-2 py-1 rounded-lg">Supprimer</button>
            </div>
          </div>
        ))}
        {!entrepots.length && (
          <div className="bg-[#FAFAFA] rounded-2xl p-8 text-center text-[13px] text-[#AAA]">
            Aucun entrepôt. Crée ton premier entrepôt pour gérer le stock multi-site.
          </div>
        )}
      </div>
    </div>
  );
}
