"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Send, Wand2, Users, Clock, CheckCircle2, XCircle,
  Mail, RefreshCw, ChevronDown, Sparkles, Eye,
  Gem, Moon, Flame, Crown, UserPlus
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface Stats {
  segments: { tous: number; vip: number; nouveaux: number; inactifs: number };
  providers: { gmail: boolean; resend: boolean };
}

interface Campagne {
  id: string; sujet: string; corps: string; segment: string;
  nbEnvoyes: number; statut: string; source: string; createdAt: string;
}

const SEGMENTS = [
  { value: "tous",     label: "Tous les clients",          Icon: Users    },
  { value: "vip",      label: "VIP (≥ 50 000 XAF dépensés)", Icon: Gem   },
  { value: "nouveaux", label: "Nouveaux (≤ 1 commande)",   Icon: UserPlus },
  { value: "inactifs", label: "Inactifs (30+ jours)",      Icon: Moon     },
];

const TEMPLATES = [
  {
    id: "promo", label: "Promotion flash", Icon: Flame,
    sujet: "Offre limitée — {boutique}",
    corps: "Bonjour {prenom},\n\nNous avons une offre exclusive pour vous ! Profitez de -20% sur toute la boutique ce weekend.\n\nUtilisez le code : PROMO20\n\nÀ très vite,\nL'équipe {boutique}",
  },
  {
    id: "nouveau_produit", label: "Nouveau produit", Icon: Sparkles,
    sujet: "Découvrez notre nouveauté — {boutique}",
    corps: "Bonjour {prenom},\n\nNous venons de lancer un nouveau produit que vous allez adorer !\n\nDécouvrez-le maintenant sur notre boutique.\n\nCordialement,\n{boutique}",
  },
  {
    id: "relance", label: "Relance client", Icon: Mail,
    sujet: "On pense à vous, {prenom} — {boutique}",
    corps: "Bonjour {prenom},\n\nVous nous manquez ! Voici un code de bienvenue spécialement pour vous : RETOUR15\n\nValidez votre prochain achat avec -15% de réduction.\n\nÀ bientôt,\n{boutique}",
  },
  {
    id: "fidelite", label: "Fidélité VIP", Icon: Crown,
    sujet: "Merci pour votre fidélité, {prenom} !",
    corps: "Bonjour {prenom},\n\nEn tant que client VIP de {boutique}, vous bénéficiez d'un accès exclusif à nos meilleures offres.\n\nMerci pour votre confiance !\n\nL'équipe {boutique}",
  },
];

