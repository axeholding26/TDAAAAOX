"use client";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, Loader2, LogOut, ChevronDown, ChevronUp,
  Code2, Info, Target, Music2, Ghost, Blocks, Eye, EyeOff, Zap,
  type LucideIcon,
} from "lucide-react";

interface TenantTracking {
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  snapPixelId: string | null;
  gtmId: string | null;
  trackingScripts: string | null;
}

async function patchTenant(champs: Record<string, any>) {
  const res = await fetch("/api/tenants", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(champs),
  });
  if (!res.ok) throw new Error("Sauvegarde échouée");
}

type PlatformKey = "metaPixelId" | "tiktokPixelId" | "snapPixelId" | "gtmId";

interface Platform {
  key: PlatformKey;
  nom: string;
  sousTitre: string;
  couleur: string;
  couleurDark: string;
  bg: string;
  border: string;
  Icone: LucideIcon;
  placeholder: string;
  guide: string[];
  events: string[];
}

const PLATFORMS: Platform[] = [
  {
    key: "metaPixelId",
    nom: "Meta Pixel",
    sousTitre: "Facebook · Instagram · Messenger",
    couleur: "#1877F2",
    couleurDark: "#0D5FD8",
    bg: "rgba(24,119,242,0.07)",
    border: "rgba(24,119,242,0.22)",
    Icone: Target,
    placeholder: "1234567890123456",
    guide: [
      "Ouvrez Meta Business Suite et accédez au Gestionnaire d'événements",
      "Cliquez sur Sources de données → sélectionnez votre Pixel",
      "Onglet Détails — copiez l'ID à 15-16 chiffres",
    ],
    events: ["PageView", "InitiateCheckout", "Purchase"],
  },
  {
    key: "tiktokPixelId",
    nom: "TikTok Pixel",
    sousTitre: "TikTok for Business · Ads Manager",
    couleur: "#FE2C55",
    couleurDark: "#D41A42",
    bg: "rgba(254,44,85,0.06)",
    border: "rgba(254,44,85,0.2)",
    Icone: Music2,
    placeholder: "C4A1B2C3D4E5F6G7H8I9",
    guide: [
      "Accédez à TikTok Ads Manager → Actifs → Événements",
      "Cliquez sur Web Events et sélectionnez votre Pixel",
      "Copiez l'ID depuis la section Détails de configuration",
    ],
    events: ["PageView", "InitiateCheckout", "CompletePayment"],
  },
  {
    key: "snapPixelId",
    nom: "Snapchat Pixel",
    sousTitre: "Snap Ads Manager · Conversions",
    couleur: "#FFCB05",
    couleurDark: "#D4A800",
    bg: "rgba(255,203,5,0.07)",
    border: "rgba(255,203,5,0.35)",
    Icone: Ghost,
    placeholder: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    guide: [
      "Accédez à Snapchat Ads Manager → Événements",
      "Cliquez Gérer les sources → sélectionnez votre Pixel",
      "Copiez l'UUID affiché dans les paramètres du Pixel",
    ],
    events: ["PAGE_VIEW", "START_CHECKOUT", "PURCHASE"],
  },
  {
    key: "gtmId",
    nom: "Google Tag Manager",
    sousTitre: "GA4 · Google Ads · tous vos tags",
    couleur: "#4285F4",
    couleurDark: "#1A73E8",
    bg: "rgba(66,133,244,0.07)",
    border: "rgba(66,133,244,0.22)",
    Icone: Blocks,
    placeholder: "GTM-XXXXXXX",
    guide: [
      "Accédez à tagmanager.google.com",
      "Sélectionnez votre espace de travail",
      "L'ID GTM-XXXXXXX s'affiche en haut à droite — copiez-le",
    ],
    events: ["page_view", "initiate_checkout", "purchase"],
  },
];

// ─── Event badge ─────────────────────────────────────────────────────────────
function EventBadge({ label, color, active }: { label: string; color: string; active: boolean }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
      style={{
        background: active ? `${color}14` : "#F3F3F3",
        color: active ? color : "#AAAAAA",
        border: `1px solid ${active ? color + "30" : "#E8E8E8"}`,
      }}
    >
      {label}
    </span>
  );
}

