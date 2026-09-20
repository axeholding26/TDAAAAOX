"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageCircle, Send, Search, CheckCircle2,
  Clock, Truck, Package, XCircle, Phone,
  Settings, Wifi, WifiOff, Loader2, ShoppingBag, ArrowLeft,
  CheckCheck, Check, Zap, MapPin, FileText, RefreshCw, Bell,
  ChevronDown, Plus, Lightbulb, Lock
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { UpgradeGate } from "@/components/dashboard/UpgradeGate";
import { ModuleTutorial, BoutonRevoirTutoriel } from "@/components/dashboard/ModuleTutorial";

const WHATSAPP_TUTORIAL_STEPS = [
  { Icon: Settings,      titre: "Connecte ton WhatsApp Business", description: "Clique sur l'icône réglages en haut de la liste pour connecter WhatsApp — via Genuka (simple) ou l'API officielle Meta." },
  { Icon: MessageCircle, titre: "Toutes tes conversations",       description: "Retrouve tous tes contacts clients, avec badge de messages non lus et mise à jour automatique toutes les 15 secondes." },
  { Icon: Zap,           titre: "Réponses rapides",                description: "Utilise l'éclair à côté du champ de saisie pour envoyer en un clic un message prêt : Bonjour, Reçu, Expédiée, Livrée..." },
  { Icon: ShoppingBag,   titre: "Commandes liées au contact",      description: "À droite, confirme une commande, envoie le lien de suivi ou la facture directement dans la conversation. Si le client répond \"OUI\", sa commande se confirme automatiquement." },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface Conversation {
  de: string; nom: string | null; dernier: string;
  lu: boolean; nonLus: number; updatedAt: string;
}
interface Message {
  id: string; de: string; nom: string | null;
  corps: string; lu: boolean;
  direction: "entrant" | "sortant";
  commandeId: string | null; createdAt: string;
}
interface Commande {
  id: string; numero: string; statut: string;
  paiementStatut: string; montantTotal: number; devise: string;
  createdAt: string; trackingToken?: string | null;
  lignes: { nom: string; quantite: number }[];
}
interface WaConfig { statut: string; via: "meta" | "genuka"; config: { phone_number_id?: string; numero_affiche?: string; verified_name?: string } | null }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function heure(iso: string) {
  const d = new Date(iso), now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "maintenant";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
function initiales(nom: string | null, tel: string) {
  if (nom) return nom.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  return tel.slice(-2);
}
function avatarColor(seed: string) {
  const colors = ["#25D366","#F5A623","#1B2A4A","#0ea5e9","#ec4899","#f97316","#10b981"];
  return colors[seed.charCodeAt(seed.length - 1) % colors.length];
}

const STATUT_LABEL: Record<string, { label: string; color: string; icon: any }> = {
  en_attente:     { label: "En attente",     color: "#f59e0b", icon: Clock },
  confirmee:      { label: "Confirmée",      color: "#60a5fa", icon: CheckCircle2 },
  en_preparation: { label: "En préparation", color: "#FFD280", icon: Package },
  expediee:       { label: "Expédiée",       color: "#38bdf8", icon: Truck },
  livree:         { label: "Livrée",         color: "#34d399", icon: CheckCircle2 },
  annulee:        { label: "Annulée",        color: "#f87171", icon: XCircle },
};

// ─── Templates réponse rapide ────────────────────────────────────────────────
const TEMPLATES = [
  { label: "Bonjour", text: "Bonjour 👋 Comment puis-je vous aider ?" },
  { label: "Reçu", text: "Votre commande a bien été reçue, merci ! ✅" },
  { label: "En cours", text: "Votre commande est en cours de préparation 📦" },
  { label: "Expédiée", text: "Votre commande a été expédiée 🚚 Vous serez livré très prochainement !" },
  { label: "Livrée", text: "Votre commande a été livrée avec succès ✅ Merci pour votre confiance !" },
  { label: "Confirmation", text: "Pouvez-vous confirmer votre commande en répondant OUI ? 🙏" },
];

// ─── Modal Config ─────────────────────────────────────────────────────────────
const WEBHOOK_URL    = "https://axso.vercel.app/api/webhooks/whatsapp";
const WEBHOOK_TOKEN  = process.env.NEXT_PUBLIC_META_WEBHOOK_TOKEN ?? "axso_meta_2026";

function CopyBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <code className="flex-1 text-xs font-mono text-white break-all">{value}</code>
        <button onClick={copy} className="flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg transition-all"
          style={{ background: copied ? "rgba(37,211,102,0.2)" : "rgba(255,255,255,0.08)", color: copied ? "#25D366" : "#9ca3af" }}>
          {copied ? "✓ Copié" : "Copier"}
        </button>
      </div>
    </div>
  );
}

