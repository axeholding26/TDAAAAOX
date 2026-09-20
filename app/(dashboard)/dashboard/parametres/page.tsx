"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Save, Globe, Bell, Users, ExternalLink, Copy, Check,
  Settings, MessageCircle, ChevronRight, ClipboardList,
} from "lucide-react";
import Link from "next/link";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const PARAMETRES_TUTORIAL_STEPS = [
  { Icon: Settings,      titre: "Vos informations générales", description: "Nom, description, catégorie, pays et devise — la base de votre identité sur Axso." },
  { Icon: MessageCircle, titre: "Numéro WhatsApp Business",    description: "Ce numéro recevra les confirmations de commandes pour vos produits physiques et dropshipping." },
  { Icon: ClipboardList, titre: "Formulaire de commande",       description: "Choisissez les informations demandées à l'acheteur qui commande sans passer par WhatsApp (email, GPS, champ personnalisé)." },
  { Icon: Bell,          titre: "Domaine, notifications, équipe", description: "Retrouvez ici les réglages avancés : domaine personnalisé, alertes et accès de vos collaborateurs." },
];

const PAYS = ["Sénégal", "Côte d'Ivoire", "Mali", "Burkina Faso", "Guinée", "Cameroun", "Bénin", "Togo", "Niger", "Mauritanie", "Gabon", "Congo", "RDC", "Madagascar", "France", "Maroc", "Tunisie", "Algérie", "Autre"];
const DEVISES = ["XOF", "XAF", "GNF", "MAD", "TND", "EUR", "USD"];
const CATEGORIES = ["Mode & Vêtements", "Électronique", "Alimentation", "Beauté & Cosmétiques", "Maison & Décoration", "Sport & Loisirs", "Livres & Culture", "Artisanat", "Services", "Autre"];

const inputCls = "w-full bg-white border border-[#E8E8E8] rounded-2xl px-4 py-3 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 transition-all placeholder:text-[#CCCCCC]";
const labelCls = "block mb-1.5 ax-label";

