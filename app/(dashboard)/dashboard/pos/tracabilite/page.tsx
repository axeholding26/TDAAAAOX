"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Boxes, Plus, AlertTriangle, XCircle, CheckCircle2, Ban, Package } from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const TRACABILITE_TUTORIAL_STEPS = [
  { Icon: Plus,           titre: "Réceptionner un lot",  description: "À chaque livraison fournisseur, enregistre un lot : quantité, date de péremption, référence — le stock du produit est crédité automatiquement." },
  { Icon: Boxes,          titre: "Consommation FIFO",    description: "Chaque vente en caisse consomme automatiquement le lot actif le plus ancien du produit — premier entré, premier sorti." },
  { Icon: AlertTriangle,  titre: "Alertes péremption",   description: "Les lots qui expirent sous 7 jours ou déjà expirés sont mis en évidence pour que rien ne se périme sans que tu le saches." },
  { Icon: Ban,            titre: "Rappel produit",       description: "En cas de problème, marque un lot \"Périmé\" ou \"Rappelé\" — son solde est retiré du stock vendable, et tu peux remonter jusqu'à chaque vente concernée." },
];

interface Produit { id: string; nom: string; }
interface Lot {
  id: string; codeLot: string; quantiteInitiale: number; quantiteRestante: number;
  fournisseurNom: string | null; dateReception: string; dateExpiration: string | null;
  statut: string; expireBientot: boolean; expire: boolean;
  produit: { nom: string; images: string[]; sku: string | null };
}

const STATUT_CFG: Record<string, { label: string; cls: string }> = {
  actif:   { label: "Actif",    cls: "bg-green-100 text-green-700" },
  epuise:  { label: "Épuisé",   cls: "bg-gray-100 text-gray-500" },
  perime:  { label: "Périmé",   cls: "bg-red-100 text-red-600" },
  rappele: { label: "Rappelé",  cls: "bg-red-100 text-red-600" },
};

const EMPTY = { produitId: "", codeLot: "", quantiteInitiale: "", fournisseurNom: "", fournisseurRef: "", dateExpiration: "", certification: "" };

