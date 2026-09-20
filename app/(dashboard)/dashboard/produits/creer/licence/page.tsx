"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Key, Settings, RefreshCw, Check, Upload } from "lucide-react";
import Link from "next/link";
import ClesLicenceManager from "@/components/dashboard/ClesLicenceManager";

type Etape = 1 | 2 | 3 | 4;

interface Infos {
  nom: string;
  description: string;
  prix: string;
  slug: string;
}

interface ConfigLicence {
  modeDistrib: "auto" | "stock";
  formatAuto: "alphanum" | "uuid";
  longueur: number;
  prefixe: string;
  maxActivations: string;
  dureeJours: string;
}

function SlugInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#1B2A4A]">
      <span className="px-3 py-2.5 bg-gray-50 text-gray-400 text-sm border-r border-gray-200 whitespace-nowrap select-none">
        boutique.com/produits/
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
        placeholder="ma-cle-licence"
        className="flex-1 px-3 py-2.5 text-sm bg-white focus:outline-none text-gray-900"
      />
    </div>
  );
}

export default function CreerLicencePage() {
  const router = useRouter();
  const [etape, setEtape] = useState<Etape>(1);
  const [produitId, setProduitId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [infos, setInfos] = useState<Infos>({ nom: "", description: "", prix: "", slug: "" });
  const [config, setConfig] = useState<ConfigLicence>({
    modeDistrib: "auto",
    formatAuto: "alphanum",
    longueur: 16,
    prefixe: "",
    maxActivations: "1",
    dureeJours: "",
  });

  const autoSlug = (nom: string) => nom.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const setNom = (nom: string) => {
    setInfos((p) => ({ ...p, nom, slug: p.slug || autoSlug(nom) }));
  };

  // ─── Étape 1 → 2 ────────────────────────────────────────────────────────────
  const creerProduit = async () => {
    if (!infos.nom || !infos.prix) return;
    setSaving(true);
    const r = await fetch("/api/produits/digitaux", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "licence",
        nom: infos.nom,
        description: infos.description,
        prix: parseFloat(infos.prix),
        slug: infos.slug || autoSlug(infos.nom),
      }),
    });
    const d = await r.json();
    setSaving(false);
    if (!r.ok) { alert(d.error ?? "Erreur"); return; }
    setProduitId(d.produit?.id ?? d.id);
    setEtape(2);
  };

  // ─── Étape 2 → 3 ────────────────────────────────────────────────────────────
  const sauvegarderConfig = async () => {
    if (!produitId) return;
    setSaving(true);
    await fetch(`/api/produits/digitaux/${produitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          modeDistrib: config.modeDistrib,
          formatAuto: config.formatAuto,
          longueur: parseInt(config.longueur as any) || 16,
          prefixe: config.prefixe || null,
          maxActivations: config.maxActivations ? parseInt(config.maxActivations) : null,
          dureeJours: config.dureeJours ? parseInt(config.dureeJours) : null,
        },
      }),
    });
    setSaving(false);
    setEtape(3);
  };

  // ─── Publier ─────────────────────────────────────────────────────────────────
  const publier = async () => {
    if (!produitId) return;
    setPublishing(true);
    await fetch(`/api/produits/digitaux/${produitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: true }),
    });
    setPublishing(false);
    router.push(`/dashboard/produits/${produitId}`);
  };

  const ETAPES = ["Informations", "Configuration", "Clés", "Publication"];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link href="/dashboard/produits/digital/nouveau" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft size={14} /> Retour
      </Link>

      <div className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-xl bg-[#16a34a15] flex items-center justify-center">
          <Key size={18} className="text-[#16a34a]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-poppins">Clé de licence</h1>
          <p className="text-xs text-gray-400">Génération automatique ou stock importé</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {ETAPES.map((label, i) => {
          const n = (i + 1) as Etape;
          const done = etape > n;
          const active = etape === n;
          return (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${done ? "bg-[#16a34a] text-white" : active ? "bg-[#1B2A4A] text-white" : "bg-gray-100 text-gray-400"}`}>
                {done ? <Check size={12} /> : n}
              </div>
              <span className={`text-xs hidden sm:block ${active ? "text-gray-900 font-medium" : "text-gray-400"}`}>{label}</span>
              {i < ETAPES.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
            </div>
          );
        })}
      </div>

      {/* ─── Étape 1: Informations ─────────────────────────────────────────── */}
      {etape === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du produit *</label>
            <input
              value={infos.nom} onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Licence Pro TurboDesign"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A] text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={infos.description} onChange={(e) => setInfos((p) => ({ ...p, description: e.target.value }))}
              rows={3} placeholder="Décrivez ce que le client reçoit…"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A] resize-none text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix (FCFA) *</label>
            <input
              type="number" min={0} value={infos.prix}
              onChange={(e) => setInfos((p) => ({ ...p, prix: e.target.value }))}
              placeholder="5000"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A] text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug URL</label>
            <SlugInput value={infos.slug} onChange={(v) => setInfos((p) => ({ ...p, slug: v }))} />
          </div>
          <button
            onClick={creerProduit}
            disabled={!infos.nom || !infos.prix || saving}
            className="w-full mt-2 py-3 rounded-xl bg-[#1B2A4A] text-white font-semibold text-sm hover:bg-[#243a60] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? "Création…" : "Continuer"} {!saving && <ArrowRight size={16} />}
          </button>
        </div>
      )}

      {/* ─── Étape 2: Configuration licence ───────────────────────────────────── */}
      {etape === 2 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mode de distribution</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { val: "auto" as const, label: "Génération auto", desc: "Clés générées à la demande", icon: RefreshCw },
                { val: "stock" as const, label: "Stock importé", desc: "Vous importez vos clés", icon: Upload },
              ].map(({ val, label, desc, icon: Icon }) => (
                <button
                  key={val}
                  onClick={() => setConfig((p) => ({ ...p, modeDistrib: val }))}
                  className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-all
                    ${config.modeDistrib === val ? "border-[#16a34a] bg-green-50 dark:bg-green-900/10" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <Icon size={16} className={config.modeDistrib === val ? "text-[#16a34a]" : "text-gray-400"} />
                  <span className={`text-sm font-semibold mt-1.5 ${config.modeDistrib === val ? "text-[#16a34a]" : "text-gray-700"}`}>{label}</span>
                  <span className="text-xs text-gray-400 mt-0.5">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {config.modeDistrib === "auto" && (
            <div className="space-y-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
                <div className="flex gap-3">
                  {[
                    { val: "alphanum" as const, label: "Alphanumérique", ex: "ABCD-3456-EFGH" },
                    { val: "uuid" as const, label: "UUID", ex: "3f4b2a1c-…" },
                  ].map(({ val, label, ex }) => (
                    <button
                      key={val}
                      onClick={() => setConfig((p) => ({ ...p, formatAuto: val }))}
                      className={`flex-1 p-3 rounded-xl border-2 text-left transition-all
                        ${config.formatAuto === val ? "border-[#16a34a] bg-white" : "border-gray-200 hover:border-gray-300 bg-white"}`}
                    >
                      <span className={`text-xs font-semibold block ${config.formatAuto === val ? "text-[#16a34a]" : "text-gray-700"}`}>{label}</span>
                      <code className="text-[10px] text-gray-400">{ex}</code>
                    </button>
                  ))}
                </div>
              </div>
              {config.formatAuto === "alphanum" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Longueur (chars)</label>
                    <input
                      type="number" min={8} max={64} value={config.longueur}
                      onChange={(e) => setConfig((p) => ({ ...p, longueur: parseInt(e.target.value) || 16 }))}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Préfixe (optionnel)</label>
                    <input
                      value={config.prefixe}
                      onChange={(e) => setConfig((p) => ({ ...p, prefixe: e.target.value.toUpperCase() }))}
                      placeholder="PRO-"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Activations max / clé</label>
              <input
                type="number" min={1} value={config.maxActivations}
                onChange={(e) => setConfig((p) => ({ ...p, maxActivations: e.target.value }))}
                placeholder="1"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
              />
              <p className="text-[11px] text-gray-400 mt-1">Nombre d'appareils autorisés</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Durée validité (jours)</label>
              <input
                type="number" min={1} value={config.dureeJours}
                onChange={(e) => setConfig((p) => ({ ...p, dureeJours: e.target.value }))}
                placeholder="Illimitée"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]"
              />
              <p className="text-[11px] text-gray-400 mt-1">Vide = pas d'expiration</p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setEtape(1)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <ArrowLeft size={14} /> Retour
            </button>
            <button
              onClick={sauvegarderConfig} disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-[#1B2A4A] text-white font-semibold text-sm hover:bg-[#243a60] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? "Enregistrement…" : "Continuer"} {!saving && <ArrowRight size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* ─── Étape 3: Clés ────────────────────────────────────────────────────── */}
      {etape === 3 && produitId && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {config.modeDistrib === "auto"
              ? "Générez un premier stock de clés pour que votre produit puisse être vendu."
              : "Importez vos clés depuis votre fournisseur."}
          </p>
          <ClesLicenceManager produitId={produitId} />
          <div className="flex gap-3 pt-2">
            <button onClick={() => setEtape(2)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <ArrowLeft size={14} /> Retour
            </button>
            <button
              onClick={() => setEtape(4)}
              className="flex-1 py-2.5 rounded-xl bg-[#1B2A4A] text-white font-semibold text-sm hover:bg-[#243a60] transition-colors flex items-center justify-center gap-2"
            >
              Continuer <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Étape 4: Publication ─────────────────────────────────────────────── */}
      {etape === 4 && (
        <div className="space-y-6">
          <div className="rounded-2xl border-2 border-dashed border-[#16a34a] bg-green-50 dark:bg-green-900/10 p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#16a34a] flex items-center justify-center mx-auto mb-3">
              <Key size={24} className="text-white" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{infos.nom}</h3>
            <p className="text-sm text-gray-500 mb-3">{infos.description || "Clé de licence"}</p>
            <span className="text-2xl font-bold text-[#16a34a]">{parseInt(infos.prix).toLocaleString("fr")} FCFA</span>
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 text-sm text-gray-600 space-y-1.5">
            <div className="flex justify-between">
              <span>Mode</span>
              <span className="font-medium text-gray-900">{config.modeDistrib === "auto" ? "Génération automatique" : "Stock importé"}</span>
            </div>
            {config.modeDistrib === "auto" && (
              <div className="flex justify-between">
                <span>Format</span>
                <span className="font-medium text-gray-900">{config.formatAuto === "uuid" ? "UUID" : `Alphanumérique ${config.longueur} chars`}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Activations max</span>
              <span className="font-medium text-gray-900">{config.maxActivations || "1"} / clé</span>
            </div>
            <div className="flex justify-between">
              <span>Validité</span>
              <span className="font-medium text-gray-900">{config.dureeJours ? `${config.dureeJours} jours` : "Illimitée"}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setEtape(3)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <ArrowLeft size={14} /> Retour
            </button>
            <button
              onClick={publier} disabled={publishing}
              className="flex-1 py-2.5 rounded-xl bg-[#16a34a] text-white font-bold text-sm hover:bg-[#15803d] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {publishing ? "Publication…" : <><Check size={16} /> Publier le produit</>}
            </button>
          </div>
          <button
            onClick={() => router.push(`/dashboard/produits/${produitId}`)}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Sauvegarder en brouillon et continuer plus tard
          </button>
        </div>
      )}
    </div>
  );
}