function ConfigPanel({ tenantId, onClose, onConnecte }: { tenantId: string; onClose: () => void; onConnecte: (cfg: WaConfig) => void }) {
  const [mode, setMode] = useState<"genuka" | "meta">("genuka");
  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({ phone_number_id: "", access_token: "" });
  const [proxyToken, setProxyToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const genukaWebhookUrl = tenantId ? `https://axso.vercel.app/api/webhooks/genuka/${tenantId}` : "";

  async function connecter() {
    if (!form.phone_number_id || !form.access_token) { toast.error("Remplissez tous les champs"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/connecteurs/whatsapp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`✅ WhatsApp connecté — ${data.numero ?? ""} (${data.nom ?? ""})`);
      onConnecte({ statut: "actif", via: "meta", config: { phone_number_id: form.phone_number_id, numero_affiche: data.numero, verified_name: data.nom } });
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  async function connecterGenuka() {
    if (!proxyToken.trim() && !webhookSecret.trim()) { toast.error("Renseignez le proxy token et/ou le secret du webhook"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/connecteurs/whatsapp-genuka", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proxyToken: proxyToken.trim() || undefined, webhookSecret: webhookSecret.trim() || undefined }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(proxyToken.trim() ? "✅ WhatsApp connecté via Genuka !" : "✅ Réception activée — ajoutez le proxy token plus tard pour activer l'envoi");
      onConnecte({ statut: "actif", via: "genuka", config: null });
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  const ETAPES = [
    { n: 1, label: "Créer l'app Meta" },
    { n: 2, label: "Configurer le webhook" },
    { n: 3, label: "Connecter au dashboard" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden" style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#25D366" }}>
                <MessageCircle size={15} className="text-white" />
              </div>
              <h2 className="text-white font-bold text-base">Connecter WhatsApp Business</h2>
            </div>
            <p className="text-gray-500 text-xs ml-10">
              {mode === "genuka" ? "Connexion simplifiée via Genuka · recommandé" : "Configuration guidée en 3 étapes · API officielle Meta"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-xl leading-none mt-1">×</button>
        </div>

        {/* Choix du mode */}
        <div className="px-6 pt-4 flex gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", margin: "16px 24px 0" }}>
          <button onClick={() => setMode("genuka")}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
            style={mode === "genuka" ? { background: "#25D366", color: "white" } : { color: "#9ca3af" }}>
            Genuka (simple)
          </button>
          <button onClick={() => setMode("meta")}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
            style={mode === "meta" ? { background: "#25D366", color: "white" } : { color: "#9ca3af" }}>
            Meta direct (avancé)
          </button>
        </div>

        {/* ── Mode Genuka ── */}
        {mode === "genuka" && (
          <div className="px-6 py-5 space-y-4">
            <div className="rounded-xl p-4 space-y-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <Step n="1" text="Créez un compte sur" link="https://genuka.com" linkLabel="genuka.com" text2="(gratuit)" />
              <Step n="2" text="Dans leur dashboard, connectez votre numéro" bold="WhatsApp Business" text2="(Meta Embedded Signup — quelques clics, sans configuration technique)" />
              <Step n="3" text="Générez un" bold="Proxy Token" text2="scopé « send_text »" />
              <Step n="4" text="Collez ce token ci-dessous" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Proxy Token Genuka</label>
              <div className="relative">
                <input value={proxyToken} onChange={e => setProxyToken(e.target.value)}
                  type={showToken ? "text" : "password"}
                  placeholder="gwa_xxxxxxxxxxxxxxxxxxxx"
                  className="w-full rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none transition-all pr-10"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${proxyToken ? "rgba(37,211,102,0.4)" : "rgba(255,255,255,0.1)"}` }} />
                <button type="button" onClick={() => setShowToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <Lock size={14} />
                </button>
              </div>
            </div>

            <div className="rounded-xl p-4 space-y-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pour recevoir les messages entrants dans Axso</p>
              <Step n="5" text="Dans Genuka, allez dans" bold="Paramètres → Webhooks" text2="et ajoutez cette URL sur l'événement « message.received »" />
              <CopyBox label="URL du webhook (propre à votre boutique)" value={genukaWebhookUrl || "Chargement…"} />
              <Step n="6" text="Genuka affichera un" bold="secret de signature" text2="— collez-le ci-dessous (recommandé)" />
              <div>
                <input value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)}
                  type="password"
                  placeholder="Secret de signature (optionnel)"
                  className="w-full rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${webhookSecret ? "rgba(37,211,102,0.4)" : "rgba(255,255,255,0.1)"}` }} />
              </div>
            </div>

            <div className="rounded-xl p-3 flex gap-3" style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.15)" }}>
              <Lightbulb size={18} className="text-[#F5A623] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400 leading-relaxed">
                Le proxy token (envoi) et le webhook (réception) sont indépendants — vous pouvez connecter avec un seul des deux en attendant l'autre. Sans proxy token, l'envoi automatique se rabat sur WhatsApp direct ou un lien wa.me. Sans secret de signature, les messages entrants s'affichent quand même, mais la confirmation automatique de commande par mot-clé (« OUI ») reste désactivée par sécurité.
              </p>
            </div>

            <div className="rounded-xl p-3 flex gap-3" style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.15)" }}>
              <CheckCircle2 size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-400 leading-relaxed">
                Pas de vérification Meta Business Manager complète à faire vous-même — Genuka s'en charge via son propre flux de connexion.
              </p>
            </div>

            <button onClick={connecterGenuka} disabled={loading || (!proxyToken.trim() && !webhookSecret.trim())}
              className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50" style={{ background: "#25D366" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Connecter WhatsApp
            </button>
          </div>
        )}

        {/* Stepper (mode Meta) */}
        {mode === "meta" && (
        <>
        <div className="px-6 pt-4 pb-3 flex items-center gap-0">
          {ETAPES.map((e, i) => (
            <div key={e.n} className="flex items-center" style={{ flex: i < 2 ? 1 : "none" }}>
              <button onClick={() => { if (e.n < etape || (e.n === 2)) setEtape(e.n as 1|2|3); }}
                className="flex items-center gap-2 group">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all"
                  style={{ background: etape === e.n ? "#25D366" : etape > e.n ? "rgba(37,211,102,0.2)" : "rgba(255,255,255,0.06)", color: etape === e.n ? "white" : etape > e.n ? "#25D366" : "#6b7280" }}>
                  {etape > e.n ? "✓" : e.n}
                </div>
                <span className="text-xs font-semibold hidden sm:block"
                  style={{ color: etape === e.n ? "white" : etape > e.n ? "#25D366" : "#4b5563" }}>
                  {e.label}
                </span>
              </button>
              {i < 2 && <div className="flex-1 h-px mx-3" style={{ background: etape > e.n ? "rgba(37,211,102,0.3)" : "rgba(255,255,255,0.06)" }} />}
            </div>
          ))}
        </div>

        {/* Contenu par étape */}
        <div className="px-6 pb-6 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* ── ÉTAPE 1 : Créer l'app Meta ── */}
          {etape === 1 && (
            <div className="space-y-3 pt-2">
              <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Step n="1" text="Allez sur" link="https://developers.facebook.com" linkLabel="developers.facebook.com" />
                <Step n="2" text="Cliquez sur" bold="Mes apps → Créer une app" />
                <Step n="3" text="Choisissez le type" bold="Entreprise" />
                <Step n="4" text="Nommez votre app et cliquez" bold="Créer une app" />
                <Step n="5" text="Dans le tableau de bord, trouvez" bold="WhatsApp" text2="et cliquez" bold2="Configurer" />
                <Step n="6" text="Ajoutez un numéro de téléphone de test ou votre numéro Business vérifié" />
              </div>
              <div className="rounded-xl p-3 flex gap-3" style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.15)" }}>
                <Lightbulb size={18} className="text-[#F5A623] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  Pour un usage en production, votre compte WhatsApp doit être un <span className="text-white font-medium">compte Business vérifié par Meta</span>. Le numéro de test gratuit est suffisant pour commencer.
                </p>
              </div>
              <button onClick={() => setEtape(2)} className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all" style={{ background: "#25D366" }}>
                Étape suivante →
              </button>
            </div>
          )}

          {/* ── ÉTAPE 2 : Configurer le webhook ── */}
          {etape === 2 && (
            <div className="space-y-4 pt-2">
              <p className="text-gray-400 text-sm">Dans votre app Meta, allez dans <span className="text-white font-semibold">WhatsApp → Configuration → Webhooks</span> et entrez ces valeurs :</p>

              <CopyBox label="URL de rappel (Callback URL)" value={WEBHOOK_URL} />
              <CopyBox label="Token de vérification (Verify Token)" value={WEBHOOK_TOKEN} />

              <div className="rounded-xl p-4 space-y-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ensuite</p>
                <Step n="1" text="Cliquez" bold="Vérifier et enregistrer" text2="— Meta appellera automatiquement l'URL ci-dessus" />
                <Step n="2" text="Dans la liste des champs, activez l'abonnement" bold="messages" />
                <Step n="3" text="Cliquez" bold="S'abonner" />
              </div>

              <div className="rounded-xl p-3 flex gap-3" style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.15)" }}>
                <CheckCircle2 size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400 leading-relaxed">
                  Une fois vérifié, Axso recevra automatiquement tous vos messages WhatsApp entrants et les routera vers votre dashboard.
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setEtape(1)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/6 transition-all border border-white/8">
                  ← Retour
                </button>
                <button onClick={() => setEtape(3)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all" style={{ background: "#25D366" }}>
                  Webhook configuré →
                </button>
              </div>
            </div>
          )}

          {/* ── ÉTAPE 3 : Connecter les clés ── */}
          {etape === 3 && (
            <div className="space-y-4 pt-2">
              <p className="text-gray-400 text-sm">Dans votre app Meta, allez dans <span className="text-white font-semibold">WhatsApp → Configuration API</span> pour trouver ces deux valeurs :</p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Phone Number ID
                    <span className="normal-case font-normal text-gray-600 ml-2">— trouvé dans "Numéros de téléphone"</span>
                  </label>
                  <input value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))}
                    placeholder="123456789012345"
                    className="w-full rounded-xl px-4 py-3 text-white text-sm font-mono focus:outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${form.phone_number_id ? "rgba(37,211,102,0.4)" : "rgba(255,255,255,0.1)"}` }} />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Token d'accès permanent
                    <span className="normal-case font-normal text-gray-600 ml-2">— générez-le dans Paramètres système</span>
                  </label>
                  <div className="relative">
                    <input value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
                      type={showToken ? "text" : "password"}
                      placeholder="EAAxxxxxxxxxxxxxxxxxx"
                      className="w-full rounded-xl px-4 py-3 pr-20 text-white text-sm font-mono focus:outline-none transition-all"
                      style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${form.access_token ? "rgba(37,211,102,0.4)" : "rgba(255,255,255,0.1)"}` }} />
                    <button onClick={() => setShowToken(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white px-2 py-1 rounded-lg transition-all"
                      style={{ background: "rgba(255,255,255,0.06)" }}>
                      {showToken ? "Masquer" : "Voir"}
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-1 ml-1">⚠️ Utilisez un token permanent (non expirant) — pas le token temporaire de 24h</p>
                </div>
              </div>

              <div className="rounded-xl p-3 flex gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Lock size={18} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500 leading-relaxed">
                  Vos clés sont chiffrées et stockées uniquement sur votre compte Axso. Elles ne sont jamais partagées.
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setEtape(2)} className="flex-shrink-0 py-2.5 px-4 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/6 transition-all border border-white/8">
                  ← Retour
                </button>
                <button onClick={connecter} disabled={loading || !form.phone_number_id || !form.access_token}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 transition-all"
                  style={{ background: "#25D366", boxShadow: "0 4px 20px rgba(37,211,102,0.25)" }}>
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Vérification en cours…</> : <><Wifi size={15} /> Tester et connecter</>}
                </button>
              </div>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function Step({ n, text, bold, text2, bold2, link, linkLabel }: { n: string; text?: string; bold?: string; text2?: string; bold2?: string; link?: string; linkLabel?: string }) {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
        style={{ background: "rgba(37,211,102,0.15)", color: "#25D366" }}>{n}</div>
      <p className="text-sm text-gray-400 leading-relaxed">
        {text}{" "}
        {link && <a href={link} target="_blank" rel="noopener noreferrer" className="text-white font-mono underline hover:text-[#25D366] transition-colors">{linkLabel}</a>}
        {bold && <span className="text-white font-semibold">{bold}</span>}
        {text2 && " " + text2 + " "}
        {bold2 && <span className="text-white font-semibold">{bold2}</span>}
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WhatsAppPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contactActif, setContactActif] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [commandes, setCommandes] = useState<Commande[]>([]);
  const [input, setInput] = useState("");
  const [recherche, setRecherche] = useState("");
  const [loading, setLoading] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [waConfig, setWaConfig] = useState<WaConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [slug, setSlug] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [locked, setLocked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const contactActifRef = useRef<string | null>(null);

  const connecte = waConfig?.statut === "actif";
  const totalNonLus = conversations.reduce((s, c) => s + (c.nonLus || 0), 0);

  // Charger config + conversations + slug
  useEffect(() => {
    Promise.all([
      fetch("/api/connecteurs/whatsapp").then(r => r.json()),
      fetch("/api/connecteurs/whatsapp-genuka").then(r => r.json()),
      fetch("/api/messages/whatsapp").then(r => r.json()),
      fetch("/api/tenants/moi").then(r => r.json()),
    ]).then(([cfgMeta, cfgGenuka, conv, tenant]) => {
      // Genuka (simple) prioritaire à l'affichage si les deux sont actifs —
      // c'est le chemin qu'on met en avant pour les nouvelles connexions.
      if (cfgGenuka.config?.statut === "actif") {
        setWaConfig({ statut: "actif", via: "genuka", config: null });
      } else if (cfgMeta.config?.statut === "actif") {
        setWaConfig({ statut: "actif", via: "meta", config: cfgMeta.config.config });
      } else {
        setWaConfig(null);
      }
      setConversations(conv.conversations ?? []);
      setLocked(!!conv.locked);
      setSlug(tenant.tenant?.slug ?? "");
      setTenantId(tenant.tenant?.id ?? "");
      setLoading(false);
    });
  }, []);

  // Polling conversations toutes les 15s
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/messages/whatsapp").then(r => r.json()).then(d => {
        setConversations(d.conversations ?? []);
        setLocked(!!d.locked);
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Charger thread quand on change de contact
  const chargerThread = useCallback(async (contact: string) => {
    const d = await fetch(`/api/messages/whatsapp?contact=${encodeURIComponent(contact)}`).then(r => r.json());
    setMessages(d.messages ?? []);
    setCommandes(d.commandes ?? []);
    setConversations(prev => prev.map(c => c.de === contact ? { ...c, lu: true, nonLus: 0 } : c));
  }, []);

  useEffect(() => {
    contactActifRef.current = contactActif;
    if (!contactActif) return;
    chargerThread(contactActif);
  }, [contactActif, chargerThread]);

  // Polling thread actif toutes les 10s
  useEffect(() => {
    pollRef.current && clearInterval(pollRef.current);
    if (!contactActif) return;
    pollRef.current = setInterval(() => {
      if (contactActifRef.current) chargerThread(contactActifRef.current);
    }, 10000);
    return () => { pollRef.current && clearInterval(pollRef.current); };
  }, [contactActif, chargerThread]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function envoyer(texte?: string) {
    const corps = (texte ?? input).trim();
    if (!corps || !contactActif || envoi) return;
    setEnvoi(true);
    setShowTemplates(false);
    try {
      const res = await fetch("/api/messages/whatsapp/envoyer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: contactActif, message: corps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(), de: contactActif, nom: null,
        corps, lu: true, direction: "sortant", commandeId: null,
        createdAt: new Date().toISOString(),
      }]);
      if (!texte) setInput("");
      setConversations(prev => prev.map(c =>
        c.de === contactActif ? { ...c, dernier: corps, updatedAt: new Date().toISOString() } : c
      ));
    } catch (e: any) { toast.error(e.message || "Erreur envoi"); }
    finally { setEnvoi(false); }
  }

  async function envoyerTracking(cmd: Commande) {
    if (!cmd.trackingToken) return;
    const url = `${window.location.origin}/${slug}/tracking/${cmd.trackingToken}`;
    const msg = `🚚 Suivez votre commande #${cmd.numero} en temps réel :\n${url}`;
    await envoyer(msg);
    toast.success("Lien de tracking envoyé !");
  }

  async function envoyerFacture(cmd: Commande) {
    if (!cmd.trackingToken) return;
    const url = `${window.location.origin}/${slug}/facture/${cmd.trackingToken}`;
    const msg = `📄 Voici votre facture pour la commande #${cmd.numero} :\n${url}`;
    await envoyer(msg);
    toast.success("Facture envoyée !");
  }

  async function confirmerCommande(commandeId: string, numero: string) {
    const res = await fetch(`/api/commandes/${commandeId}/statut`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut: "confirmee" }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`Commande #${numero} confirmée ✅`);
      setCommandes(prev => prev.map(c => c.id === commandeId ? { ...c, statut: "confirmee" } : c));
      if (data.whatsappUrl) window.open(data.whatsappUrl, "_blank");
    } else { toast.error(data.error || "Erreur"); }
  }

  const convsFiltrees = conversations.filter(c =>
    !recherche || (c.nom ?? c.de).toLowerCase().includes(recherche.toLowerCase()) || c.de.includes(recherche)
  );
  const convActuelle = conversations.find(c => c.de === contactActif);

  if (!loading && locked) {
    return (
      <UpgradeGate
        titre="WhatsApp verrouillé — quota de commandes atteint"
        description="Vous avez atteint votre quota de 30 commandes ce mois-ci au Palier 0. Passez à un palier supérieur pour retrouver l'accès à WhatsApp — envoi et réception de messages."
        palierRequis="palier1"
      />
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] rounded-2xl overflow-hidden border border-white/5" style={{ background: "#0d1117" }}>
      <ModuleTutorial moduleKey="whatsapp" titre="WhatsApp" sousTitre="Vends et discute via WhatsApp" steps={WHATSAPP_TUTORIAL_STEPS} />

      {/* ── GAUCHE : Conversations ── */}
      <div className={`${mobileThread ? "hidden" : "flex"} lg:flex flex-col border-r border-white/8 flex-shrink-0`} style={{ width: 320 }}>
        {/* Header */}
        <div className="p-4 border-b border-white/8 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#25D366" }}>
                <MessageCircle size={17} className="text-white" />
              </div>
              <div>
                <div className="font-bold text-white text-sm leading-tight flex items-center gap-1.5">
                  WhatsApp Business
                  <BoutonRevoirTutoriel moduleKey="whatsapp" dark />
                </div>
                {connecte && waConfig?.via === "meta" && waConfig?.config?.numero_affiche && (
                  <div className="text-[10px] text-gray-500 font-mono">{waConfig.config.numero_affiche}</div>
                )}
                {connecte && waConfig?.via === "genuka" && (
                  <div className="text-[10px] text-gray-500">via Genuka</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {totalNonLus > 0 && (
                <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ background: "#25D366" }}>
                  <Bell size={9} /> {totalNonLus}
                </div>
              )}
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-semibold ${connecte ? "text-[#25D366]" : "text-red-400"}`}
                style={{ background: connecte ? "rgba(37,211,102,0.12)" : "rgba(239,68,68,0.12)" }}>
                {connecte ? <Wifi size={9} /> : <WifiOff size={9} />}
                {connecte ? "Actif" : "Hors ligne"}
              </div>
              <button onClick={() => setShowConfig(true)} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8 transition-all">
                <Settings size={13} />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
            <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher…"
              className="w-full bg-white/5 border border-white/8 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#25D366]/40" />
          </div>
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-600">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : convsFiltrees.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)" }}>
                <MessageCircle size={24} style={{ color: "#25D366" }} />
              </div>
              <p className="text-gray-500 text-sm font-medium">Aucune conversation</p>
              {!connecte && (
                <button onClick={() => setShowConfig(true)} className="text-xs hover:underline" style={{ color: "#25D366" }}>
                  Connecter WhatsApp Business →
                </button>
              )}
            </div>
          ) : convsFiltrees.map(conv => {
            const actif = conv.de === contactActif;
            return (
              <button key={conv.de}
                onClick={() => { setContactActif(conv.de); setMobileThread(true); }}
                className="w-full flex items-start gap-3 px-4 py-3.5 border-b border-white/4 text-left transition-all hover:bg-white/4"
                style={{ borderLeft: actif ? "2px solid #25D366" : "2px solid transparent", background: actif ? "rgba(37,211,102,0.06)" : undefined }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                  style={{ background: avatarColor(conv.de) }}>
                  {initiales(conv.nom, conv.de)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-semibold text-sm text-white truncate">{conv.nom ?? conv.de}</p>
                    <span className="text-[10px] text-gray-600 flex-shrink-0 ml-2">{heure(conv.updatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-600 truncate">{conv.dernier}</p>
                    {conv.nonLus > 0 && (
                      <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1" style={{ background: "#25D366" }}>
                        {conv.nonLus}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── CENTRE : Thread ── */}
      <div className={`${!mobileThread ? "hidden" : "flex"} lg:flex flex-1 flex-col min-w-0`}>
        {contactActif && convActuelle ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-3" style={{ background: "rgba(17,24,39,0.7)" }}>
              <button onClick={() => setMobileThread(false)} className="lg:hidden w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-white">
                <ArrowLeft size={16} />
              </button>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: avatarColor(contactActif) }}>
                {initiales(convActuelle.nom, contactActif)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm leading-tight">{convActuelle.nom ?? contactActif}</p>
                <p className="text-[10px] text-gray-500 font-mono">{contactActif}</p>
              </div>
              <div className="flex items-center gap-2">
                {commandes.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1" style={{ color: "#F5A623", background: "rgba(245,166,35,0.12)" }}>
                    <ShoppingBag size={10} /> {commandes.length} cmd
                  </span>
                )}
                <a href={`tel:${contactActif}`} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8 transition-all">
                  <Phone size={13} />
                </a>
                <button onClick={() => chargerThread(contactActif)} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8 transition-all">
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5" style={{ background: "#0d1117" }}>
              {messages.map((msg, i) => {
                const sortant = msg.direction === "sortant";
                const showDate = i === 0 || new Date(messages[i - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex items-center justify-center my-3">
                        <span className="text-[10px] text-gray-600 px-3 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
                          {new Date(msg.createdAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                        </span>
                      </div>
                    )}
                    <div className={`flex ${sortant ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[72%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                        style={{
                          background: sortant ? "#25D366" : "#1f2937",
                          borderBottomRightRadius: sortant ? 4 : undefined,
                          borderBottomLeftRadius: !sortant ? 4 : undefined,
                          boxShadow: sortant ? "0 2px 8px rgba(37,211,102,0.18)" : "0 2px 8px rgba(0,0,0,0.25)",
                          color: "white",
                        }}>
                        <p className="whitespace-pre-wrap">{msg.corps}</p>
                        <div className={`flex items-center gap-1 mt-1 ${sortant ? "justify-end" : ""}`}>
                          <span className="text-[10px] opacity-50">{new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                          {sortant && (msg.lu ? <CheckCheck size={11} className="opacity-70" /> : <Check size={11} className="opacity-40" />)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Templates réponse rapide */}
            {showTemplates && (
              <div className="border-t border-white/8 p-3" style={{ background: "#111827" }}>
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={11} style={{ color: "#F5A623" }} />
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Réponses rapides</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map((t, i) => (
                    <button key={i} onClick={() => envoyer(t.text)}
                      className="text-xs px-3 py-1.5 rounded-xl font-semibold transition-all hover:opacity-80"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#d1d5db" }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-white/8" style={{ background: "rgba(17,24,39,0.9)" }}>
              {!connecte ? (
                <div className="text-center py-3">
                  <p className="text-gray-500 text-sm">WhatsApp Business non connecté</p>
                  <button onClick={() => setShowConfig(true)} className="text-xs hover:underline mt-1" style={{ color: "#25D366" }}>
                    Connecter maintenant →
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  <button onClick={() => setShowTemplates(s => !s)}
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
                    style={{ background: showTemplates ? "rgba(245,166,35,0.2)" : "rgba(255,255,255,0.06)", color: showTemplates ? "#F5A623" : "#6b7280" }}>
                    <Zap size={14} />
                  </button>
                  <textarea value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
                    placeholder="Tapez votre message… (Entrée pour envoyer)"
                    rows={1}
                    className="flex-1 border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none resize-none"
                    style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", maxHeight: 120 }}
                    onFocus={e => (e.target.style.borderColor = "rgba(37,211,102,0.4)")}
                    onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.1)")}
                  />
                  <button onClick={() => envoyer()} disabled={!input.trim() || envoi}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:opacity-90 disabled:opacity-40 flex-shrink-0"
                    style={{ background: "#25D366", boxShadow: "0 3px 12px rgba(37,211,102,0.3)" }}>
                    {envoi ? <Loader2 size={15} className="animate-spin text-white" /> : <Send size={15} className="text-white" />}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4 max-w-xs">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto" style={{ background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.2)" }}>
                <MessageCircle size={36} style={{ color: "#25D366" }} />
              </div>
              <div>
                <p className="text-white font-semibold text-lg">WhatsApp Business</p>
                <p className="text-gray-600 text-sm mt-1">Sélectionnez une conversation ou attendez un message client</p>
              </div>
              {!connecte && (
                <button onClick={() => setShowConfig(true)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-2 mx-auto hover:opacity-90 transition-all"
                  style={{ background: "#25D366", boxShadow: "0 4px 16px rgba(37,211,102,0.3)" }}>
                  <Wifi size={14} /> Connecter WhatsApp Business
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── DROIT : Commandes du contact ── */}
      {contactActif && (
        <div className="hidden xl:flex flex-col border-l border-white/8 flex-shrink-0 overflow-y-auto" style={{ width: 280, background: "#0d1117" }}>
          <div className="p-4 border-b border-white/8">
            <p className="text-white font-semibold text-sm flex items-center gap-2">
              <ShoppingBag size={13} style={{ color: "#F5A623" }} />
              Commandes liées
              {commandes.length > 0 && <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(245,166,35,0.15)", color: "#F5A623" }}>{commandes.length}</span>}
            </p>
          </div>

          {commandes.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
              <ShoppingBag size={28} className="text-gray-800 mb-3" />
              <p className="text-gray-600 text-xs">Aucune commande liée à ce contact</p>
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {commandes.map(cmd => {
                const s = STATUT_LABEL[cmd.statut] ?? { label: cmd.statut, color: "#9ca3af", icon: Clock };
                const Icon = s.icon;
                return (
                  <div key={cmd.id} className="rounded-xl p-3 space-y-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-white font-bold">#{cmd.numero}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ color: s.color, background: `${s.color}18` }}>
                        <Icon size={9} />{s.label}
                      </span>
                    </div>
                    {cmd.lignes.slice(0, 2).map((l, i) => (
                      <p key={i} className="text-xs text-gray-500 truncate">{l.nom} ×{l.quantite}</p>
                    ))}
                    <div className="text-xs font-bold" style={{ color: "#F5A623" }}>
                      {cmd.montantTotal.toLocaleString("fr-FR")} {cmd.devise}
                    </div>

                    {/* Actions */}
                    <div className="space-y-1.5 pt-1 border-t border-white/6">
                      {cmd.statut === "en_attente" && (
                        <button onClick={() => confirmerCommande(cmd.id, cmd.numero)}
                          className="w-full text-[11px] py-1.5 rounded-lg font-bold text-white flex items-center justify-center gap-1.5 hover:opacity-90 transition-all"
                          style={{ background: "#25D366" }}>
                          <CheckCircle2 size={11} /> Confirmer
                        </button>
                      )}
                      {cmd.trackingToken && (
                        <button onClick={() => envoyerTracking(cmd)}
                          className="w-full text-[11px] py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 hover:bg-white/8 transition-all"
                          style={{ color: "#60a5fa", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.15)" }}>
                          <MapPin size={10} /> Envoyer tracking
                        </button>
                      )}
                      {cmd.trackingToken && (
                        <button onClick={() => envoyerFacture(cmd)}
                          className="w-full text-[11px] py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 hover:bg-white/8 transition-all"
                          style={{ color: "#FFD280", background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>
                          <FileText size={10} /> Envoyer facture
                        </button>
                      )}
                      <button onClick={() => router.push(`/dashboard/commandes/${cmd.id}`)}
                        className="w-full text-[11px] py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 hover:bg-white/8 transition-all"
                        style={{ color: "#9ca3af", border: "1px solid rgba(255,255,255,0.08)" }}>
                        Voir la commande →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Auto-confirm tip */}
          <div className="m-3 mt-auto p-3 rounded-xl" style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.15)" }}>
            <p className="text-xs font-semibold flex items-center gap-1.5 mb-1" style={{ color: "#25D366" }}>
              <Zap size={10} /> Confirmation auto
            </p>
            <p className="text-gray-600 text-xs leading-relaxed">
              Si le client répond <span className="font-mono text-white">"OUI"</span>, <span className="font-mono text-white">"CONFIRMER"</span> ou <span className="font-mono text-white">"OK"</span>, la commande se confirme automatiquement.
            </p>
          </div>
        </div>
      )}

      {showConfig && (
        <ConfigPanel tenantId={tenantId} onClose={() => setShowConfig(false)} onConnecte={cfg => { setWaConfig(cfg); setShowConfig(false); }} />
      )}
    </div>
  );
}