// ── Composant principal ──────────────────────────────────────────────────────
export default function EmailMarketingPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [historique, setHistorique] = useState<Campagne[]>([]);
  const [segment, setSegment] = useState("tous");
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [provider, setProvider] = useState<"resend" | "gmail">("resend");
  const [templateId, setTemplateId] = useState("promo");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ envoyes: number; total: number; source: string } | null>(null);
  const [erreur, setErreur] = useState("");
  const [onglet, setOnglet] = useState<"composer" | "historique">("composer");
  const [preview, setPreview] = useState(false);

  const charger = useCallback(async () => {
    const [s, h] = await Promise.all([
      fetch("/api/email?action=stats").then(r => r.json()),
      fetch("/api/email?action=historique").then(r => r.json()),
    ]);
    setStats(s);
    setHistorique(Array.isArray(h) ? h : []);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  function appliquerTemplate(id: string) {
    const t = TEMPLATES.find(t => t.id === id);
    if (!t) return;
    setTemplateId(id);
    setSujet(t.sujet);
    setCorps(t.corps);
  }

  async function genererAvecIA() {
    setGenerating(true);
    setErreur("");
    try {
      const res = await fetch("/api/ai/agent-marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Génère une campagne email pour le segment "${SEGMENTS.find(s => s.value === segment)?.label}". Template style: ${templateId}. Retourne un JSON avec les clés "sujet" et "corps". Corps en texte simple avec variables {prenom} et {boutique}.`,
          }],
        }),
      });
      const data = await res.json();
      const content = data.message ?? "";
      const match = content.match(/\{[\s\S]*?"sujet"[\s\S]*?\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          if (parsed.sujet) setSujet(parsed.sujet);
          if (parsed.corps) setCorps(parsed.corps);
        } catch {
          // Fallback: use the whole content as corps
          setCorps(content.slice(0, 800));
        }
      } else {
        setCorps(content.slice(0, 600));
      }
    } catch {
      setErreur("Erreur de génération IA");
    } finally {
      setGenerating(false);
    }
  }

  async function envoyer() {
    if (!sujet.trim() || !corps.trim()) { setErreur("Remplissez le sujet et le message"); return; }
    setSending(true);
    setErreur("");
    setResult(null);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sujet, corps, segment, provider }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setResult({ envoyes: data.envoyes, total: data.total, source: data.source });
      charger();
    } catch (e: any) {
      setErreur(e.message ?? "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  }

  const nbDest = stats?.segments?.[segment as keyof typeof stats.segments] ?? "...";


  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111] tracking-tight">Email Marketing</h1>
          <p className="text-[12.5px] text-[#AAAAAA] mt-0.5">Envoyez des campagnes directement depuis Axso</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOnglet("composer")}
            className="px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all"
            style={onglet === "composer"
              ? { background: "#111111", color: "#FFFFFF", border: "1px solid #111111" }
              : { background: "#FFFFFF", color: "#888888", border: "1px solid #E8E8E8" }}>
            Composer
          </button>
          <button onClick={() => { setOnglet("historique"); charger(); }}
            className="px-3.5 py-2 rounded-full text-[12px] font-semibold transition-all"
            style={onglet === "historique"
              ? { background: "#111111", color: "#FFFFFF", border: "1px solid #111111" }
              : { background: "#FFFFFF", color: "#888888", border: "1px solid #E8E8E8" }}>
            Historique ({historique.length})
          </button>
        </div>
      </div>

      {/* Providers connectés */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { key: "resend", label: "Resend",      Icon: Send, actif: stats?.providers.resend, desc: "Emails transactionnels jusqu'à 50/envoi" },
          { key: "gmail",  label: "Gmail OAuth", Icon: Mail, actif: stats?.providers.gmail,  desc: "Votre compte Gmail professionnel" },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => p.actif && setProvider(p.key as "resend" | "gmail")}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${provider === p.key && p.actif ? "border-[#F5A623] bg-amber-50" : "border-gray-100 bg-white"} ${!p.actif ? "opacity-50 cursor-not-allowed" : "hover:border-[#F5A623]/40"}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <p.Icon size={18} className="text-gray-600 flex-shrink-0" />
              <span className="font-semibold text-gray-900 text-sm">{p.label}</span>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${p.actif ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {p.actif ? "Connecté" : "Non connecté"}
              </span>
            </div>
            <p className="text-xs text-gray-400">{p.desc}</p>
            {!p.actif && <p className="text-xs text-[#F5A623] mt-1">→ Connecter dans Connecteurs</p>}
          </button>
        ))}
      </div>

      {onglet === "composer" && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Panneau gauche — formulaire */}
          <div className="space-y-5">
            {/* Segment */}
            <div className="ax-card p-5">
              <label className="text-sm font-bold text-gray-700 mb-3 block">Destinataires</label>
              <div className="space-y-2">
                {SEGMENTS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSegment(s.value)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border-2 text-sm transition-all ${segment === s.value ? "border-[#F5A623] bg-amber-50" : "border-gray-100 hover:border-gray-200"}`}
                  >
                    <span className="flex items-center gap-2">
                      <s.Icon size={15} className={segment === s.value ? "text-[#F5A623]" : "text-gray-400"} />
                      <span className={segment === s.value ? "font-semibold text-gray-900" : "text-gray-600"}>{s.label}</span>
                    </span>
                    <span className="text-xs font-bold text-gray-400">{stats?.segments?.[s.value as keyof typeof stats.segments] ?? "..."}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Templates */}
            <div className="ax-card p-5">
              <label className="text-sm font-bold text-gray-700 mb-3 block">Template</label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => appliquerTemplate(t.id)}
                    className={`p-3 rounded-xl border-2 text-left text-sm transition-all flex items-center gap-2 ${templateId === t.id ? "border-[#F5A623] bg-amber-50" : "border-gray-100 hover:border-gray-200"}`}
                  >
                    <t.Icon size={15} className={templateId === t.id ? "text-[#F5A623] flex-shrink-0" : "text-gray-400 flex-shrink-0"} />
                    <span className={`font-medium ${templateId === t.id ? "text-gray-900" : "text-gray-600"}`}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Panneau droit — éditeur */}
          <div className="space-y-4">
            <div className="ax-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-700">Contenu de la campagne</h2>
                <button
                  onClick={genererAvecIA}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-all disabled:opacity-60"
                >
                  {generating ? <RefreshCw size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  {generating ? "Génération IA..." : "Générer avec IA"}
                </button>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Sujet *</label>
                <input
                  value={sujet}
                  onChange={(e) => setSujet(e.target.value)}
                  placeholder="Ex: 🔥 Offre spéciale pour vous !"
                  className="w-full bg-white border border-[#E8E8E8] rounded-2xl px-4 py-2.5 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 transition-all"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1 block">Corps du message * (variables: {"{prenom}"} {"{boutique}"})</label>
                <textarea
                  value={corps}
                  onChange={(e) => setCorps(e.target.value)}
                  placeholder="Bonjour {prenom},&#10;&#10;Votre message ici..."
                  rows={8}
                  className="w-full bg-white border border-[#E8E8E8] rounded-2xl px-4 py-2.5 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 transition-all resize-none"
                />
              </div>

              {/* Preview toggle */}
              {corps && (
                <button onClick={() => setPreview(!preview)} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
                  <Eye size={12} />
                  {preview ? "Masquer" : "Prévisualiser"} l'email
                </button>
              )}

              {preview && corps && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 text-xs text-gray-500">
                    Aperçu — {sujet || "(sans sujet)"}
                  </div>
                  <div className="p-4 bg-white max-h-60 overflow-y-auto">
                    <div className="bg-[#F5A623] text-white px-6 py-4 rounded-t-xl font-bold text-base">Votre Boutique</div>
                    <div className="px-6 py-4 text-sm text-gray-700 leading-relaxed border border-t-0 border-gray-100 rounded-b-xl" style={{ whiteSpace: "pre-wrap" }}>
                      {corps.replace(/\{prenom\}/g, "Aminata").replace(/\{boutique\}/g, "Votre Boutique")}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Résultats */}
            {result && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-50 border border-green-200">
                <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-green-800">Campagne envoyée !</p>
                  <p className="text-xs text-green-600">{result.envoyes}/{result.total} emails via {result.source}</p>
                </div>
              </div>
            )}
            {erreur && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
                <XCircle size={18} className="text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{erreur}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={envoyer}
                disabled={sending || !sujet || !corps}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #F5A623, #e8950f)" }}
              >
                {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                {sending ? "Envoi..." : `Envoyer (${nbDest})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {onglet === "historique" && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Campagnes envoyées</h2>
            <button onClick={charger} className="p-2 rounded-xl hover:bg-gray-50 transition-all text-gray-400">
              <RefreshCw size={16} />
            </button>
          </div>
          {historique.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Mail size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucune campagne envoyée</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {historique.map((c) => (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.statut === "envoye" ? "bg-green-50" : "bg-red-50"}`}>
                    {c.statut === "envoye" ? <CheckCircle2 size={18} className="text-green-600" /> : <XCircle size={18} className="text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{c.sujet}</p>
                    <p className="text-xs text-gray-400">
                      {SEGMENTS.find(s => s.value === c.segment)?.label ?? c.segment} · {c.nbEnvoyes} envoyé{c.nbEnvoyes > 1 ? "s" : ""} · {c.source}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.statut === "envoye" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {c.statut === "envoye" ? "Envoyé" : "Échec"}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