// ─── Platform card ────────────────────────────────────────────────────────────
function PlatformCard({
  platform,
  valeurInitiale,
  onSaved,
}: {
  platform: Platform;
  valeurInitiale: string | null;
  onSaved: (v: string | null) => void;
}) {
  const { key, nom, sousTitre, couleur, couleurDark, bg, border, Icone, placeholder, guide, events } = platform;

  const [valeur, setValeur]   = useState(valeurInitiale ?? "");
  const [saved, setSaved]     = useState<string | null>(valeurInitiale);
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setValeur(valeurInitiale ?? "");
    setSaved(valeurInitiale);
  }, [valeurInitiale]);

  const isActif = Boolean(saved);

  const maskedId = saved
    ? saved.length > 8
      ? `${saved.slice(0, 4)}••••••••${saved.slice(-4)}`
      : "••••••••"
    : null;

  async function sauvegarder() {
    setSaving(true);
    try {
      const v = valeur.trim() || null;
      await patchTenant({ [key]: v });
      setSaved(v);
      setOpen(false);
      onSaved(v);
      toast.success(v ? `${nom} activé avec succès !` : `${nom} retiré`);
    } catch {
      toast.error("Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function retirer() {
    try {
      await patchTenant({ [key]: null });
      setValeur("");
      setSaved(null);
      setOpen(false);
      onSaved(null);
      toast.success(`${nom} désactivé`);
    } catch {
      toast.error("Erreur");
    }
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        border: isActif ? `1.5px solid ${border}` : "1.5px solid #EBEBEB",
        boxShadow: isActif
          ? `0 2px 16px ${couleur}10, 0 0 0 1px ${couleur}08`
          : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Colored accent bar at top */}
      <div
        className="h-[3px] w-full transition-all duration-500"
        style={{
          background: isActif
            ? `linear-gradient(90deg, ${couleur}, ${couleurDark})`
            : "transparent",
        }}
      />

      {/* Main card body */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Platform icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
            style={{
              background: isActif ? bg : "#F5F5F5",
              border: `1px solid ${isActif ? border : "#E8E8E8"}`,
            }}
          >
            <Icone size={19} style={{ color: isActif ? couleur : "#BBBBBB" }} />
          </div>

          {/* Name + subtitle + badge */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[#111111] text-sm">{nom}</span>
              {isActif ? (
                <span
                  className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: `${couleur}12`,
                    color: couleur,
                    border: `1px solid ${couleur}28`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: couleur }}
                  />
                  Actif
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-0.5 rounded-full">
                  Non configuré
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{sousTitre}</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isActif && (
              <button
                onClick={retirer}
                title="Désactiver"
                className="p-2 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all"
              >
                <LogOut size={13} />
              </button>
            )}
            <button
              onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
              style={
                isActif
                  ? { background: bg, borderColor: border, color: couleur }
                  : { background: "#F5F5F5", borderColor: "#E0E0E0", color: "#555" }
              }
            >
              {open ? "Fermer" : isActif ? "Modifier" : "Configurer"}
              {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>
        </div>

        {/* Events tracked */}
        <div className="flex items-center gap-1.5 mt-3.5 flex-wrap">
          <span className="text-[10px] text-gray-400 font-semibold mr-0.5 uppercase tracking-wide">
            Événements :
          </span>
          {events.map(e => (
            <EventBadge key={e} label={e} color={couleur} active={isActif} />
          ))}
        </div>

        {/* Active ID preview (when closed) */}
        {isActif && !open && (
          <div
            className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl"
            style={{ background: bg, border: `1px solid ${border}` }}
          >
            <code
              className="text-xs font-mono flex-1 truncate"
              style={{ color: couleur }}
            >
              {visible ? saved : maskedId}
            </code>
            <button
              onClick={() => setVisible(v => !v)}
              className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity"
            >
              {visible
                ? <EyeOff size={12} style={{ color: couleur }} />
                : <Eye size={12} style={{ color: couleur }} />}
            </button>
            <CheckCircle2 size={13} style={{ color: couleur }} className="flex-shrink-0" />
          </div>
        )}
      </div>

      {/* Expanded configuration panel */}
      {open && (
        <div
          className="border-t px-5 pb-5 pt-5 space-y-5"
          style={{ borderColor: "#F0F0F0", background: "#FAFAFA" }}
        >
          {/* Step-by-step guide */}
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-3">
              Guide de configuration
            </p>
            <ol className="space-y-2.5">
              {guide.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 mt-0.5"
                    style={{
                      background: `${couleur}14`,
                      color: couleur,
                      border: `1px solid ${couleur}28`,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-xs text-gray-600 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Input */}
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2 block">
              Identifiant du pixel
            </label>
            <div className="relative">
              <input
                value={valeur}
                onChange={e => setValeur(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-3 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 transition-all bg-white"
                style={{
                  borderColor: valeur.trim() ? couleur + "55" : "#E0E0E0",
                  ["--tw-ring-color" as any]: `${couleur}35`,
                  color: "#111",
                }}
              />
              {valeur.trim() && (
                <CheckCircle2
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: couleur }}
                />
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              onClick={sauvegarder}
              disabled={saving || !valeur.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40"
              style={{
                background:
                  saving || !valeur.trim()
                    ? "#CCCCCC"
                    : `linear-gradient(135deg, ${couleur} 0%, ${couleurDark} 100%)`,
              }}
            >
              {saving
                ? <><Loader2 size={13} className="animate-spin" /> Activation…</>
                : <><Zap size={13} /> Activer le pixel</>}
            </button>
            {saved && (
              <button
                onClick={retirer}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-red-200 text-red-400 hover:bg-red-50 transition-all"
              >
                Retirer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom scripts card ──────────────────────────────────────────────────────
function CustomScriptsCard({ valeurInitiale }: { valeurInitiale: string | null }) {
  const [script, setScript] = useState(valeurInitiale ?? "");
  const [saved, setSaved]   = useState<string | null>(valeurInitiale);
  const [saving, setSaving] = useState(false);
  const [open, setOpen]     = useState(!!valeurInitiale);

  useEffect(() => {
    setScript(valeurInitiale ?? "");
    setSaved(valeurInitiale);
  }, [valeurInitiale]);

  async function sauvegarder() {
    setSaving(true);
    try {
      const v = script.trim() || null;
      await patchTenant({ trackingScripts: v });
      setSaved(v);
      toast.success("Scripts personnalisés enregistrés !");
    } catch {
      toast.error("Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  const isActif = Boolean(saved);

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        border: isActif ? "1.5px solid rgba(27,42,74,0.2)" : "1.5px solid #EBEBEB",
        boxShadow: isActif
          ? "0 2px 16px rgba(27,42,74,0.08)"
          : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="h-[3px] w-full transition-all duration-500"
        style={{
          background: isActif
            ? "linear-gradient(90deg, #1B2A4A, #2D4472)"
            : "transparent",
        }}
      />

      <div className="p-5">
        <div className="flex items-center gap-4">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: isActif ? "rgba(27,42,74,0.08)" : "#F5F5F5",
              border: isActif ? "1px solid rgba(27,42,74,0.18)" : "1px solid #E8E8E8",
            }}
          >
            <Code2 size={19} style={{ color: isActif ? "#1B2A4A" : "#BBBBBB" }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#111111] text-sm">Scripts personnalisés</span>
              {isActif ? (
                <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gray-900/5 text-gray-700 border border-gray-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                  Actif
                </span>
              ) : (
                <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-100 px-2.5 py-0.5 rounded-full">
                  Non configuré
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">Hotjar, Clarity, Pinterest Tag, ou tout autre script tiers</p>
          </div>

          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#E0E0E0] bg-[#F5F5F5] text-[#555] hover:bg-gray-100 transition-all flex-shrink-0"
          >
            {open ? "Fermer" : isActif ? "Modifier" : "Configurer"}
            {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {open && (
        <div
          className="border-t px-5 pb-5 pt-5 space-y-4"
          style={{ borderColor: "#F0F0F0", background: "#FAFAFA" }}
        >
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mb-2 block">
              Code de suivi (balises &lt;script&gt;)
            </label>
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              rows={7}
              placeholder={"<script>\n  // Collez ici le code fourni par votre outil de suivi\n</script>"}
              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none resize-none transition-all"
            />
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 flex gap-2.5">
            <Info size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Ce code s'exécute sur votre boutique publique. Vérifiez toujours la source avant de coller un script fourni par un tiers.
            </p>
          </div>

          <button
            onClick={sauvegarder}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #1B2A4A 0%, #2D4472 100%)" }}
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Sauvegarde…</>
              : <><Zap size={13} /> Enregistrer</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TrackingPage() {
  const [tenant, setTenant] = useState<TenantTracking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenants/moi-complet")
      .then(r => r.json())
      .then(d => { setTenant(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const actifs = tenant
    ? [tenant.metaPixelId, tenant.tiktokPixelId, tenant.snapPixelId, tenant.gtmId].filter(Boolean).length
    : 0;

  if (loading) {
    return (
      <div className="space-y-3 max-w-3xl">
        <div className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden p-6"
        style={{ background: "linear-gradient(135deg, #0F0F0F 0%, #1B2A4A 100%)" }}
      >
        {/* Subtle dot pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-[#F5A623] uppercase tracking-[0.25em] mb-1.5">
              Module marketing
            </p>
            <h1 className="text-xl font-black text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
              Tracking & Pixels
            </h1>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
              Vos pixels se chargent automatiquement sur votre boutique à chaque visite.
            </p>
          </div>

          <div className="flex-shrink-0 text-right">
            <div
              className="text-4xl font-black"
              style={{
                fontFamily: "Poppins, sans-serif",
                background: actifs > 0
                  ? "linear-gradient(135deg, #F5A623, #FFCC70)"
                  : "none",
                WebkitBackgroundClip: actifs > 0 ? "text" : undefined,
                WebkitTextFillColor: actifs > 0 ? "transparent" : "#4B4B4B",
                color: actifs > 0 ? undefined : "#4B4B4B",
              }}
            >
              {actifs}<span className="text-2xl text-gray-600 font-medium">/4</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
              {actifs === 0 ? "Aucun pixel actif" : actifs === 4 ? "Tous actifs" : `pixel${actifs > 1 ? "s" : ""} actif${actifs > 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mt-5">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${(actifs / 4) * 100}%`,
                  background: actifs > 0 ? "linear-gradient(90deg, #F5A623, #FFB347)" : "transparent",
                }}
              />
            </div>
            <span className="text-[11px] text-gray-500 font-mono flex-shrink-0">
              {Math.round((actifs / 4) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Platform cards ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {PLATFORMS.map(p => (
          <PlatformCard
            key={p.key}
            platform={p}
            valeurInitiale={tenant?.[p.key] ?? null}
            onSaved={v => setTenant(t => t && { ...t, [p.key]: v })}
          />
        ))}
      </div>

      {/* ── Custom scripts ───────────────────────────────────────────────────── */}
      <CustomScriptsCard valeurInitiale={tenant?.trackingScripts ?? null} />

      {/* ── Info note ────────────────────────────────────────────────────────── */}
      <div className="rounded-xl bg-[#F5A623]/8 border border-[#F5A623]/25 p-4 flex gap-3">
        <Info size={14} className="text-[#D4911A] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[#666666] leading-relaxed">
          Chaque pixel activé est injecté automatiquement sur votre boutique publique et transmet les événements{" "}
          <strong>PageView</strong>, <strong>InitiateCheckout</strong> et <strong>Purchase</strong> à chaque commande — sans aucune configuration supplémentaire côté Axso.
        </p>
      </div>
    </div>
  );
}
