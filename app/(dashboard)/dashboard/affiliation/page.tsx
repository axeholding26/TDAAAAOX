"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Users, TrendingUp, DollarSign, Link2, Copy, CheckCheck, Zap,
  Share2, Eye, ShoppingBag, Plus, Globe, Settings, BarChart3,
  ChevronRight, AlertCircle, CheckCircle, XCircle, Clock,
  ArrowUpRight, Wallet, Send, Filter, Search, RefreshCw,
  Award, Target, Percent, Edit3, Trash2, UserCheck, UserX, ExternalLink,
} from "lucide-react";
import { AgentActiveIndicator } from "@/components/dashboard/AgentActiveIndicator";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";
import { toast } from "sonner";

const AFFILIATION_TUTORIAL_STEPS = [
  { Icon: Settings, titre: "Configure ton programme",       description: "Définis ton taux de commission, la durée du cookie d'attribution et des paliers pour récompenser tes meilleurs affiliés." },
  { Icon: Users,    titre: "Recrute et valide tes affiliés", description: "Approuve les demandes, suis les clics et conversions de chacun, et repère tes ambassadeurs les plus performants." },
  { Icon: Link2,    titre: "Génère des liens et bannières",  description: "Chaque affilié obtient un lien trackable par produit ou pour toute la boutique, avec bannières et messages prêts à partager." },
  { Icon: Wallet,   titre: "Paie les commissions",           description: "Suis les commissions en attente et valide les paiements dès qu'un affilié atteint son seuil." },
];

// ─── Types ───────────────────────────────────────────────────────────────────
interface Programme {
  id: string; nom: string; description?: string;
  typeCommission: string; valeurCommission: number;
  dureeCookie: number; seuilPaiement: number;
  tousLesProduits: boolean; tiersActifs: boolean;
  actif: boolean; _count?: { affilies: number };
}
interface Affilie {
  id: string; nom: string; email: string; telephone?: string;
  codeParrainage: string; statut: string;
  clics: number; conversions: number;
  commissionTotal: number; commissionPending: number;
  createdAt: string;
  programme?: { nom: string; valeurCommission: number; typeCommission: string };
}
interface Stats {
  totalAffilies: number; affiliesActifs: number;
  commissionsPaid: number; commissionsPending: number;
  gmvAffilies: number; clics: number; conversions: number;
  tauxConversion: number;
  funnel: { clics: number; conversions: number; paiements: number };
}

const TABS = [
  { id: "stats",     label: "Vue d'ensemble", Icon: BarChart3 },
  { id: "programme", label: "Mon programme",  Icon: Settings  },
  { id: "affilies",  label: "Affiliés",       Icon: Users     },
  { id: "paiements", label: "Paiements",      Icon: Wallet    },
  { id: "liens",     label: "Mes liens",      Icon: Link2     },
  { id: "materiel",  label: "Matériel",       Icon: Share2    },
  { id: "entrante",  label: "Liens sortants", Icon: Globe     },
];

function copier(texte: string, cb: (v: boolean) => void) {
  navigator.clipboard.writeText(texte).catch(() => {});
  cb(true); setTimeout(() => cb(false), 2000);
}

function StatCard({ label, value, sub, color = "#F5A623", Icon: Ic }: {
  label: string; value: string; sub?: string; color?: string; Icon: any;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
          <Ic size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-[22px] font-bold text-[#111] leading-none">{value}</p>
      <p className="text-[11px] text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color }}>{sub}</p>}
    </div>
  );
}

function Badge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    actif:       { label: "Actif",       cls: "bg-green-100 text-green-700" },
    en_attente:  { label: "En attente",  cls: "bg-amber-100 text-amber-700" },
    suspendu:    { label: "Suspendu",    cls: "bg-red-100 text-red-600"     },
    pending:     { label: "En attente",  cls: "bg-amber-100 text-amber-700" },
    approuvee:   { label: "Approuvée",   cls: "bg-[#F5A623]/15 text-[#111111]" },
    payee:       { label: "Payée",       cls: "bg-green-100 text-green-700" },
    rejetee:     { label: "Rejetée",     cls: "bg-red-100 text-red-600"     },
  };
  const m = map[statut] ?? { label: statut, cls: "bg-gray-100 text-gray-500" };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

