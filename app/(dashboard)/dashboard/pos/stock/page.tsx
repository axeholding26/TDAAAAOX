"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Package, AlertTriangle, XCircle, Search, Plus, Minus, RotateCcw,
  Clock, ArrowUpRight, ArrowDownRight, Wallet, Box,
} from "lucide-react";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const STOCK_TUTORIAL_STEPS = [
  { Icon: Box,        titre: "Vue d'ensemble du stock", description: "Chaque produit physique de ta boutique avec son stock actuel, sa valeur (au coût d'achat) et son statut — OK, stock bas ou rupture." },
  { Icon: Plus,        titre: "Mouvements de stock",     description: "Clique \"Mouvement\" sur un produit pour enregistrer une entrée (réassort), une sortie, une perte ou un ajustement après inventaire." },
  { Icon: Clock,       titre: "Journal complet",         description: "Chaque mouvement — manuel ou automatique via une vente en caisse — est journalisé avec la date, le motif et le solde avant/après." },
];

interface Produit {
  id: string; nom: string; images: string[]; sku: string | null; categorie: string | null;
  stock: number; stockMin: number | null; cout: number | null; prix: number;
  statutStock: "ok" | "bas" | "rupture";
  lotsTracabilite: { id: string; codeLot: string; quantiteRestante: number; dateExpiration: string | null }[];
}
interface Mouvement {
  id: string; type: string; quantite: number; stockAvant: number; stockApres: number;
  motif: string | null; createdAt: string; produit: { nom: string; images: string[] };
}

const TYPE_CFG: Record<string, { label: string; color: string; Icon: any }> = {
  entree:     { label: "Entrée",     color: "#10b981", Icon: ArrowUpRight },
  sortie:     { label: "Sortie",     color: "#3b82f6", Icon: ArrowDownRight },
  vente:      { label: "Vente",      color: "#F5A623", Icon: ArrowDownRight },
  perte:      { label: "Perte",      color: "#ef4444", Icon: XCircle },
  ajustement: { label: "Ajustement", color: "#8b5cf6", Icon: RotateCcw },
};

function StatCard({ label, value, sub, color = "#F5A623", Icon }: { label: string; value: string; sub?: string; color?: string; Icon: any }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-[22px] font-bold text-[#111] leading-none">{value}</p>
      <p className="text-[11px] text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color }}>{sub}</p>}
    </div>
  );
}