function NouveauLotForm({ produits, onDone }: { produits: Produit[]; onDone: () => void }) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  async function creer() {
    if (!form.produitId || !form.codeLot || !form.quantiteInitiale) { toast.error("Produit, code lot et quantité requis"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/pos/lots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Lot enregistré — stock crédité");
      setForm({ ...EMPTY });
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  }

  const inp = "mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60";

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
      <p className="text-[13px] font-bold text-[#111]">Réceptionner un nouveau lot</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Produit *</label>
          <select value={form.produitId} onChange={e => setForm(v => ({ ...v, produitId: e.target.value }))} className={`${inp} bg-white`}>
            <option value="">Sélectionner…</option>
            {produits.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Code de lot *</label>
          <input value={form.codeLot} onChange={e => setForm(v => ({ ...v, codeLot: e.target.value }))} placeholder="LOT-2026-001" className={inp} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Quantité reçue *</label>
          <input type="number" value={form.quantiteInitiale} onChange={e => setForm(v => ({ ...v, quantiteInitiale: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Date de péremption</label>
          <input type="date" value={form.dateExpiration} onChange={e => setForm(v => ({ ...v, dateExpiration: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Fournisseur</label>
          <input value={form.fournisseurNom} onChange={e => setForm(v => ({ ...v, fournisseurNom: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Référence / certification</label>
          <input value={form.certification} onChange={e => setForm(v => ({ ...v, certification: e.target.value }))} placeholder="N° certificat, origine..." className={inp} />
        </div>
      </div>
      <button onClick={creer} disabled={saving} className="px-5 py-2.5 bg-[#F5A623] text-white rounded-xl text-[12.5px] font-bold disabled:opacity-50">
        {saving ? "…" : "Enregistrer le lot"}
      </button>
    </div>
  );
}

export default function TracabilitePage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtre, setFiltre] = useState("all");

  const charger = useCallback(() => {
    fetch(`/api/pos/lots?statut=${filtre}`).then(r => r.json()).then(d => {
      setLots(d.lots ?? []); setStats(d.stats ?? null); setLoading(false);
    }).catch(() => setLoading(false));
  }, [filtre]);

  useEffect(() => { charger(); }, [charger]);
  useEffect(() => {
    fetch("/api/pos/stock").then(r => r.json()).then(d => setProduits((d.produits ?? []).map((p: any) => ({ id: p.id, nom: p.nom }))));
  }, []);

  async function changerStatut(id: string, statut: string) {
    await fetch(`/api/pos/lots/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statut }) });
    toast.success("Lot mis à jour");
    charger();
  }

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="pos-tracabilite" titre="Traçabilité" sousTitre="Module Point de vente" steps={TRACABILITE_TUTORIAL_STEPS} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-bold text-[#111]">Traçabilité</h1>
            <BoutonRevoirTutoriel moduleKey="pos-tracabilite" />
          </div>
          <p className="text-[12px] text-gray-500">Lots reçus, péremption et rappel produit</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="px-4 py-2 bg-[#F5A623] text-white rounded-xl text-[12px] font-bold flex items-center gap-1.5">
          <Plus size={13} /> Nouveau lot
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
            <p className="text-[20px] font-bold text-green-600">{stats.actifs}</p>
            <p className="text-[10.5px] text-gray-400 mt-0.5">Lots actifs</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
            <p className="text-[20px] font-bold text-amber-500">{stats.expirantBientot}</p>
            <p className="text-[10.5px] text-gray-400 mt-0.5">Expirent sous 7j</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4 text-center">
            <p className="text-[20px] font-bold text-red-500">{stats.expires}</p>
            <p className="text-[10.5px] text-gray-400 mt-0.5">Expirés (à traiter)</p>
          </div>
        </div>
      )}

      {showForm && <NouveauLotForm produits={produits} onDone={() => { setShowForm(false); charger(); }} />}

      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 w-fit">
        {["all", "actif", "epuise", "perime", "rappele"].map(f => (
          <button key={f} onClick={() => setFiltre(f)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold ${filtre === f ? "bg-white shadow-sm text-[#111]" : "text-gray-500"}`}>
            {f === "all" ? "Tous" : STATUT_CFG[f]?.label ?? f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Chargement…</div>
      ) : lots.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <Boxes size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-[#111]">Aucun lot enregistré</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lots.map(l => (
            <div key={l.id} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                {l.produit.images[0] ? <img src={l.produit.images[0]} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><Package size={16} className="text-gray-300" /></div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[13px] font-semibold text-[#111]">{l.produit.nom}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUT_CFG[l.statut]?.cls}`}>{STATUT_CFG[l.statut]?.label}</span>
                    {l.expireBientot && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><AlertTriangle size={9} /> Expire bientôt</span>}
                    {l.expire && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex items-center gap-1"><XCircle size={9} /> Expiré</span>}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Lot <span className="font-mono font-bold text-[#F5A623]">{l.codeLot}</span> · Reste {l.quantiteRestante}/{l.quantiteInitiale}
                    {l.fournisseurNom && ` · ${l.fournisseurNom}`}
                    {l.dateExpiration && ` · Péremption ${new Date(l.dateExpiration).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
              </div>
              {l.statut === "actif" && (
                <div className="mt-3 flex gap-2">
                  <button onClick={() => changerStatut(l.id, "epuise")} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold">
                    <CheckCircle2 size={10} /> Marquer épuisé
                  </button>
                  <button onClick={() => changerStatut(l.id, "perime")} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-[10px] font-bold">
                    <XCircle size={10} /> Périmé
                  </button>
                  <button onClick={() => { if (confirm("Retirer ce lot du stock vendable (rappel produit) ?")) changerStatut(l.id, "rappele"); }} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-[10px] font-bold">
                    <Ban size={10} /> Rappeler
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
