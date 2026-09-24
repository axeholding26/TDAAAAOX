"use client";
import { useState, useEffect } from "react";
import {
  Megaphone, Plus, Loader2, X, Sparkles, TrendingUp,
  Eye, MousePointer, ShoppingCart, DollarSign, Pause,
  Play, Trash2, ExternalLink, Zap, Target, BarChart2,
  Users, Music, Search
} from "lucide-react";
import { toast } from "sonner";

import { useDevise } from "@/components/dashboard/DeviseProvider";
interface Campagne {
  id: string;
  plateforme: string;
  nom: string;
  objectif: string;
  budget: number;
  budgetJour?: number;
  devise: string;
  statut: string;
  depense: number;
  impressions: number;
  clics: number;
  conversions: number;
  cpc: number;
  cpa: number;
  roas: number;
  titreAd?: string;
  descriptionAd?: string;
  imageAdUrl?: string;
  dateDebut?: string;
  dateFin?: string;
  ciblePays: string[];
  cibleAge: string;
  cibleInterets: string[];
  createdAt: string;
}

const PLATEFORMES = [
  { id: "meta",   label: "Meta Ads",   Icon: Users,    color: "#1877F2", desc: "Facebook + Instagram" },
  { id: "google", label: "Google Ads", Icon: Search,   color: "#4285F4", desc: "Search + Display + YouTube" },
  { id: "tiktok", label: "TikTok Ads", Icon: Music,    color: "#010101", desc: "Short-form video ads" },
];

