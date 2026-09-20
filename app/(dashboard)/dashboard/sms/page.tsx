"use client";
import { useState, useEffect } from "react";
import {
  MessageSquare, Plus, Loader2, X, Sparkles, Send,
  Users, CheckCircle2, Zap, Smartphone, Hash,
  Crown, Moon, ShoppingCart, UserPlus, Check
} from "lucide-react";
import { toast } from "sonner";

const SEGMENTS = [
  { id: "tous",     label: "Tous les clients", desc: "Toute votre base clients", Icon: Users    },
  { id: "vip",      label: "Clients VIP",      desc: "Top dépenseurs (2x moy.)", Icon: Crown    },
  { id: "inactifs", label: "Clients inactifs", desc: "Pas d'achat depuis 30j+",  Icon: Moon     },
  { id: "nouveaux", label: "Nouveaux clients", desc: "Inscrits cette semaine",   Icon: UserPlus },
];

const TEMPLATES = [
  {
    label: "Promo flash",
    Icon: Zap,
    template: "Bonjour {{nom}} ! Flash sale chez {boutique} : -30% sur tout pendant 24h ! Profitez-en : {lien} 🛍️",
  },
  {
    label: "Nouveau produit",
    Icon: UserPlus,
    template: "Salut {{nom}} ! Découvrez notre nouveau produit exclusif sur {boutique} ! Quantités limitées 👉 {lien}",
  },
  {
    label: "Relance panier",
    Icon: ShoppingCart,
    template: "{{nom}}, vous avez oublié quelque chose dans votre panier ! Terminez votre commande avant rupture de stock : {lien} 📦",
  },
  {
    label: "Événement",
    Icon: Sparkles,
    template: "{{nom}}, grande nouvelle ! Événement spécial sur {boutique} ce weekend. Offres exclusives pour vous 🎁 {lien}",
  },
];