// ─── Vue d'ensemble ───────────────────────────────────────────────────────────
function OngletStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [top, setTop] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/affiliation/stats")
      .then(r => r.json())
      .then(d => { setStats(d.stats ?? null); setTop(d.topAffilies ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Chargement…</div>;
  if (!stats) return null;

  const conv = stats.clics > 0 ? ((stats.conversions / stats.clics) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Affiliés actifs"      value={String(stats.affiliesActifs)}                         Icon={Users}       color="#111111" sub={`/ ${stats.totalAffilies} total`} />
        <StatCard label="Commissions versées"  value={`${stats.commissionsPaid.toLocaleString()} XAF`}      Icon={DollarSign}  color="#10b981" />
        <StatCard label="En attente de paiement" value={`${stats.commissionsPending.toLocaleString()} XAF`} Icon={Clock}       color="#F5A623" />
        <StatCard label="GMV généré"           value={`${stats.gmvAffilies.toLocaleString()} XAF`}          Icon={TrendingUp}  color="#0ea5e9" sub="via affiliés" />
      </div>

      {/* Funnel */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <p className="text-[12px] font-bold text-[#111] mb-4">Funnel de conversion</p>
        <div className="flex items-end gap-2">
          {[
            { label: "Clics", value: stats.funnel.clics,      color: "#0ea5e9" },
            { label: "Ventes", value: stats.funnel.conversions, color: "#111111" },
            { label: "Payés",  value: stats.funnel.paiements,   color: "#10b981" },
          ].map((f, i) => {
            const max = Math.max(stats.funnel.clics, 1);
            const pct = Math.round((f.value / max) * 100);
            return (
              <div key={i} className="flex-1 text-center">
                <div className="flex flex-col items-center justify-end h-24 mb-2">
                  <div className="w-full rounded-t-xl transition-all" style={{ height: `${Math.max(pct, 8)}%`, background: f.color }} />
                </div>
                <p className="text-[18px] font-bold text-[#111]">{f.value.toLocaleString()}</p>
                <p className="text-[10px] text-gray-400">{f.label}</p>
                {i > 0 && <p className="text-[10px] text-gray-300">{pct}%</p>}
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-3 text-center">Taux de conversion global : <strong className="text-[#F5A623]">{conv}%</strong></p>
      </div>

      {/* Top affiliés */}
      {top.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-[12px] font-bold text-[#111] mb-4">Top affiliés</p>
          <div className="space-y-2">
            {top.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <span className="text-[11px] font-bold text-gray-300 w-4">{i + 1}</span>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: ["#F5A623","#111111","#0ea5e9","#10b981","#ef4444"][i] }}>
                  {a.nom.slice(0,1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#111] truncate">{a.nom}</p>
                  <p className="text-[10px] text-gray-400">{a.clics} clics · {a.conversions} ventes</p>
                </div>
                <p className="text-[13px] font-bold text-[#F5A623]">{(a.commissionTotal ?? 0).toLocaleString()} XAF</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Mon programme ────────────────────────────────────────────────────────────
function OngletProgramme() {
  const [prog, setProg] = useState<Programme | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nom: "", description: "", typeCommission: "pourcentage",
    valeurCommission: 10, dureeCookie: 30, seuilPaiement: 5000,
    tousLesProduits: true, tiersActifs: false, actif: true,
    autoApprobation: true,
    tier1Nom: "Bronze", tier1Max: 10, tier1Commission: 5,
    tier2Nom: "Argent", tier2Max: 50, tier2Commission: 8,
    tier3Nom: "Or", tier3Commission: 12,
  });

  const charger = useCallback(() => {
    fetch("/api/affiliation/programmes")
      .then(r => r.json())
      .then(d => {
        const p = d.programmes?.[0] ?? null;
        setProg(p);
        if (p) setForm({
          nom: p.nom, description: p.description ?? "", typeCommission: p.typeCommission,
          valeurCommission: p.valeurCommission, dureeCookie: p.dureeCookie, seuilPaiement: p.seuilPaiement,
          tousLesProduits: p.tousLesProduits, tiersActifs: p.tiersActifs, actif: p.actif,
          autoApprobation: p.autoApprobation ?? true,
          tier1Nom: p.tier1Nom ?? "Bronze", tier1Max: p.tier1Max ?? 10, tier1Commission: p.tier1Commission ?? 5,
          tier2Nom: p.tier2Nom ?? "Argent", tier2Max: p.tier2Max ?? 50, tier2Commission: p.tier2Commission ?? 8,
          tier3Nom: p.tier3Nom ?? "Or", tier3Commission: p.tier3Commission ?? 12,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function sauver() {
    setSaving(true);
    const method = prog ? "PATCH" : "POST";
    const body = prog ? { id: prog.id, ...form } : form;
    await fetch("/api/affiliation/programmes", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    await charger(); setEditing(false); setSaving(false);
  }

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Chargement…</div>;

  if (!prog && !editing) {
    return (
      <div className="py-10 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#F5A623]/10 flex items-center justify-center mx-auto">
          <Target size={28} className="text-[#F5A623]" />
        </div>
        <p className="text-[14px] font-bold text-[#111]">Aucun programme d'affiliation</p>
        <p className="text-[12px] text-gray-400 max-w-xs mx-auto">Créez votre programme pour permettre à des influenceurs et ambassadeurs de promouvoir vos produits.</p>
        <button onClick={() => setEditing(true)}
          className="px-5 py-2.5 bg-[#F5A623] text-white rounded-xl text-[12px] font-bold">
          + Créer mon programme
        </button>
      </div>
    );
  }

  if (editing || !prog) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-bold text-[#111]">{prog ? "Modifier le programme" : "Créer un programme"}</p>
          {prog && <button onClick={() => setEditing(false)} className="text-[11px] text-gray-400 hover:text-gray-600">Annuler</button>}
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Nom du programme *</label>
            <input value={form.nom} onChange={e => setForm(v => ({ ...v, nom: e.target.value }))}
              placeholder="Programme Ambassadeurs 2026"
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Description</label>
            <textarea value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))}
              placeholder="Rejoignez notre programme et gagnez des commissions sur chaque vente..."
              rows={2}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Type de commission</label>
              <select value={form.typeCommission} onChange={e => setForm(v => ({ ...v, typeCommission: e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60 bg-white">
                <option value="pourcentage">Pourcentage (%)</option>
                <option value="fixe">Montant fixe (XAF)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                Valeur ({form.typeCommission === "pourcentage" ? "%" : "XAF"})
              </label>
              <input type="number" value={form.valeurCommission} onChange={e => setForm(v => ({ ...v, valeurCommission: +e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Fenêtre cookie (jours)</label>
              <input type="number" value={form.dureeCookie} onChange={e => setForm(v => ({ ...v, dureeCookie: +e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Seuil paiement (XAF)</label>
              <input type="number" value={form.seuilPaiement} onChange={e => setForm(v => ({ ...v, seuilPaiement: +e.target.value }))}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-[13px] outline-none focus:border-[#F5A623]/60" />
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setForm(v => ({ ...v, actif: !v.actif }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${form.actif ? "bg-[#F5A623]" : "bg-gray-200"}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.actif ? "left-4" : "left-0.5"}`} />
              </div>
              <span className="text-[12px] text-gray-600">Programme actif</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setForm(v => ({ ...v, autoApprobation: !v.autoApprobation }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${form.autoApprobation ? "bg-[#F5A623]" : "bg-gray-200"}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.autoApprobation ? "left-4" : "left-0.5"}`} />
              </div>
              <span className="text-[12px] text-gray-600">Approbation automatique des candidatures</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setForm(v => ({ ...v, tiersActifs: !v.tiersActifs }))}
                className={`w-9 h-5 rounded-full transition-colors relative ${form.tiersActifs ? "bg-[#F5A623]" : "bg-gray-200"}`}>
                <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all ${form.tiersActifs ? "left-4" : "left-0.5"}`} />
              </div>
              <span className="text-[12px] text-gray-600">Paliers de commission</span>
            </label>
          </div>

          {form.tiersActifs && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Paliers — plus l'affilié vend, plus il gagne</p>
              {([
                ["tier1Nom", "tier1Max", "tier1Commission", "Palier 1"],
                ["tier2Nom", "tier2Max", "tier2Commission", "Palier 2"],
              ] as const).map(([nomKey, maxKey, commKey, label]) => (
                <div key={label} className="grid grid-cols-3 gap-2 items-end">
                  <div>
                    <label className="text-[9.5px] text-gray-400">{label} — nom</label>
                    <input value={form[nomKey]} onChange={e => setForm(v => ({ ...v, [nomKey]: e.target.value }))}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] outline-none focus:border-[#F5A623]/60" />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-gray-400">Jusqu'à (ventes)</label>
                    <input type="number" value={form[maxKey]} onChange={e => setForm(v => ({ ...v, [maxKey]: +e.target.value }))}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] outline-none focus:border-[#F5A623]/60" />
                  </div>
                  <div>
                    <label className="text-[9.5px] text-gray-400">Commission (%)</label>
                    <input type="number" value={form[commKey]} onChange={e => setForm(v => ({ ...v, [commKey]: +e.target.value }))}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] outline-none focus:border-[#F5A623]/60" />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <label className="text-[9.5px] text-gray-400">Palier 3 — nom</label>
                  <input value={form.tier3Nom} onChange={e => setForm(v => ({ ...v, tier3Nom: e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] outline-none focus:border-[#F5A623]/60" />
                </div>
                <div className="text-[10px] text-gray-300 italic pb-2.5">Au-delà du palier 2</div>
                <div>
                  <label className="text-[9.5px] text-gray-400">Commission (%)</label>
                  <input type="number" value={form.tier3Commission} onChange={e => setForm(v => ({ ...v, tier3Commission: +e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-2.5 py-2 text-[12px] outline-none focus:border-[#F5A623]/60" />
                </div>
              </div>
            </div>
          )}
        </div>
        <button onClick={sauver} disabled={!form.nom || saving}
          className="w-full py-3 bg-[#F5A623] text-white rounded-2xl text-[13px] font-bold disabled:opacity-50 hover:bg-[#d4880d] transition-colors">
          {saving ? "Sauvegarde…" : prog ? "Mettre à jour" : "Créer le programme"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[15px] font-bold text-[#111]">{prog.nom}</p>
            {prog.description && <p className="text-[12px] text-gray-400 mt-1">{prog.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge statut={prog.actif ? "actif" : "suspendu"} />
            <button onClick={() => setEditing(true)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <Edit3 size={13} className="text-gray-400" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Commission", value: prog.typeCommission === "pourcentage" ? `${prog.valeurCommission}%` : `${prog.valeurCommission.toLocaleString()} XAF` },
            { label: "Cookie attribution", value: `${prog.dureeCookie} jours` },
            { label: "Seuil paiement",     value: `${prog.seuilPaiement.toLocaleString()} XAF` },
            { label: "Affiliés",           value: String(prog._count?.affilies ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-400">{label}</p>
              <p className="text-[14px] font-bold text-[#111] mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lien de signup public */}
      <div className="bg-[#FFF8EC] border border-[#F5A623]/30 rounded-2xl p-4">
        <p className="text-[11px] font-bold text-[#d4880d] mb-2">Lien d'inscription affilié</p>
        <p className="text-[11px] text-gray-500 mb-2">Partagez ce lien pour que les affiliés puissent s'inscrire à votre programme.</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white border border-[#F5A623]/20 rounded-xl px-3 py-2 text-[11px] font-mono text-gray-500 truncate">
            {process.env.NEXT_PUBLIC_APP_URL ?? ""}/rejoindre/{prog.id}
          </div>
          <CopyButton text={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/rejoindre/${prog.id}`} />
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => copier(text, setCopied)}
      className={`shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all ${copied ? "bg-green-100 text-green-700" : "bg-[#F5A623] text-white"}`}>
      {copied ? <CheckCheck size={12}/> : <Copy size={12}/>}
    </button>
  );
}

// ─── Gestion des affiliés ─────────────────────────────────────────────────────
function OngletAffilies() {
  const [affilies, setAffilies] = useState<Affilie[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nom: "", email: "", telephone: "" });
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const charger = useCallback(() => {
    const qs = new URLSearchParams();
    if (filtre !== "all") qs.set("statut", filtre);
    if (search) qs.set("search", search);
    fetch(`/api/affiliation/affilies?${qs}`)
      .then(r => r.json())
      .then(d => { setAffilies(d.affilies ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filtre, search]);

  useEffect(() => { charger(); }, [charger]);

  async function creer() {
    setSaving(true);
    await fetch("/api/affiliation/affilies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ nom: "", email: "", telephone: "" }); setShowForm(false); setSaving(false); charger();
  }

  async function changerStatut(id: string, statut: string) {
    setActioning(id);
    await fetch("/api/affiliation/affilies", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, statut }) });
    setActioning(null); charger();
  }

  return (
    <div className="space-y-4">
      {/* Barre filtres */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un affilié…"
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-[12px] outline-none focus:border-[#F5A623]/50" />
        </div>
        <select value={filtre} onChange={e => setFiltre(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50 bg-white">
          <option value="all">Tous</option>
          <option value="en_attente">En attente</option>
          <option value="actif">Actifs</option>
          <option value="suspendu">Suspendus</option>
        </select>
        <button onClick={() => setShowForm(!showForm)}
          className="px-3 py-2 bg-[#F5A623] text-white rounded-xl text-[11px] font-bold flex items-center gap-1">
          <Plus size={12}/> Ajouter
        </button>
      </div>

      {/* Formulaire ajout */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
          <p className="text-[12px] font-bold text-[#111]">Ajouter un affilié</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "nom", ph: "Nom complet *" },
              { key: "email", ph: "Email *" },
              { key: "telephone", ph: "Téléphone" },
            ].map(({ key, ph }) => (
              <input key={key} placeholder={ph} value={(form as any)[key]}
                onChange={e => setForm(v => ({ ...v, [key]: e.target.value }))}
                className="border border-gray-200 rounded-xl px-3 py-2 text-[12px] outline-none focus:border-[#F5A623]/50" />
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={creer} disabled={!form.nom || !form.email || saving}
              className="px-4 py-2 bg-[#F5A623] text-white rounded-xl text-[12px] font-bold disabled:opacity-50">
              {saving ? "…" : "Créer"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-[12px] text-gray-600">
              Annuler
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400">Chargement…</div>
      ) : affilies.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <Users size={28} className="text-gray-200 mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-[#111]">Aucun affilié</p>
          <p className="text-[11px] text-gray-400 mt-1">Partagez votre lien d'inscription pour recruter des affiliés.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {affilies.map(a => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[#111111]/15 flex items-center justify-center text-[12px] font-bold text-[#1B2A4A] shrink-0">
                  {a.nom.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-[#111]">{a.nom}</p>
                    <Badge statut={a.statut} />
                  </div>
                  <p className="text-[11px] text-gray-400">{a.email}{a.telephone ? ` · ${a.telephone}` : ""}</p>
                  <p className="text-[10px] font-mono text-[#F5A623] mt-0.5">Code: {a.codeParrainage}</p>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-400">
                    <span><Eye size={10} className="inline mr-1"/>{a.clics} clics</span>
                    <span><ShoppingBag size={10} className="inline mr-1"/>{a.conversions} ventes</span>
                    <span className="text-[#F5A623] font-bold">{a.commissionTotal.toLocaleString()} XAF</span>
                    {a.commissionPending > 0 && (
                      <span className="text-amber-600">({a.commissionPending.toLocaleString()} en att.)</span>
                    )}
                  </div>
                </div>
              </div>
              {/* Actions */}
              <div className="mt-3 flex gap-2">
                {a.statut === "en_attente" && (
                  <button onClick={() => changerStatut(a.id, "actif")}
                    disabled={actioning === a.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold hover:bg-green-200 transition-colors">
                    <UserCheck size={10}/> Approuver
                  </button>
                )}
                {a.statut === "actif" && (
                  <button onClick={() => changerStatut(a.id, "suspendu")}
                    disabled={actioning === a.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-[10px] font-bold hover:bg-red-200 transition-colors">
                    <UserX size={10}/> Suspendre
                  </button>
                )}
                {a.statut === "suspendu" && (
                  <button onClick={() => changerStatut(a.id, "actif")}
                    disabled={actioning === a.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold hover:bg-green-200 transition-colors">
                    <UserCheck size={10}/> Réactiver
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Paiements ────────────────────────────────────────────────────────────────
function OngletPaiements() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  const charger = useCallback(() => {
    fetch("/api/affiliation/paiements")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function payer(affilieId: string) {
    setPaying(affilieId);
    try {
      const res = await fetch("/api/affiliation/paiements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ affilieId }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      toast.success(`Paiement de ${d.montant.toLocaleString()} XAF envoyé`);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du paiement");
    } finally {
      setPaying(null); charger();
    }
  }

  if (loading) return <div className="py-12 text-center text-sm text-gray-400">Chargement…</div>;

  const paiements = data?.paiements ?? [];
  const commissionsDues = data?.commissionsDues ?? [];
  const stats = data?.stats ?? { totalPaye: 0, totalDu: 0, soldeRestant: 0 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-[10px] text-gray-400">Total payé</p>
          <p className="text-[18px] font-bold text-[#10b981]">{stats.totalPaye.toLocaleString()} XAF</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4">
          <p className="text-[10px] text-gray-400">Dû aux affiliés</p>
          <p className="text-[18px] font-bold text-[#F5A623]">{stats.totalDu.toLocaleString()} XAF</p>
        </div>
      </div>

      {/* Commissions dues — paiement réel en un clic */}
      <div>
        <p className="text-[12px] font-bold text-[#111] mb-2">À payer</p>
        {commissionsDues.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6 bg-white border border-dashed border-gray-200 rounded-2xl">Aucune commission approuvée en attente de paiement</p>
        ) : (
          <div className="space-y-2">
            {commissionsDues.map((g: any) => (
              <div key={g.affilieId} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F5A623]/10 flex items-center justify-center flex-shrink-0">
                  <Clock size={16} className="text-[#F5A623]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#111] truncate">{g.affilie?.nom ?? "Affilié"}</p>
                  <p className="text-[11px] text-gray-400">{g.nombreCommissions} commission{g.nombreCommissions > 1 ? "s" : ""} · {g.affilie?.telephone ?? "pas de téléphone"}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[14px] font-bold text-[#F5A623]">{g.montant.toLocaleString()} XAF</p>
                </div>
                <button onClick={() => payer(g.affilieId)} disabled={paying === g.affilieId || !g.affilie?.telephone}
                  className="px-3 py-1.5 bg-green-500 text-white rounded-xl text-[10px] font-bold hover:bg-green-600 disabled:opacity-50 flex-shrink-0">
                  {paying === g.affilieId ? "…" : "Payer"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historique */}
      <div>
        <p className="text-[12px] font-bold text-[#111] mb-2">Historique</p>
        {paiements.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">Aucun paiement enregistré</p>
        ) : (
          <div className="space-y-2">
            {paiements.map((p: any) => (
              <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: p.statut === "traite" ? "#10b98115" : p.statut === "echec" ? "#ef444415" : "#F5A62315" }}>
                  {p.statut === "traite" ? <CheckCircle size={16} className="text-green-500"/> : p.statut === "echec" ? <XCircle size={16} className="text-red-500" /> : <Clock size={16} className="text-[#F5A623]"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#111]">{p.affilie?.nom ?? p.affilieurId.slice(-8)}</p>
                  <p className="text-[11px] text-gray-400">{p.methode} · {p.telephone ?? "—"} · {new Date(p.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <div className="text-right">
                  <p className="text-[14px] font-bold text-[#F5A623]">{p.montant.toLocaleString()} XAF</p>
                  <Badge statut={p.statut === "traite" ? "payee" : p.statut === "echec" ? "rejetee" : "pending"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mes liens (B2B sortants) ─────────────────────────────────────────────────
function OngletLiens() {
  const [liens, setLiens] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [totaux, setTotaux] = useState({ total: 0, pending: 0, captured: 0 });
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  useEffect(() => {
    Promise.all([
      fetch("/api/affiliation/liens").then(r => r.json()),
      fetch("/api/affiliation/commissions?role=affilieur").then(r => r.json()),
    ]).then(([liensData, comData]) => {
      setLiens(liensData.liens ?? []);
      setCommissions(comData.commissions ?? []);
      setTotaux(comData.totaux ?? { total: 0, pending: 0, captured: 0 });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalClics = liens.reduce((a, l) => a + l.clics, 0);
  const totalConversions = liens.reduce((a, l) => a + l.conversions, 0);
  const getLienUrl = (l: any) => `${appUrl}/${l.tenant.slug}${l.produitId ? `/produits/${l.produitId}` : ""}?ref=${l.code}`;

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Chargement…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total gagné",    value: `${totaux.total.toLocaleString()} XAF`,   color: "#10b981" },
          { label: "En attente",     value: `${totaux.pending.toLocaleString()} XAF`,  color: "#F5A623" },
          { label: "Clics",          value: totalClics.toLocaleString(),                color: "#0ea5e9" },
          { label: "Conversions",    value: totalConversions.toLocaleString(),          color: "#111111" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
            <p className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {liens.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center">
          <Share2 size={28} className="text-gray-200 mx-auto mb-3"/>
          <p className="text-[13px] font-semibold text-[#111]">Aucun lien encore</p>
          <p className="text-[12px] text-gray-400 mt-1">Allez sur la page d'un produit et cliquez "Obtenir mon lien d'affiliation"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {liens.map(lien => {
            const url = getLienUrl(lien);
            const trackUrl = `${appUrl}/api/track/${lien.code}`;
            const taux = lien.produit?.tauxCommissionAff ? `${Math.round(lien.produit.tauxCommissionAff * 100)}%` : "—";
            return (
              <div key={lien.id} className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  {lien.produit?.images?.[0] && <img src={lien.produit.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0"/>}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[#111] truncate">{lien.produit?.nom ?? lien.tenant.nomBoutique}</p>
                      <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold shrink-0">{taux}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">{lien.tenant.nomBoutique} · <span className="font-mono font-bold text-[#F5A623]">{lien.code}</span></p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-[10px] text-gray-400 font-mono truncate">{trackUrl}</div>
                      <button onClick={() => copier(trackUrl, v => { if (v) setCopiedId(lien.id); })}
                        className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${copiedId === lien.id ? "bg-green-100 text-green-700" : "bg-[#111] text-white"}`}>
                        {copiedId === lien.id ? <CheckCheck size={11}/> : <Copy size={11}/>}
                      </button>
                    </div>
                    <div className="mt-2 flex gap-4 text-[11px] text-gray-400">
                      <span><Eye size={10} className="inline mr-1"/>{lien.clics} clics</span>
                      <span><ShoppingBag size={10} className="inline mr-1"/>{lien.conversions} ventes</span>
                      <span className="text-green-600 font-bold">+{(lien.montantGenere ?? 0).toLocaleString()} XAF</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Matériel marketing ───────────────────────────────────────────────────────
const COULEURS_BANNIERE = ["#F5A623", "#111111", "#22c55e", "#3b82f6", "#ef4444"];

function BannierePreview({ lien, couleur, texte, baseUrl }: { lien: any; couleur: string; texte: string; baseUrl: string }) {
  const url = `${baseUrl}?ref=${lien.code}`;
  return (
    <div className="border border-[#E8E8E8] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 text-white" style={{ background: `linear-gradient(135deg, ${couleur}, ${couleur}dd)`, minHeight: 80 }}>
        <div>
          <p className="font-bold text-[15px]">{texte || "Découvrez nos produits"}</p>
          <p className="text-[11px] opacity-80 mt-0.5">{lien.produit ? `${lien.produit.nom} — ${lien.produit.prix.toLocaleString()} XAF` : "Boutique complète"}</p>
        </div>
        <div className="bg-white/20 border border-white/30 rounded-xl px-4 py-2 text-[12px] font-bold">Voir →</div>
      </div>
      <div className="bg-[#FAFAFA] p-3 flex items-center justify-between">
        <p className="text-[11px] text-[#888] font-mono truncate max-w-[60%]">{url}</p>
        <div className="flex gap-2">
          <button onClick={() => { navigator.clipboard.writeText(url); toast.success("Lien copié !"); }}
            className="flex items-center gap-1 text-[11px] border border-[#E8E8E8] px-2.5 py-1 rounded-lg text-[#666]">
            <Copy size={10} /> Copier
          </button>
          <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] border border-[#E8E8E8] px-2.5 py-1 rounded-lg text-[#666]">
            <ExternalLink size={10} /> Tester
          </a>
        </div>
      </div>
    </div>
  );
}

function OngletMateriel() {
  const [liens, setLiens] = useState<any[]>([]);
  const [lienChoisi, setLienChoisi] = useState<any>(null);
  const [couleur, setCouleur] = useState(COULEURS_BANNIERE[0]);
  const [texte, setTexte] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
    fetch("/api/affiliation/liens").then(r => r.json()).then(d => {
      const l = d.liens ?? [];
      setLiens(l);
      if (l.length) setLienChoisi(l[0]);
    });
  }, []);

  async function updateCookieJours(lienId: string, jours: number) {
    await fetch("/api/affiliation/liens", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lienId, cookieJours: jours }) }).catch(() => null);
    const r = await fetch("/api/affiliation/liens").then(r => r.json());
    setLiens(r.liens ?? []);
  }

  function genererHTML(lien: any) {
    const url = `${baseUrl}?ref=${lien.code}`;
    const html = `<a href="${url}" style="display:inline-block;background:${couleur};color:white;padding:12px 28px;border-radius:12px;font-family:sans-serif;font-weight:bold;font-size:14px;text-decoration:none;">${texte || "Découvrez notre boutique"}</a>`;
    navigator.clipboard.writeText(html);
    toast.success("Code HTML copié !");
  }

  const inp = "border border-[#E8E8E8] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#F5A623]/60 bg-white";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-[13px] font-bold text-[#111] mb-1">Attribution — fenêtre cookie</h2>
        <p className="text-[11px] text-[#888] mb-3">Détermine combien de jours après le clic un affilié perçoit sa commission.</p>
        <div className="space-y-2">
          {liens.map(l => (
            <div key={l.id} className="flex items-center gap-3 p-3 bg-[#FAFAFA] rounded-xl">
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#111]">Code : <span className="font-mono text-[#F5A623]">{l.code}</span></p>
                <p className="text-[10.5px] text-[#888]">{l.produit?.nom ?? "Boutique entière"} · {l.clics} clics · {l.conversions} conv.</p>
              </div>
              <select className={inp} value={l.cookieJours} onChange={e => updateCookieJours(l.id, parseInt(e.target.value))}>
                {[1, 7, 14, 30, 60, 90].map(j => <option key={j} value={j}>{j} jours</option>)}
              </select>
            </div>
          ))}
          {!liens.length && <p className="text-[12px] text-[#AAA] text-center py-4">Aucun lien d'affiliation — voir l'onglet "Mes liens".</p>}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
        <h2 className="text-[13px] font-bold text-[#111]">Générateur de bannières</h2>
        <div className="grid grid-cols-2 gap-2">
          <select className={`w-full ${inp}`} value={lienChoisi?.id ?? ""} onChange={e => setLienChoisi(liens.find(l => l.id === e.target.value) ?? null)}>
            {liens.map(l => <option key={l.id} value={l.id}>{l.code} — {l.produit?.nom ?? "Boutique"}</option>)}
          </select>
          <input className={`w-full ${inp}`} placeholder="Texte du bouton" value={texte} onChange={e => setTexte(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {COULEURS_BANNIERE.map(c => (
            <button key={c} onClick={() => setCouleur(c)} className="w-7 h-7 rounded-full border-2 transition-all" style={{ background: c, borderColor: couleur === c ? "#111" : "transparent" }} />
          ))}
        </div>
        {lienChoisi && (
          <div className="space-y-2">
            <BannierePreview lien={lienChoisi} couleur={couleur} texte={texte} baseUrl={baseUrl} />
            <div className="flex gap-2">
              <button onClick={() => genererHTML(lienChoisi)} className="flex items-center gap-1.5 border border-[#E8E8E8] px-3 py-1.5 rounded-xl text-[11px] text-[#666]"><Copy size={11} /> Code HTML</button>
              <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}?ref=${lienChoisi.code}`); toast.success("URL copiée !"); }} className="flex items-center gap-1.5 border border-[#E8E8E8] px-3 py-1.5 rounded-xl text-[11px] text-[#666]"><Copy size={11} /> URL simple</button>
            </div>
          </div>
        )}
      </div>

      {lienChoisi && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-[13px] font-bold text-[#111] mb-3">Textes clé-en-main</h2>
          <div className="space-y-2">
            {[
              { label: "WhatsApp / SMS", texte: `🛍️ Je te recommande cette boutique ! Commande ici : ${baseUrl}?ref=${lienChoisi.code}` },
              { label: "Instagram / Facebook", texte: `✨ ${texte || "Découvrez cette boutique incroyable"} ! Lien en bio → ${baseUrl}?ref=${lienChoisi.code}` },
              { label: "Email", texte: `Bonjour,\n\nJe voulais vous partager une boutique que j'aime beaucoup :\n${baseUrl}?ref=${lienChoisi.code}\n\nBonne découverte !` },
            ].map(t => (
              <div key={t.label} className="bg-[#FAFAFA] rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10.5px] font-bold text-[#666]">{t.label}</p>
                  <button onClick={() => { navigator.clipboard.writeText(t.texte); toast.success("Copié !"); }} className="flex items-center gap-1 text-[10px] border border-[#E8E8E8] px-2 py-0.5 rounded-lg text-[#666]"><Copy size={9} /> Copier</button>
                </div>
                <p className="text-[11px] text-[#666] leading-relaxed whitespace-pre-line">{t.texte}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Liens sortants (affiliation entrante) ───────────────────────────────────
const ENTRANTE_EMPTY = { nom: "", marchand: "", url: "", categorie: "", commission: "10", devise: "XAF" };

function OngletEntrante() {
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ total: 0, actifs: 0, revenuTotal: 0, clicsTotal: 0 });
  const [form, setForm] = useState({ ...ENTRANTE_EMPTY });
  const [loading, setLoading] = useState(false);

  async function load() {
    const r = await fetch("/api/affiliation/entrante").then(r => r.json());
    setProgrammes(r.programmes ?? []);
    setStats(r.stats ?? {});
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.nom || !form.url) return;
    setLoading(true);
    await fetch("/api/affiliation/entrante", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, commission: parseFloat(form.commission) / 100 }) });
    setForm({ ...ENTRANTE_EMPTY });
    await load();
    setLoading(false);
  }

  async function toggle(p: any) {
    await fetch("/api/affiliation/entrante", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, actif: !p.actif }) });
    load();
  }

  async function del(id: string) {
    if (!confirm("Supprimer ce programme ?")) return;
    await fetch(`/api/affiliation/entrante?id=${id}`, { method: "DELETE" });
    load();
  }

  const inp = "w-full border border-[#E8E8E8] rounded-xl px-3 py-2 text-[13px] outline-none focus:border-[#F5A623]/60";

  return (
    <div className="space-y-4">
      <div className="bg-[#FFF8EC] border border-[#F5A623]/20 rounded-2xl p-4 text-[12.5px] text-[#7a5a00]">
        <strong>Comment ça marche :</strong> Ajoutez un programme d'affiliation où <em>vous</em> êtes affilié d'un autre marchand (Jumia Affiliate, Amazon Associates, un partenaire local...). Partagez votre lien, percevez une commission sur chaque vente.
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Programmes", v: stats.total },
          { label: "Actifs", v: stats.actifs, color: "#22c55e" },
          { label: "Clics", v: stats.clicsTotal },
          { label: "Revenus", v: `${(stats.revenuTotal ?? 0).toLocaleString()} XAF`, color: "#F5A623" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-3 text-center">
            <p className="text-[16px] font-bold" style={{ color: s.color ?? "#111" }}>{s.v}</p>
            <p className="text-[10px] text-[#AAA] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
        <h2 className="text-[13px] font-bold text-[#111]">Ajouter un programme</h2>
        <div className="grid grid-cols-2 gap-2">
          <input className={inp} placeholder="Nom (ex: Jumia Affiliate)" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
          <input className={inp} placeholder="Marchand / Plateforme" value={form.marchand} onChange={e => setForm(f => ({ ...f, marchand: e.target.value }))} />
          <input className={inp} placeholder="Lien d'affiliation" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
          <input className={inp} placeholder="Catégorie (optionnel)" value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))} />
          <div className="flex gap-2">
            <input className={inp} placeholder="Commission %" type="number" value={form.commission} onChange={e => setForm(f => ({ ...f, commission: e.target.value }))} />
            <select className={inp} value={form.devise} onChange={e => setForm(f => ({ ...f, devise: e.target.value }))}>
              <option>XAF</option><option>EUR</option><option>USD</option>
            </select>
          </div>
        </div>
        <button onClick={save} disabled={!form.nom || !form.url || loading}
          className="px-5 py-2 rounded-xl text-white text-[12px] font-semibold disabled:opacity-40" style={{ background: "#F5A623" }}>
          {loading ? "…" : "Ajouter le programme"}
        </button>
      </div>

      <div className="space-y-2">
        {programmes.map(p => (
          <div key={p.id} className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-[#111]">{p.nom}</p>
                  {p.categorie && <span className="text-[9.5px] bg-[#F0F0F0] text-[#666] px-2 py-0.5 rounded-full">{p.categorie}</span>}
                  {!p.actif && <span className="text-[9.5px] bg-[#F0F0F0] text-[#AAA] px-2 py-0.5 rounded-full">Inactif</span>}
                </div>
                <p className="text-[11px] text-[#888] mt-0.5">{p.marchand} · Commission : {Math.round(p.commission * 100)}%</p>
                <p className="text-[10.5px] text-[#3b82f6] mt-1 truncate max-w-sm">{p.url}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[12.5px] font-bold text-[#F5A623]">{p.revenus.toLocaleString()} {p.devise}</p>
                <p className="text-[10.5px] text-[#AAA]">{p.clics} clics · {p.conversions} conv.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { navigator.clipboard.writeText(p.url); toast.success("Lien copié !"); }} className="text-[10.5px] border border-[#E8E8E8] px-3 py-1 rounded-lg text-[#666]">Copier le lien</button>
              <button onClick={() => toggle(p)} className="text-[10.5px] border border-[#E8E8E8] px-3 py-1 rounded-lg text-[#666]">{p.actif ? "Désactiver" : "Activer"}</button>
              <button onClick={() => del(p.id)} className="text-[10.5px] border border-red-100 px-3 py-1 rounded-lg text-red-500">Supprimer</button>
            </div>
          </div>
        ))}
        {!programmes.length && (
          <div className="bg-[#FAFAFA] rounded-2xl p-8 text-center text-[12px] text-[#AAA]">Aucun programme — ajoutez-en un pour générer des revenus passifs.</div>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function AffiliationPage() {
  const searchParams = useSearchParams();
  const [onglet, setOnglet] = useState(searchParams?.get("tab") || "stats");

  return (
    <div className="p-5 max-w-4xl mx-auto space-y-5" style={{ fontFamily: "'Poppins',system-ui,sans-serif" }}>
      <ModuleTutorial moduleKey="affiliation" titre="Affiliation" sousTitre="Ton programme d'ambassadeurs" steps={AFFILIATION_TUTORIAL_STEPS} />
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[18px] font-bold text-[#111] inline-flex items-center gap-2">Affiliation <AgentActiveIndicator label="Agent Growth actif" /></h1>
          <BoutonRevoirTutoriel moduleKey="affiliation" />
        </div>
        <p className="text-[12px] text-gray-500">Programme d'affiliation, affiliés et commissions</p>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setOnglet(id)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${onglet === id ? "bg-white shadow-sm text-[#111]" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon size={11}/>
            {label}
          </button>
        ))}
      </div>

      {onglet === "stats"     && <OngletStats />}
      {onglet === "programme" && <OngletProgramme />}
      {onglet === "affilies"  && <OngletAffilies />}
      {onglet === "paiements" && <OngletPaiements />}
      {onglet === "liens"     && <OngletLiens />}
      {onglet === "materiel"  && <OngletMateriel />}
      {onglet === "entrante"  && <OngletEntrante />}
    </div>
  );
}