export default function ParametresPage() {
  const [tenant, setTenant] = useState<any>(null);
  const [form, setForm] = useState({
    nomBoutique: "", description: "", whatsapp: "", telephone: "", adresse: "", email: "",
    categorie: "", pays: "", devise: "XOF",
  });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [whatsappNumero, setWhatsappNumero] = useState("");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [formCommande, setFormCommande] = useState({ demanderEmail: true, demanderGps: true, champActif: false, champLabel: "" });
  const [savingCommande, setSavingCommande] = useState(false);

  useEffect(() => {
    fetch("/api/tenants/moi-complet").then(r => r.json()).then(data => {
      if (data) {
        setTenant(data);
        setForm({
          nomBoutique: data.nomBoutique || "", description: data.description || "",
          whatsapp: data.whatsapp || "", telephone: data.telephone || "",
          adresse: data.adresse || "", email: data.email || "",
          categorie: data.categorie || "", pays: data.pays || "", devise: data.devise || "XOF",
        });
        setWhatsappNumero(data.whatsappNumero || "");
        const pc = data.parametresCommande || {};
        setFormCommande({
          demanderEmail: pc.demanderEmail ?? true,
          demanderGps: pc.demanderGps ?? true,
          champActif: pc.champPersonnalise?.actif ?? false,
          champLabel: pc.champPersonnalise?.label ?? "",
        });
      }
    });
  }, []);

  async function sauvegarderCommande() {
    setSavingCommande(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parametresCommande: {
            demanderEmail: formCommande.demanderEmail,
            demanderGps: formCommande.demanderGps,
            champPersonnalise: { actif: formCommande.champActif, label: formCommande.champLabel },
          },
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Formulaire de commande mis à jour !");
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setSavingCommande(false); }
  }

  async function sauvegarderWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    if (!whatsappNumero.startsWith("+") || !/^\+\d+$/.test(whatsappNumero)) {
      toast.error("Le numéro doit commencer par + suivi de chiffres (ex: +22507XXXXXXXX)");
      return;
    }
    setSavingWhatsapp(true);
    try {
      const res = await fetch("/api/tenant/whatsapp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNumero }),
      });
      if (!res.ok) throw new Error();
      toast.success("Numéro WhatsApp Business enregistré !");
    } catch { toast.error("Erreur lors de la sauvegarde du numéro WhatsApp"); }
    finally { setSavingWhatsapp(false); }
  }

  async function sauvegarder(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Informations mises à jour !");
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setSaving(false); }
  }

  function copier(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const boutiquUrl = tenant ? `https://${tenant.slug}.axso.com` : "";

  return (
    <div className="space-y-5 max-w-2xl"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="parametres" titre="Réglages" sousTitre="Configuration de ton compte" steps={PARAMETRES_TUTORIAL_STEPS} />

      {/* ── Header ── */}
      <div className="pt-1">
        <div className="flex items-center gap-2">
          <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">Paramètres</h1>
          <BoutonRevoirTutoriel moduleKey="parametres" />
        </div>
        <p className="text-[12.5px] text-[#AAAAAA] mt-0.5">
          Gérez votre boutique {tenant?.nomBoutique || ""}
        </p>
      </div>

      {/* ── URL boutique ── */}
      {tenant && (
        <div className="ax-card p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FFF8EC] border border-[#FDE68A]/60 flex items-center justify-center flex-shrink-0">
            <Globe size={15} className="text-[#F5A623]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="ax-label mb-0.5">Votre boutique en ligne</p>
            <p className="text-[13px] font-mono font-semibold text-[#111111] truncate">{boutiquUrl}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => copier(boutiquUrl)}
              className="w-8 h-8 rounded-xl border border-[#EBEBEB] flex items-center justify-center text-[#888] hover:text-[#111] hover:border-[#CCC] transition-all">
              {copied ? <Check size={13} className="text-[#16A34A]" /> : <Copy size={13} />}
            </button>
            <a href={`/${tenant.slug}`} target="_blank" rel="noopener noreferrer"
              className="w-8 h-8 rounded-xl border border-[#EBEBEB] flex items-center justify-center text-[#888] hover:text-[#F5A623] hover:border-[#FDE68A] transition-all">
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      )}

      {/* ── Quick links ── */}
      <div className="ax-card divide-y divide-[#F5F5F5]">
        {[
          { Icon: Globe,        label: "Domaine personnalisé",     desc: "Connectez votre propre nom de domaine",     href: "/dashboard/parametres/domaine",       iconBg: "#ECFDF5", iconColor: "#16A34A" },
          { Icon: Bell,         label: "Notifications",             desc: "Alertes WhatsApp et email",                href: "/dashboard/parametres/notifications",  iconBg: "#FFFBEB", iconColor: "#D97706" },
          { Icon: Users,        label: "Équipe",                    desc: "Gérez les accès de vos collaborateurs",    href: "/dashboard/parametres/equipe",         iconBg: "#FFF1F2", iconColor: "#E11D48" },
        ].map((s, i) => {
          const Icon = s.Icon;
          return (
            <Link key={i} href={s.href}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-[#FAFAFA] transition-colors group">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: s.iconBg, border: `1px solid ${s.iconColor}20` }}>
                <Icon size={15} style={{ color: s.iconColor }} />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#111111] group-hover:text-[#F5A623] transition-colors">{s.label}</p>
                <p className="text-[11.5px] text-[#AAAAAA]">{s.desc}</p>
              </div>
              <ChevronRight size={14} className="text-[#CCCCCC] group-hover:text-[#888] transition-colors" />
            </Link>
          );
        })}
      </div>

      {/* ── Informations générales ── */}
      <form onSubmit={sauvegarder} className="ax-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Settings size={14} className="text-[#F5A623]" />
          <h2 className="text-[13px] font-semibold text-[#111111]">Informations générales</h2>
        </div>

        <div>
          <label className={labelCls}>Nom de la boutique *</label>
          <input value={form.nomBoutique} onChange={e => setForm({ ...form, nomBoutique: e.target.value })}
            required className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3} placeholder="Décrivez votre boutique en quelques mots…"
            className={`${inputCls} resize-none`} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Email de contact</label>
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>WhatsApp *</label>
            <input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="+221700000000" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Téléphone</label>
            <input value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Adresse physique</label>
            <input value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Catégorie</label>
            <select value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })}
              className={inputCls} style={{ appearance: "none" }}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Pays</label>
            <select value={form.pays} onChange={e => setForm({ ...form, pays: e.target.value })}
              className={inputCls} style={{ appearance: "none" }}>
              <option value="">Sélectionner…</option>
              {PAYS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Devise</label>
            <select value={form.devise} onChange={e => setForm({ ...form, devise: e.target.value })}
              className={inputCls} style={{ appearance: "none" }}>
              {DEVISES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-[13px] text-white transition-all hover:scale-[1.01] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #F5A623, #D4911A)", boxShadow: "0 4px 16px rgba(245,166,35,0.25)" }}>
          <Save size={14} />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>

      {/* ── WhatsApp Business ── */}
      <form onSubmit={sauvegarderWhatsapp} className="ax-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle size={14} className="text-[#25D366]" />
          <h2 className="text-[13px] font-semibold text-[#111111]">WhatsApp Business</h2>
        </div>
        <p className="text-[12px] text-[#AAAAAA]">
          Ce numéro recevra les confirmations de commandes pour vos produits physiques et dropshipping.
        </p>
        <div>
          <label className={labelCls}>Numéro WhatsApp Business</label>
          <input
            type="tel"
            value={whatsappNumero}
            onChange={e => setWhatsappNumero(e.target.value)}
            placeholder="+22507XXXXXXXX"
            className={`${inputCls} font-mono`}
          />
          <p className="text-[11px] text-[#CCCCCC] mt-1.5">
            Format international : +[indicatif pays][numéro]. Ex : +22507XXXXXXXX
          </p>
        </div>
        <button type="submit" disabled={savingWhatsapp}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-[13px] text-white transition-all hover:scale-[1.01] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", boxShadow: "0 4px 16px rgba(37,211,102,0.20)" }}>
          <Save size={14} />
          {savingWhatsapp ? "Enregistrement…" : "Enregistrer le numéro"}
        </button>
      </form>

      {/* ── Formulaire de commande "Commander maintenant" ── */}
      <div className="ax-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList size={14} className="text-[#F5A623]" />
          <h2 className="text-[13px] font-semibold text-[#111111]">Formulaire de commande</h2>
        </div>
        <p className="text-[12px] text-[#AAAAAA]">
          Personnalisez les informations demandées à l'acheteur qui choisit "Commander maintenant" (sans passer par WhatsApp).
        </p>

        <label className="flex items-center justify-between py-2 cursor-pointer">
          <span className="text-[13px] text-[#333333]">Demander l'adresse email</span>
          <input type="checkbox" checked={formCommande.demanderEmail}
            onChange={e => setFormCommande(f => ({ ...f, demanderEmail: e.target.checked }))}
            className="w-4 h-4 accent-[#F5A623]" />
        </label>
        <label className="flex items-center justify-between py-2 cursor-pointer border-t border-[#F5F5F5]">
          <span className="text-[13px] text-[#333333]">Proposer le partage de la position GPS</span>
          <input type="checkbox" checked={formCommande.demanderGps}
            onChange={e => setFormCommande(f => ({ ...f, demanderGps: e.target.checked }))}
            className="w-4 h-4 accent-[#F5A623]" />
        </label>
        <label className="flex items-center justify-between py-2 cursor-pointer border-t border-[#F5F5F5]">
          <span className="text-[13px] text-[#333333]">Ajouter un champ personnalisé</span>
          <input type="checkbox" checked={formCommande.champActif}
            onChange={e => setFormCommande(f => ({ ...f, champActif: e.target.checked }))}
            className="w-4 h-4 accent-[#F5A623]" />
        </label>
        {formCommande.champActif && (
          <div>
            <label className={labelCls}>Libellé du champ</label>
            <input value={formCommande.champLabel} onChange={e => setFormCommande(f => ({ ...f, champLabel: e.target.value }))}
              placeholder="Ex : Précisions sur la commande, Code postal…" className={inputCls} />
          </div>
        )}

        <button type="button" onClick={sauvegarderCommande} disabled={savingCommande}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-semibold text-[13px] text-white transition-all hover:scale-[1.01] disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #F5A623, #D4911A)", boxShadow: "0 4px 16px rgba(245,166,35,0.25)" }}>
          <Save size={14} />
          {savingCommande ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {/* ── Plan actuel ── */}
      {tenant && (
        <div className="ax-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-semibold text-[#111111]">Plan actuel</h3>
            <span className="text-[11px] font-bold text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] px-2.5 py-0.5 rounded-full">
              {tenant.planType?.toUpperCase()}
            </span>
          </div>
          <div className="space-y-2.5">
            {[
              { label: "Commission Axso", value: `${((tenant.commissionRate || 0.06) * 100).toFixed(0)}% ajouté au prix client` },
              { label: "Actif depuis",   value: new Date(tenant.createdAt).toLocaleDateString("fr-FR") },
            ].map(row => (
              <div key={row.label} className="flex justify-between text-[12.5px]">
                <span className="text-[#AAAAAA]">{row.label}</span>
                <span className="font-semibold text-[#444444]">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
