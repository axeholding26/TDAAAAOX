"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, Globe } from "lucide-react";
import Link from "next/link";

type Etape = 1 | 2 | 3;

interface Infos {
  nom: string;
  description: string;
  prix: string;
  slug: string;
}

interface Config {
  niveau: string;
  langue: string;
  dureeMin: string;
  certif: boolean;
}

const NIVEAUX = [
  { id: "debutant",       label: "Débutant",       desc: "Aucun prérequis" },
  { id: "intermediaire",  label: "Intermédiaire",  desc: "Bases requises" },
  { id: "avance",         label: "Avancé",         desc: "Expérience nécessaire" },
];

const LANGUES = [
  { id: "fr", label: "Français" },
  { id: "en", label: "Anglais" },
  { id: "wo", label: "Wolof" },
  { id: "ar", label: "Arabe" },
];

function autoSlug(nom: string) {
  return nom.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CreerFormationPage() {
  const router = useRouter();
  const [etape,     setEtape]     = useState<Etape>(1);
  const [produitId, setProduitId] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [infos, setInfos] = useState<Infos>({ nom: "", description: "", prix: "", slug: "" });
  const [config, setConfig] = useState<Config>({ niveau: "debutant", langue: "fr", dureeMin: "", certif: false });

  const setNom = (nom: string) => setInfos((p) => ({ ...p, nom, slug: p.slug || autoSlug(nom) }));

  // ─── Étape 1 → 2 ────────────────────────────────────────────────────────────
  const creerProduit = async () => {
    if (!infos.nom || !infos.prix) return;
    setSaving(true);
    const r = await fetch("/api/produits/digitaux", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "formation",
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
    // Sauvegarder la config formation
    await fetch(`/api/produits/digitaux/${d.produit?.id ?? d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          niveau:   config.niveau,
          langue:   config.langue,
          dureeMin: config.dureeMin ? parseInt(config.dureeMin) : null,
          certif:   config.certif,
        },
      }),
    });
    setEtape(2);
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

  const ETAPES = ["Informations", "Paramètres", "Publication"];

  const inputCls = "w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/40 bg-white";

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Link href="/dashboard/produits/digital/nouveau" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft size={14} /> Retour
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-xl bg-[#0ea5e915] flex items-center justify-center">
          <BookOpen size={18} className="text-[#0ea5e9]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 font-poppins">Nouvelle formation</h1>
          <p className="text-xs text-gray-400">Chapitres et leçons avec suivi de progression</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {ETAPES.map((label, i) => {
          const n = (i + 1) as Etape;
          const done   = etape > n;
          const active = etape === n;
          return (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${done ? "bg-[#0ea5e9] text-white" : active ? "bg-[#1B2A4A] text-white" : "bg-gray-100 text-gray-400"}`}>
                {done ? <Check size={12} /> : n}
              </div>
              <span className={`text-xs hidden sm:block ${active ? "text-gray-900 font-medium" : "text-gray-400"}`}>{label}</span>
              {i < ETAPES.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
            </div>
          );
        })}
      </div>

      {/* ─── Étape 1 : Infos + Config ─────────────────────────────────────── */}
      {etape === 1 && (
        <div className="space-y-5">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Informations de base</h2>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom de la formation *</label>
              <input
                value={infos.nom} onChange={(e) => setNom(e.target.value)}
                placeholder="Ex : Masterclass Vente en ligne Afrique"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
              <textarea
                value={infos.description} onChange={(e) => setInfos((p) => ({ ...p, description: e.target.value }))}
                rows={3} placeholder="Ce que l'apprenant va maîtriser à la fin…"
                className={`${inputCls} resize-none`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Prix (FCFA) *</label>
              <input
                type="number" min={0} value={infos.prix}
                onChange={(e) => setInfos((p) => ({ ...p, prix: e.target.value }))}
                placeholder="15000"
                className={inputCls}
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Paramètres de la formation</h2>

            {/* Niveau */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Niveau</label>
              <div className="grid grid-cols-3 gap-2">
                {NIVEAUX.map(({ id, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => setConfig((p) => ({ ...p, niveau: id }))}
                    className={`flex flex-col p-3 rounded-xl border-2 text-left transition-all
                      ${config.niveau === id ? "border-[#0ea5e9] bg-[#0ea5e908]" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <span className={`text-xs font-semibold ${config.niveau === id ? "text-[#0ea5e9]" : "text-gray-700"}`}>{label}</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Langue + Durée */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Langue</label>
                <div className="relative">
                  <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select
                    value={config.langue}
                    onChange={(e) => setConfig((p) => ({ ...p, langue: e.target.value }))}
                    className={`${inputCls} pl-8 appearance-none`}
                  >
                    {LANGUES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Durée estimée (min)</label>
                <input
                  type="number" min={0} value={config.dureeMin}
                  onChange={(e) => setConfig((p) => ({ ...p, dureeMin: e.target.value }))}
                  placeholder="120"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Certificat */}
            <button
              onClick={() => setConfig((p) => ({ ...p, certif: !p.certif }))}
              className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${config.certif ? "border-[#16a34a] bg-[#f0fdf4]" : "border-gray-200 hover:border-gray-300"}`}
            >
              <div className="text-left">
                <p className={`text-sm font-semibold ${config.certif ? "text-[#16a34a]" : "text-gray-700"}`}>Certificat de complétion</p>
                <p className="text-xs text-gray-400 mt-0.5">Généré automatiquement quand l'apprenant termine la formation</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${config.certif ? "border-[#16a34a] bg-[#16a34a]" : "border-gray-300"}`}>
                {config.certif && <Check size={11} className="text-white" />}
              </div>
            </button>
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

      {/* ─── Étape 2 : Rappel + CTA vers le produit ──────────────────────── */}
      {etape === 2 && produitId && (
        <div className="space-y-5">
          <div className="rounded-2xl border-2 border-dashed border-[#0ea5e9] bg-[#f0f9ff] p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#0ea5e9] flex items-center justify-center mx-auto mb-3">
              <BookOpen size={24} className="text-white" />
            </div>
            <h3 className="font-bold text-gray-900 mb-1">{infos.nom}</h3>
            <p className="text-sm text-gray-500 mb-3">{infos.description || "Formation digitale"}</p>
            <span className="text-2xl font-bold text-[#0ea5e9]">{parseInt(infos.prix).toLocaleString("fr")} FCFA</span>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600 space-y-1.5">
            {[
              ["Niveau",    NIVEAUX.find((n) => n.id === config.niveau)?.label ?? config.niveau],
              ["Langue",    LANGUES.find((l) => l.id === config.langue)?.label ?? config.langue],
              ["Durée",     config.dureeMin ? `${config.dureeMin} min` : "Non précisée"],
              ["Certificat", config.certif ? "Oui" : "Non"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-gray-400">{k}</span>
                <span className="font-medium text-gray-900">{v}</span>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[#0ea5e9]/30 bg-[#f0f9ff] p-4 text-sm text-[#0369a1]">
            <p className="font-semibold mb-1">Prochaine étape : ajouter le contenu</p>
            <p className="text-xs">Après publication, vous pourrez créer vos chapitres et leçons depuis la page du produit.</p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setEtape(1)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <ArrowLeft size={14} /> Retour
            </button>
            <button
              onClick={publier} disabled={publishing}
              className="flex-1 py-2.5 rounded-xl bg-[#0ea5e9] text-white font-bold text-sm hover:bg-[#0284c7] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {publishing ? "Publication…" : <><Check size={16} /> Publier et ajouter le contenu</>}
            </button>
          </div>
          <button
            onClick={() => router.push(`/dashboard/produits/${produitId}`)}
            className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Sauvegarder en brouillon
          </button>
        </div>
      )}
    </div>
  );
}