function MouvementModal({ produit, onClose, onDone }: { produit: Produit; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<"entree" | "sortie" | "perte" | "ajustement">("entree");
  const [quantite, setQuantite] = useState("");
  const [motif, setMotif] = useState("");
  const [loading, setLoading] = useState(false);

  async function soumettre() {
    if (!quantite) return;
    setLoading(true);
    try {
      const body: any = { produitId: produit.id, type, motif };
      if (type === "ajustement") body.nouveauStock = Number(quantite);
      else body.quantite = Number(quantite);
      const res = await fetch("/api/pos/stock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Stock mis à jour");
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-[13px] font-bold text-[#111]">{produit.nom}</p>
          <p className="text-[11px] text-gray-400">Stock actuel : {produit.stock}</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(["entree", "sortie", "perte", "ajustement"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className="py-2 rounded-xl text-[10.5px] font-bold border transition-all"
              style={{ borderColor: type === t ? TYPE_CFG[t].color : "#E5E7EB", background: type === t ? `${TYPE_CFG[t].color}12` : "white", color: type === t ? TYPE_CFG[t].color : "#9CA3AF" }}>
              {TYPE_CFG[t].label}
            </button>
          ))}
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            {type === "ajustement" ? "Nouveau stock (valeur exacte)" : "Quantité"}
          </label>
          <input type="number" value={quantite} onChange={e => setQuantite(e.target.value)}
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Motif (optionnel)</label>
          <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex: inventaire mensuel, casse..."
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60" />
        </div>
        <div className="flex gap-2">
          <button onClick={soumettre} disabled={!quantite || loading}
            className="flex-1 py-2.5 bg-[#F5A623] text-white rounded-xl text-[12.5px] font-bold disabled:opacity-50">
            {loading ? "…" : "Valider"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 rounded-xl text-[12.5px] text-gray-600">Annuler</button>
        </div>
      </div>
    </div>
  );
}

export default function PosStockPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState("all");
  const [modalProduit, setModalProduit] = useState<Produit | null>(null);

  const charger = useCallback(() => {
    const qs = new URLSearchParams({ search, filtre });
    fetch(`/api/pos/stock?${qs}`).then(r => r.json()).then(d => {
      setProduits(d.produits ?? []); setMouvements(d.mouvementsRecents ?? []); setStats(d.stats ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [search, filtre]);

  useEffect(() => { charger(); }, [charger]);

  return (
    <div className="p-5 max-w-5xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="pos-stock" titre="Gestion des stocks" sousTitre="Module Point de vente" steps={STOCK_TUTORIAL_STEPS} />
      <div className="flex items-center gap-2">
        <h1 className="text-[18px] font-bold text-[#111]">Gestion des stocks</h1>
        <BoutonRevoirTutoriel moduleKey="pos-stock" />
      </div>
      <p className="text-[12px] text-gray-500 -mt-4">Inventaire, mouvements et alertes de la boutique physique</p>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Produits suivis" value={String(stats.total)} Icon={Box} color="#1B2A4A" />
          <StatCard label="Stock bas" value={String(stats.stockBas)} Icon={AlertTriangle} color="#F5A623" />
          <StatCard label="En rupture" value={String(stats.enRupture)} Icon={XCircle} color="#ef4444" />
          <StatCard label="Valeur du stock" value={`${stats.valeurStock.toLocaleString()} XAF`} Icon={Wallet} color="#10b981" />
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit…"
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-[12px] outline-none focus:border-[#F5A623]/50" />
        </div>
        <select value={filtre} onChange={e => setFiltre(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none bg-white">
          <option value="all">Tous</option>
          <option value="bas">Stock bas</option>
          <option value="rupture">Rupture</option>
        </select>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Chargement…</div>
      ) : produits.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <Package size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-[#111]">Aucun produit physique</p>
        </div>
      ) : (
        <div className="space-y-2">
          {produits.map(p => (
            <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
              {p.images[0] ? <img src={p.images[0]} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" /> : <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0"><Package size={16} className="text-gray-300" /></div>}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#111] truncate">{p.nom}</p>
                <p className="text-[11px] text-gray-400">
                  {p.sku && `${p.sku} · `}Stock : <strong style={{ color: p.statutStock === "rupture" ? "#ef4444" : p.statutStock === "bas" ? "#F5A623" : "#111" }}>{p.stock}</strong>
                  {p.lotsTracabilite.length > 0 && ` · ${p.lotsTracabilite.length} lot(s) actif(s)`}
                </p>
              </div>
              {p.statutStock !== "ok" && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${p.statutStock === "rupture" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
                  {p.statutStock === "rupture" ? "Rupture" : "Stock bas"}
                </span>
              )}
              <button onClick={() => setModalProduit(p)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-[11px] font-bold text-gray-600 flex-shrink-0">
                <Plus size={11} /><Minus size={11} /> Mouvement
              </button>
            </div>
          ))}
        </div>
      )}

      {mouvements.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-[#111] mb-2 flex items-center gap-1.5"><Clock size={13} /> Mouvements récents</p>
          <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
            {mouvements.map(m => {
              const cfg = TYPE_CFG[m.type] ?? TYPE_CFG.ajustement;
              return (
                <div key={m.id} className="flex items-center gap-3 p-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${cfg.color}12` }}>
                    <cfg.Icon size={12} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#111] truncate">{m.produit.nom}</p>
                    <p className="text-[10.5px] text-gray-400">{cfg.label} · {m.motif || "—"} · {new Date(m.createdAt).toLocaleString("fr-FR")}</p>
                  </div>
                  <p className="text-[12px] font-bold flex-shrink-0" style={{ color: cfg.color }}>{m.stockAvant} → {m.stockApres}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalProduit && (
        <MouvementModal produit={modalProduit} onClose={() => setModalProduit(null)} onDone={() => { setModalProduit(null); charger(); }} />
      )}
    </div>
  );
}