const OBJECTIFS = [
  { id: "conversions", label: "Conversions", icon: ShoppingCart },
  { id: "trafic",      label: "Trafic",      icon: MousePointer },
  { id: "notoriete",   label: "Notoriété",   icon: Eye },
  { id: "leads",       label: "Leads",       icon: Target },
];

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon: { label: "Brouillon", color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
  active:    { label: "Active",    color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  pause:     { label: "En pause",  color: "#F5A623", bg: "rgba(245,166,35,0.1)" },
  terminee:  { label: "Terminée",  color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
};

const PAYS_AFRIQUE = ["SN", "CI", "CM", "GH", "NG", "KE", "MA", "TG", "BJ", "ML", "BF", "GN"];
const PAYS_LABELS: Record<string, string> = {
  SN:"SN · Sénégal", CI:"CI · Côte d'Ivoire", CM:"CM · Cameroun", GH:"GH · Ghana",
  NG:"NG · Nigeria", KE:"KE · Kenya", MA:"MA · Maroc", TG:"TG · Togo",
  BJ:"BJ · Bénin", ML:"ML · Mali", BF:"BF · Burkina Faso", GN:"GN · Guinée",
};

function MetricCard({ icon: Icone, label, value, sub, color }: any) {
  return (
    <div className="ax-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + "15", border: `1px solid ${color}25` }}>
          <Icone size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-[20px] font-bold text-[#111111] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</p>
      <p className="text-[12px] text-[#AAAAAA] mt-0.5">{label}</p>
      {sub && <p className="text-[11.5px] mt-1 font-semibold" style={{ color }}>{sub}</p>}
    </div>
  );
}

function CampagneCard({ c, onStatut, onDelete }: { c: Campagne; onStatut: (id: string, s: string) => void; onDelete: (id: string) => void }) {
  const plat = PLATEFORMES.find(p => p.id === c.plateforme);
  const statut = STATUT_CONFIG[c.statut] || STATUT_CONFIG.brouillon;
  const ctr = c.impressions > 0 ? ((c.clics / c.impressions) * 100).toFixed(2) : "0";
  const txConv = c.clics > 0 ? ((c.conversions / c.clics) * 100).toFixed(1) : "0";

  return (
    <div className="ax-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: plat?.color + "15", border: `1px solid ${plat?.color}25` }}>
            {plat?.Icon && <plat.Icon size={20} style={{ color: plat.color }} />}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#111111]">{c.nom}</p>
            <p className="text-[11.5px] text-[#AAAAAA]">{plat?.label} · {c.objectif}</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: statut.color, background: statut.bg }}>
          {statut.label}
        </span>
      </div>

      {c.imageAdUrl && (
        <div className="mb-4 rounded-xl overflow-hidden aspect-video">
          <img src={c.imageAdUrl} alt="Créatif" className="w-full h-full object-cover" />
        </div>
      )}

      {c.titreAd && (
        <div className="mb-4 bg-[#F9F9F9] rounded-xl p-3 border border-[#F3F3F3]">
          <p className="text-[13px] font-semibold text-[#222]">{c.titreAd}</p>
          {c.descriptionAd && <p className="text-[12px] text-[#666] mt-1 line-clamp-2">{c.descriptionAd}</p>}
        </div>
      )}

      {/* Métriques */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: "Impressions", val: c.impressions.toLocaleString() },
          { label: "Clics", val: c.clics.toLocaleString() },
          { label: "CTR", val: `${ctr}%` },
          { label: "Conv.", val: c.conversions },
        ].map(m => (
          <div key={m.label} className="text-center bg-[#F9F9F9] rounded-xl p-2">
            <p className="text-[13px] font-bold text-[#222]">{m.val}</p>
            <p className="text-[10.5px] text-[#AAAAAA]">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Budget */}
      <div className="flex items-center justify-between mb-4 text-xs text-gray-500">
        <span>Dépensé: <strong className="text-gray-800">{c.depense.toLocaleString()} {c.devise}</strong></span>
        <span>Budget: <strong className="text-gray-800">{c.budget.toLocaleString()} {c.devise}</strong></span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min((c.depense / c.budget) * 100, 100)}%`, background: plat?.color }} />
      </div>

      {c.roas > 0 && (
        <div className="flex items-center gap-2 mb-4 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
          <TrendingUp size={12} className="text-green-600" />
          <span className="text-xs font-semibold text-green-700">ROAS: {c.roas.toFixed(2)}x</span>
          <span className="text-xs text-green-600 ml-auto">Conv. {txConv}%</span>
        </div>
      )}

      {c.ciblePays?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {c.ciblePays.map(p => <span key={p} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{PAYS_LABELS[p] || p}</span>)}
        </div>
      )}

      <div className="flex gap-2">
        {c.statut === "brouillon" && (
          <button onClick={() => onStatut(c.id, "active")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors">
            <Play size={11} /> Activer
          </button>
        )}
        {c.statut === "active" && (
          <button onClick={() => onStatut(c.id, "pause")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#111111] rounded-xl text-xs font-semibold hover:bg-[#F5A623]/15 transition-colors">
            <Pause size={11} /> Pauser
          </button>
        )}
        {c.statut === "pause" && (
          <button onClick={() => onStatut(c.id, "active")}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-xs font-semibold hover:bg-green-100 transition-colors">
            <Play size={11} /> Reprendre
          </button>
        )}
        <button onClick={() => onDelete(c.id)}
          className="w-9 h-9 flex items-center justify-center bg-red-50 border border-red-100 text-red-400 rounded-xl hover:bg-red-100 transition-colors flex-shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export default function PublicitePage() {
  const { devise, fmt } = useDevise();
  const [campagnes, setCampagnes] = useState<Campagne[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genIA, setGenIA] = useState(false);
  const [filterPlat, setFilterPlat] = useState("tous");

  const [form, setForm] = useState({
    plateforme: "meta",
    nom: "",
    objectif: "conversions",
    budget: "",
    budgetJour: "",
    devise,
    dateDebut: "",
    dateFin: "",
    ciblePays: [] as string[],
    cibleAge: "18-45",
    cibleInterets: [] as string[],
    titreAd: "",
    descriptionAd: "",
    imageAdUrl: "",
    urlDestination: "",
    promptIA: "",
  });

  useEffect(() => { charger(); }, []);

  async function charger() {
    setLoading(true);
    try {
      const res = await fetch("/api/campagnes");
      const data = await res.json();
      setCampagnes(data.campagnes || []);
      setStats(data.stats || {});
    } catch { toast.error("Erreur chargement"); }
    finally { setLoading(false); }
  }

  async function genererCreatifIA() {
    if (!form.promptIA || !form.plateforme) return;
    setGenIA(true);
    try {
      const res = await fetch("/api/ai/universal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Génère un créatif publicitaire ${form.plateforme} pour : "${form.promptIA}".
Réponds en JSON :
{
  "titre": "titre accrocheur max 40 chars",
  "description": "description engageante max 125 chars",
  "nom_campagne": "nom court de la campagne"
}
Adapté marché africain. UNIQUEMENT le JSON.`,
          }],
        }),
      });
      const data = await res.json();
      const json = (data.reponse || "").match(/\{[\s\S]*\}/);
      if (json) {
        const parsed = JSON.parse(json[0]);

        // Générer visuel IA
        const imgPrompt = `${form.promptIA}, ${form.plateforme} advertisement, professional marketing visual, African market, high quality`;
        const encoded = encodeURIComponent(imgPrompt);
        const imageAdUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=628&nologo=true&model=flux&seed=${Math.floor(Math.random()*999999)}`;

        setForm(f => ({
          ...f,
          titreAd: parsed.titre || "",
          descriptionAd: parsed.description || "",
          nom: parsed.nom_campagne || f.nom,
          imageAdUrl,
        }));
        toast.success("Créatif généré !");
      }
    } catch { toast.error("Erreur IA"); }
    finally { setGenIA(false); }
  }

  async function creer() {
    if (!form.nom || !form.budget) { toast.error("Nom et budget requis"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/campagnes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plateforme: form.plateforme,
          nom: form.nom,
          objectif: form.objectif,
          budget: parseFloat(form.budget),
          budgetJour: form.budgetJour ? parseFloat(form.budgetJour) : undefined,
          devise: form.devise,
          dateDebut: form.dateDebut || undefined,
          dateFin: form.dateFin || undefined,
          ciblePays: form.ciblePays,
          cibleAge: form.cibleAge,
          cibleInterets: form.cibleInterets,
          titreAd: form.titreAd || undefined,
          descriptionAd: form.descriptionAd || undefined,
          imageAdUrl: form.imageAdUrl || undefined,
          urlDestination: form.urlDestination || undefined,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Campagne créée !");
      setShowModal(false);
      setForm(f => ({ ...f, nom: "", budget: "", titreAd: "", descriptionAd: "", imageAdUrl: "", promptIA: "" }));
      charger();
    } catch { toast.error("Erreur sauvegarde"); }
    finally { setSaving(false); }
  }

  async function changerStatut(id: string, statut: string) {
    await fetch("/api/campagnes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, statut }) });
    setCampagnes(cs => cs.map(c => c.id === id ? { ...c, statut } : c));
    toast.success(`Campagne ${statut === "active" ? "activée" : statut === "pause" ? "mise en pause" : "mise à jour"}`);
  }

  async function supprimer(id: string) {
    await fetch(`/api/campagnes?id=${id}`, { method: "DELETE" });
    setCampagnes(cs => cs.filter(c => c.id !== id));
    toast.success("Campagne supprimée");
  }

  const campagnesFiltrees = campagnes.filter(c => filterPlat === "tous" || c.plateforme === filterPlat);

  const inputClass = "w-full bg-white border border-[#E8E8E8] rounded-2xl px-4 py-3 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 transition-all placeholder:text-[#CCCCCC]";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">Publicité</h1>
          <p className="text-[12.5px] text-[#AAAAAA] mt-0.5">Gérez vos campagnes Meta, Google et TikTok</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
          style={{ background: "linear-gradient(135deg, #1877F2, #4285F4)", boxShadow: "0 4px 20px rgba(24,119,242,0.3)" }}>
          <Plus size={16} /> Nouvelle campagne
        </button>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={DollarSign} label="Total dépensé" value={`${fmt((stats.totalDepense || 0))}`} color="#F5A623" />
        <MetricCard icon={Eye} label="Impressions totales" value={(stats.totalImpressions || 0).toLocaleString()} color="#818cf8" />
        <MetricCard icon={MousePointer} label="Clics totaux" value={(stats.totalClics || 0).toLocaleString()} sub={stats.totalImpressions ? `CTR: ${((stats.totalClics/stats.totalImpressions)*100).toFixed(2)}%` : undefined} color="#60a5fa" />
        <MetricCard icon={ShoppingCart} label="Conversions" value={stats.totalConversions || 0} sub={stats.roas > 0 ? `ROAS: ${stats.roas.toFixed(2)}x` : undefined} color="#34d399" />
      </div>

      {/* Filtres plateformes */}
      <div className="flex gap-2">
        <button onClick={() => setFilterPlat("tous")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${filterPlat === "tous" ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-200 text-gray-500"}`}>
          Toutes
        </button>
        {PLATEFORMES.map(p => (
          <button key={p.id} onClick={() => setFilterPlat(p.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${filterPlat === p.id ? "text-white border-transparent" : "bg-white border-gray-200 text-gray-500"}`}
            style={filterPlat === p.id ? { background: p.color } : {}}>
            <p.Icon size={14} /> {p.label}
          </button>
        ))}
      </div>

      {/* Grille campagnes */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="text-gray-400 animate-spin" /></div>
      ) : campagnesFiltrees.length === 0 ? (
        <div className="bg-[#F9F9F9] border border-dashed border-[#E8E8E8] rounded-[20px] p-16 text-center">
          <Megaphone size={40} className="text-[#CCCCCC] mx-auto mb-4" />
          <h3 className="text-[14px] font-semibold text-[#111111] mb-2">Aucune campagne</h3>
          <p className="text-[12.5px] text-[#AAAAAA] mb-6">Créez votre première campagne et laissez l'IA générer les créatifs</p>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white mx-auto"
            style={{ background: "linear-gradient(135deg, #1877F2, #4285F4)" }}>
            <Sparkles size={15} /> Créer avec l'IA
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {campagnesFiltrees.map(c => (
            <CampagneCard key={c.id} c={c} onStatut={changerStatut} onDelete={supprimer} />
          ))}
        </div>
      )}

      {/* Lien tracking info */}
      <div className="bg-[#F5A623]/8 border border-[#F5A623]/25 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <BarChart2 size={18} className="text-[#D4911A] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#111111]">Pixel Tracking Axso</p>
            <p className="text-xs text-[#666666] mt-1">
              Votre pixel de tracking est automatiquement actif sur votre boutique. Consultez l'attribution des ventes dans <a href="/dashboard/analytics" className="underline font-medium">Analytics</a>.
            </p>
          </div>
        </div>
      </div>

      {/* ─── Modal Nouvelle campagne ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#F3F3F3]">
              <div>
                <h2 className="text-[15px] font-bold text-[#111111]">Nouvelle campagne</h2>
                <p className="text-[12px] text-[#AAAAAA]">L'IA génère les créatifs automatiquement</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Plateforme */}
              <div>
                <label className="text-[12px] font-semibold text-[#555] block mb-2">Plateforme</label>
                <div className="grid grid-cols-3 gap-3">
                  {PLATEFORMES.map(p => (
                    <button key={p.id} onClick={() => setForm(f => ({ ...f, plateforme: p.id }))}
                      className={`p-3 rounded-xl border text-center transition-all ${form.plateforme === p.id ? "border-2 text-white" : "bg-white border-gray-200"}`}
                      style={form.plateforme === p.id ? { borderColor: p.color, background: p.color } : {}}>
                      <div className="flex justify-center mb-1"><p.Icon size={24} style={{ color: form.plateforme === p.id ? "#fff" : p.color }} /></div>
                      <p className="text-xs font-semibold">{p.label}</p>
                      <p className="text-[10px] opacity-70">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* IA créatif */}
              <div className="bg-[#F5A623]/5 border border-[#F5A623]/20 rounded-xl p-4 space-y-3">
                <label className="text-gray-700 text-sm font-semibold flex items-center gap-2">
                  <Sparkles size={14} className="text-[#F5A623]" /> Générer les créatifs avec l'IA
                </label>
                <input value={form.promptIA} onChange={e => setForm(f => ({ ...f, promptIA: e.target.value }))}
                  placeholder="Ex: Vendre mes robes wax premium aux femmes 25-40 ans à Dakar..."
                  className={inputClass} />
                <button onClick={genererCreatifIA} disabled={genIA || !form.promptIA}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #F5A623, #d4820a)" }}>
                  {genIA ? <><Loader2 size={13} className="animate-spin" /> Génération…</> : <><Zap size={13} /> Générer titre + visuel</>}
                </button>
              </div>

              {/* Infos campagne */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="ax-label block mb-1.5">Nom de la campagne *</label>
                  <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Ex: Soldes Ramadan 2024" className={inputClass} />
                </div>
                <div>
                  <label className="ax-label block mb-1.5">Budget total *</label>
                  <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="50000" className={inputClass} />
                </div>
                <div>
                  <label className="ax-label block mb-1.5">Budget journalier</label>
                  <input type="number" value={form.budgetJour} onChange={e => setForm(f => ({ ...f, budgetJour: e.target.value }))} placeholder="5000" className={inputClass} />
                </div>
              </div>

              {/* Objectif */}
              <div>
                <label className="text-[12px] font-semibold text-[#555] block mb-2">Objectif</label>
                <div className="grid grid-cols-4 gap-2">
                  {OBJECTIFS.map(o => {
                    const Icone = o.icon;
                    return (
                      <button key={o.id} onClick={() => setForm(f => ({ ...f, objectif: o.id }))}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-xs ${form.objectif === o.id ? "border-[#F5A623]/50 bg-[#F5A623]/8 text-[#F5A623]" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                        <Icone size={16} />
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ciblage pays */}
              <div>
                <label className="text-[12px] font-semibold text-[#555] block mb-2">Pays cibles</label>
                <div className="flex flex-wrap gap-2">
                  {PAYS_AFRIQUE.map(p => (
                    <button key={p}
                      onClick={() => setForm(f => ({
                        ...f,
                        ciblePays: f.ciblePays.includes(p) ? f.ciblePays.filter(x => x !== p) : [...f.ciblePays, p],
                      }))}
                      className={`text-xs px-3 py-1.5 rounded-xl border transition-all font-medium ${form.ciblePays.includes(p) ? "border-[#F5A623] bg-[#F5A623]/10 text-[#F5A623]" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
                      {PAYS_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Créatif IA pré-rempli */}
              {(form.titreAd || form.imageAdUrl) && (
                <div className="grid sm:grid-cols-2 gap-4">
                  {form.imageAdUrl && <img src={form.imageAdUrl} alt="Créatif" className="w-full rounded-xl object-cover aspect-video" />}
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-500 text-xs block mb-1">Titre de l'annonce</label>
                      <input value={form.titreAd} onChange={e => setForm(f => ({ ...f, titreAd: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-gray-500 text-xs block mb-1">Description</label>
                      <textarea value={form.descriptionAd} onChange={e => setForm(f => ({ ...f, descriptionAd: e.target.value }))} rows={3} className={`${inputClass} resize-none`} />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="ax-label block mb-1.5">URL de destination</label>
                <input value={form.urlDestination} onChange={e => setForm(f => ({ ...f, urlDestination: e.target.value }))} placeholder="https://votre-boutique.axso.africa" className={inputClass} />
              </div>

              <button onClick={creer} disabled={saving || !form.nom || !form.budget}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #1877F2, #4285F4)" }}>
                {saving ? <><Loader2 size={16} className="animate-spin" /> Création…</> : <><Megaphone size={16} /> Créer la campagne</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