export default function SMSPage() {
  const [nbClients, setNbClients] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [histoCampagnes, setHistoCampagnes] = useState<any[]>([]);

  const [form, setForm] = useState({
    nom: "",
    message: "",
    segment: "tous",
    promptIA: "",
  });

  useEffect(() => { charger(); }, []);

  async function charger() {
    try {
      const [clientsRes, campagnesRes] = await Promise.all([
        fetch("/api/clients?count=true"),
        fetch("/api/sms"),
      ]);
      if (clientsRes.ok) { const d = await clientsRes.json(); setNbClients(d.total || 0); }
      if (campagnesRes.ok) { const d = await campagnesRes.json(); setHistoCampagnes(d.campagnes || []); }
    } catch { }
  }

  async function genererMessage() {
    if (!form.promptIA.trim()) { toast.error("Décrivez votre campagne"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/universal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Écris un SMS marketing court et percutant (max 160 caractères) pour : "${form.promptIA}".
Inclut {{nom}} pour personnalisation et {lien} pour le lien boutique.
Réponds UNIQUEMENT avec le SMS, rien d'autre. Style africain, engageant, avec 1-2 emojis max.`,
          }],
        }),
      });
      const data = await res.json();
      const sms = (data.reponse || "").trim().slice(0, 160);
      setForm(f => ({ ...f, message: sms }));
      toast.success("Message généré !");
    } catch { toast.error("Erreur IA"); }
    finally { setGenerating(false); }
  }

  async function envoyer() {
    if (!form.message.trim() || !form.nom) { toast.error("Nom et message requis"); return; }
    setSending(true);
    try {
      const res = await fetch("/api/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: form.nom, message: form.message, segment: form.segment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur");
      toast.success(data.message || "Campagne SMS lancée !");
      setShowModal(false);
      setForm({ nom: "", message: "", segment: "tous", promptIA: "" });
      charger();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSending(false); }
  }

  const segment = SEGMENTS.find(s => s.id === form.segment);
  const charCount = form.message.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">SMS & WhatsApp</h1>
          <p className="text-[12.5px] text-[#AAAAAA] mt-0.5">Envoyez des campagnes SMS à vos clients</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white"
          style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.3)" }}>
          <Plus size={16} /> Nouvelle campagne
        </button>
      </div>

      {/* Info Africa's Talking */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Smartphone size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-green-800">Africa's Talking — SMS panafricain</p>
            <p className="text-xs text-green-600 mt-1">
              Pour activer les envois SMS réels, ajoutez <code className="bg-green-100 px-1 rounded">AFRICASTALKING_KEY</code> et <code className="bg-green-100 px-1 rounded">AFRICASTALKING_USERNAME</code> dans votre .env.local.
              <br />Créez un compte gratuit sur <a href="https://africastalking.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">africastalking.com</a> (sandbox gratuit pour les tests).
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Base clients", val: nbClients, icon: Users, color: "#818cf8" },
          { label: "Campagnes envoyées", val: histoCampagnes.filter(c => c.statut === "envoye").length, icon: CheckCircle2, color: "#34d399" },
          { label: "SMS envoyés total", val: histoCampagnes.reduce((s: number, c: any) => s + (c.nbEnvoyes || 0), 0), icon: Send, color: "#F5A623" },
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

      {/* Historique */}
      {histoCampagnes.length > 0 && (
        <div className="ax-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F3F3]">
            <h2 className="text-[13px] font-semibold text-[#111111]">Campagnes récentes</h2>
          </div>
          <div className="divide-y divide-[#F9F9F9]">
            {histoCampagnes.slice(0, 5).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-[#FAFAFA] transition-colors">
                <div>
                  <p className="text-[13px] font-medium text-[#222]">{c.nom}</p>
                  <p className="text-[11.5px] text-[#AAAAAA]">{c.segment} · {new Date(c.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">{c.nbEnvoyes} envoyés</span>
                  <span className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full border ${c.statut === "envoye" ? "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]" : "bg-[#F5F5F7] text-[#888] border-[#EBEBEB]"}`}>
                    {c.statut === "envoye" ? "✓ Envoyé" : "Brouillon"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-[#F3F3F3]">
              <h2 className="text-[15px] font-bold text-[#111111]">Nouvelle campagne SMS</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Segment */}
              <div>
                <label className="text-[12px] font-semibold text-[#555] block mb-2">Destinataires</label>
                <div className="grid grid-cols-2 gap-2">
                  {SEGMENTS.map(s => (
                    <button key={s.id} onClick={() => setForm(f => ({ ...f, segment: s.id }))}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border text-left transition-all ${form.segment === s.id ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <s.Icon size={18} className={form.segment === s.id ? "text-green-600 flex-shrink-0 mt-0.5" : "text-gray-400 flex-shrink-0 mt-0.5"} />
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{s.label}</p>
                        <p className="text-[10px] text-gray-400">{s.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nom */}
              <div>
                <label className="ax-label block mb-1.5">Nom de la campagne *</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex: Promo Tabaski 2024"
                  className="w-full bg-white border border-[#E8E8E8] rounded-2xl px-4 py-3 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 transition-all placeholder:text-[#CCCCCC]" />
              </div>

              {/* Templates */}
              <div>
                <label className="text-[12px] font-semibold text-[#555] block mb-2">Templates</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map(t => (
                    <button key={t.label} onClick={() => setForm(f => ({ ...f, message: t.template }))}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 text-left hover:border-green-400 hover:bg-green-50 transition-all text-xs text-gray-600">
                      <t.Icon size={14} className="text-gray-400 flex-shrink-0" /> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Générer avec IA */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                <label className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
                  <Sparkles size={12} /> Générer avec l'IA
                </label>
                <input value={form.promptIA} onChange={e => setForm(f => ({ ...f, promptIA: e.target.value }))}
                  placeholder="Ex: Promo -25% pour la fête des mères, boutique de mode..."
                  className="w-full bg-white border border-green-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none" />
                <button onClick={genererMessage} disabled={generating || !form.promptIA}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: "#22c55e" }}>
                  {generating ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Générer
                </button>
              </div>

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-gray-500 text-xs font-medium">Message SMS *</label>
                  <span className={`text-xs font-medium ${charCount > 160 ? "text-red-500" : charCount > 130 ? "text-[#D4911A]" : "text-gray-400"}`}>
                    {charCount}/160
                  </span>
                </div>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={4} maxLength={160} placeholder="Votre message SMS... ({{nom}} sera remplacé par le prénom du client)"
                  className="w-full bg-white border border-[#E8E8E8] rounded-2xl px-4 py-3 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 transition-all placeholder:text-[#CCCCCC] resize-none" />
                <p className="text-[11px] text-gray-400 mt-1">Utilisez <code className="bg-gray-100 px-1 rounded">{"{{nom}}"}</code> pour personnaliser · 1 SMS = 160 caractères</p>
              </div>

              <button onClick={envoyer} disabled={sending || !form.message || !form.nom}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}>
                {sending ? <><Loader2 size={16} className="animate-spin" /> Envoi en cours…</> : <><Send size={16} /> Envoyer la campagne</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
