"use client";
import { useState, useEffect } from "react";
import {
  Search, Plus, Loader2, X, Sparkles, TrendingDown,
  TrendingUp, Globe, AlertTriangle, Zap, RefreshCw,
  Trash2, Eye, BarChart2
} from "lucide-react";
import { toast } from "sonner";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";

interface VeilleItem {
  id: string;
  nomConcurrent: string;
  urlConcurrent?: string;
  categorie?: string;
  produitNom?: string;
  prixDetecte?: number;
  descriptionNote?: string;
  detectedAt: string;
}

export default function VeillePage() {
  const [items, setItems] = useState<VeilleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [analysing, setAnalysing] = useState(false);
  const [rapport, setRapport] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nomConcurrent: "",
    urlConcurrent: "",
    categorie: "",
    produitNom: "",
    prixDetecte: "",
    descriptionNote: "",
    // IA
    promptAnalyse: "",
  });

  useEffect(() => { charger(); }, []);

  async function charger() {
    setLoading(true);
    try {
      const res = await fetch("/api/veille");
      const data = await res.json();
      setItems(data.items || []);
    } catch { }
    finally { setLoading(false); }
  }

  async function analyserAvecIA() {
    if (!form.promptAnalyse.trim()) { toast.error("Entrez un concurrent à analyser"); return; }
    setAnalysing(true);
    setRapport("");
    try {
      const res = await fetch("/api/ai/universal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Analyse la veille concurrentielle pour ce concurrent/marché : "${form.promptAnalyse}".

Fournis :
1. Points forts du concurrent
2. Points faibles / opportunités pour moi
3. Stratégie de prix recommandée
4. Actions à prendre immédiatement
5. Mots-clés SEO qu'ils utilisent probablement

Format: liste claire avec emojis. Adapté marché africain.`,
          }],
        }),
      });
      const data = await res.json();
      setRapport(data.reponse || "");
    } catch { toast.error("Erreur analyse"); }
    finally { setAnalysing(false); }
  }

  async function sauvegarder() {
    if (!form.nomConcurrent) { toast.error("Nom du concurrent requis"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/veille", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomConcurrent: form.nomConcurrent,
          urlConcurrent: form.urlConcurrent || undefined,
          categorie: form.categorie || undefined,
          produitNom: form.produitNom || undefined,
          prixDetecte: form.prixDetecte ? parseFloat(form.prixDetecte) : undefined,
          descriptionNote: rapport || form.descriptionNote || undefined,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Concurrent ajouté au radar !");
      setShowModal(false);
      setForm({ nomConcurrent: "", urlConcurrent: "", categorie: "", produitNom: "", prixDetecte: "", descriptionNote: "", promptAnalyse: "" });
      setRapport("");
      charger();
    } catch { toast.error("Erreur"); }
    finally { setSaving(false); }
  }

  async function supprimer(id: string) {
    await fetch(`/api/veille?id=${id}`, { method: "DELETE" });
    setItems(i => i.filter(x => x.id !== id));
    toast.success("Supprimé du radar");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111] tracking-tight inline-flex items-center gap-2">Veille Concurrentielle <AgentActiveIndicator label="Agent Veille actif" /></h1>
          <p className="text-[12.5px] text-[#AAAAAA] mt-0.5">Surveillez vos concurrents, détectez les opportunités</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}>
          <Plus size={16} /> Ajouter un concurrent
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Concurrents surveillés", val: items.length, icon: Eye, color: "#818cf8" },
          { label: "Analyses IA réalisées", val: items.filter(i => i.descriptionNote).length, icon: Sparkles, color: "#F5A623" },
          { label: "Prix tracés", val: items.filter(i => i.prixDetecte).length, icon: BarChart2, color: "#34d399" },
        ].map(s => {
          const Icone = s.icon;
          return (
            <div key={s.label} className="ax-card p-5">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.color + "15", border: `1px solid ${s.color}25` }}>
                  <Icone size={16} style={{ color: s.color }} />
                </div>
                <p className="text-[20px] font-bold text-[#111111] tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>{s.val}</p>
              </div>
              <p className="text-[12px] text-[#AAAAAA]">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={28} className="text-gray-400 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="bg-[#F9F9F9] border border-dashed border-[#E8E8E8] rounded-[20px] p-16 text-center">
          <Search size={40} className="text-[#CCCCCC] mx-auto mb-4" />
          <h3 className="text-[14px] font-semibold text-[#111111] mb-2">Aucun concurrent dans le radar</h3>
          <p className="text-[12.5px] text-[#AAAAAA] mb-6">L'IA analyse vos concurrents et identifie les opportunités de marché</p>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white mx-auto"
            style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}>
            <Sparkles size={15} /> Analyser un concurrent
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => (
            <div key={item.id} className="ax-card p-5 hover:-translate-y-0.5 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center"><Eye size={20} className="text-red-400" /></div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#111111]">{item.nomConcurrent}</p>
                    {item.categorie && <p className="text-[11.5px] text-[#AAAAAA]">{item.categorie}</p>}
                  </div>
                </div>
                <button onClick={() => supprimer(item.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
              {item.produitNom && (
                <div className="flex items-center justify-between mb-3 bg-[#F9F9F9] rounded-xl px-3 py-2 border border-[#F3F3F3]">
                  <span className="text-[12px] text-[#666]">{item.produitNom}</span>
                  {item.prixDetecte && <span className="text-[12px] font-bold text-[#111111]">{item.prixDetecte.toLocaleString()} XOF</span>}
                </div>
              )}
              {item.urlConcurrent && (
                <a href={item.urlConcurrent} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-[#D4911A] hover:text-[#111111] mb-3">
                  <Globe size={11} /> {item.urlConcurrent.slice(0, 40)}…
                </a>
              )}
              {item.descriptionNote && (
                <p className="text-[12px] text-[#555] leading-relaxed line-clamp-4 bg-[#FFFBEB] border border-[#FDE68A]/40 rounded-xl p-3">{item.descriptionNote}</p>
              )}
              <p className="text-[10.5px] text-[#CCCCCC] mt-3">Ajouté le {new Date(item.detectedAt).toLocaleDateString("fr-FR")}</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setRapport(""); } }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#F3F3F3]">
              <h2 className="text-[15px] font-bold text-[#111111]">Analyser un concurrent</h2>
              <button onClick={() => { setShowModal(false); setRapport(""); }} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Analyse IA */}
              <div className="bg-[#F5A623]/8 border border-[#F5A623]/25 rounded-xl p-4 space-y-3">
                <label className="text-sm font-semibold text-orange-800 flex items-center gap-2">
                  <Sparkles size={14} className="text-[#D4911A]" /> Analyse IA du concurrent
                </label>
                <input value={form.promptAnalyse} onChange={e => setForm(f => ({ ...f, promptAnalyse: e.target.value }))}
                  placeholder="Ex: Boutique Wax & Co à Dakar, vendent des robes similaires, prix 15000-30000 XOF..."
                  className="w-full bg-white border border-orange-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none" />
                <button onClick={analyserAvecIA} disabled={analysing || !form.promptAnalyse}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}>
                  {analysing ? <><Loader2 size={13} className="animate-spin" /> Analyse IA…</> : <><Zap size={13} /> Analyser</>}
                </button>
              </div>

              {rapport && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1"><BarChart2 size={12} /> Rapport IA :</p>
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans">{rapport}</pre>
                </div>
              )}

              {/* Infos manuelles */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Nom du concurrent *", field: "nomConcurrent", placeholder: "Boutique Wax & Co" },
                  { label: "URL / Réseaux", field: "urlConcurrent", placeholder: "https://instagram.com/..." },
                  { label: "Catégorie", field: "categorie", placeholder: "Mode, Cosmétiques..." },
                  { label: "Produit observé", field: "produitNom", placeholder: "Robe Ankara" },
                ].map(f => (
                  <div key={f.field}>
                    <label className="ax-label block mb-1">{f.label}</label>
                    <input value={(form as any)[f.field]} onChange={e => setForm(p => ({ ...p, [f.field]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full bg-white border border-[#E8E8E8] rounded-2xl px-3 py-2.5 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 transition-all placeholder:text-[#CCCCCC]" />
                  </div>
                ))}
                <div>
                  <label className="ax-label block mb-1">Prix observé (XOF)</label>
                  <input type="number" value={form.prixDetecte} onChange={e => setForm(f => ({ ...f, prixDetecte: e.target.value }))}
                    placeholder="25000"
                    className="w-full bg-white border border-[#E8E8E8] rounded-2xl px-3 py-2.5 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 transition-all placeholder:text-[#CCCCCC]" />
                </div>
              </div>

              <button onClick={sauvegarder} disabled={saving || !form.nomConcurrent}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #ef4444, #f97316)" }}>
                {saving ? <><Loader2 size={16} className="animate-spin" /></> : <><Plus size={16} />  Ajouter au radar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
