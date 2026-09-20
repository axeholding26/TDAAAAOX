"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Package, Plus, X,
  Search, Sparkles, AlertCircle, ChevronRight, ImageIcon, Percent,
} from "lucide-react";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProduitOption = {
  id: string; nom: string; prix: number; images: string[]; type: string;
};

type EtatWizard = {
  nom: string; slug: string; description: string; images: string[];
  categorie: string;
  // Produits sélectionnés
  produitsSelectionnes: ProduitOption[];
  // Tarification
  prix: string;
};

const ETAT_INITIAL: EtatWizard = {
  nom: "", slug: "", description: "", images: [], categorie: "",
  produitsSelectionnes: [], prix: "",
};

const ETAPES = ["Infos", "Produits", "Tarification", "Publication"];

function formatTaille(n: number) {
  return n.toLocaleString("fr-FR");
}

// ─── Étape 1 — Infos ─────────────────────────────────────────────────────────

function EtapeInfos({ e, set }: { e: EtatWizard; set: (p: Partial<EtatWizard>) => void }) {
  const [uploadImg, setUploadImg] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploadImg(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ images: [...e.images, data.url] });
    } catch (err: any) { toast.error(err.message); }
    finally { setUploadImg(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du bundle *</label>
        <input
          value={e.nom}
          onChange={(ev) => set({ nom: ev.target.value, slug: slugify(ev.target.value) })}
          placeholder="Ex : Pack Entrepreneur Complet"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5A623]/20 focus:border-[#F5A623]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea
          value={e.description}
          onChange={(ev) => set({ description: ev.target.value })}
          rows={4}
          placeholder="Décrivez ce que contient ce bundle et sa valeur ajoutée…"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#F5A623]/20 focus:border-[#F5A623]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Visuels</label>
        <div className="flex flex-wrap gap-2">
          {e.images.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => set({ images: e.images.filter((_, j) => j !== i) })}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            onClick={() => ref.current?.click()}
            disabled={uploadImg}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#F5A623] hover:text-[#F5A623] transition-colors"
          >
            {uploadImg ? <Loader2 size={18} className="animate-spin" /> : <><ImageIcon size={18} /><span className="text-[10px]">Ajouter</span></>}
          </button>
          <input ref={ref} type="file" accept="image/*" className="hidden"
            onChange={(ev) => { const f = ev.target.files?.[0]; if (f) uploadImage(f); ev.target.value = ""; }} />
        </div>
      </div>
    </div>
  );
}

// ─── Étape 2 — Sélection produits ────────────────────────────────────────────

function EtapeProduits({ e, set }: { e: EtatWizard; set: (p: Partial<EtatWizard>) => void }) {
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState<ProduitOption[]>([]);
  const [loading, setLoading] = useState(false);

  const chercher = useCallback(async (q: string) => {
    if (!q.trim()) { setResultats([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/produits?search=${encodeURIComponent(q)}&limit=8&actif=true`);
      const data = await res.json();
      const selectedIds = new Set(e.produitsSelectionnes.map((p) => p.id));
      setResultats((data.produits || []).filter((p: any) => !selectedIds.has(p.id) && p.type !== "bundle"));
    } catch { setResultats([]); }
    finally { setLoading(false); }
  }, [e.produitsSelectionnes]);

  useEffect(() => {
    const t = setTimeout(() => chercher(recherche), 300);
    return () => clearTimeout(t);
  }, [recherche, chercher]);

  function ajouter(p: ProduitOption) {
    if (e.produitsSelectionnes.some((x) => x.id === p.id)) return;
    set({ produitsSelectionnes: [...e.produitsSelectionnes, p] });
    setResultats((r) => r.filter((x) => x.id !== p.id));
  }

  function retirer(id: string) {
    set({ produitsSelectionnes: e.produitsSelectionnes.filter((p) => p.id !== id) });
  }

  const valeurTotale = e.produitsSelectionnes.reduce((s, p) => s + p.prix, 0);

  return (
    <div className="space-y-4">
      {/* Barre de recherche */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={recherche}
          onChange={(ev) => setRecherche(ev.target.value)}
          placeholder="Rechercher un produit à inclure…"
          className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5A623]/20 focus:border-[#F5A623]"
        />
        {loading && <Loader2 size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
      </div>

      {/* Résultats de recherche */}
      {resultats.length > 0 && (
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-48 overflow-y-auto">
          {resultats.map((p) => (
            <button
              key={p.id}
              onClick={() => ajouter(p)}
              className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {p.images[0]
                  ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                  : <Package size={14} className="text-gray-400 m-auto mt-1" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.nom}</p>
                <p className="text-xs text-gray-400">{p.prix.toLocaleString("fr-FR")} FCFA · {p.type}</p>
              </div>
              <Plus size={14} className="text-[#F5A623] flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Produits sélectionnés */}
      {e.produitsSelectionnes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {e.produitsSelectionnes.length} produit{e.produitsSelectionnes.length > 1 ? "s" : ""} inclus
          </p>
          {e.produitsSelectionnes.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-white">
              <span className="text-xs font-bold text-gray-300 w-5 text-center">{i + 1}</span>
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {p.images[0]
                  ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                  : <Package size={14} className="text-gray-400 m-auto mt-1" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{p.nom}</p>
                <p className="text-xs text-gray-400">{p.prix.toLocaleString("fr-FR")} FCFA</p>
              </div>
              <button onClick={() => retirer(p.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={15} />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-xs text-gray-500">Valeur totale des produits</span>
            <span className="text-sm font-bold text-gray-800">{valeurTotale.toLocaleString("fr-FR")} FCFA</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl p-3">
          <AlertCircle size={14} className="flex-shrink-0" />
          Recherchez et ajoutez au moins 2 produits pour créer un bundle.
        </div>
      )}
    </div>
  );
}

// ─── Étape 3 — Tarification ──────────────────────────────────────────────────

function EtapeTarification({ e, set }: { e: EtatWizard; set: (p: Partial<EtatWizard>) => void }) {
  const valeurTotale = e.produitsSelectionnes.reduce((s, p) => s + p.prix, 0);
  const prixNum = parseFloat(e.prix) || 0;
  const remise = valeurTotale > 0 && prixNum > 0
    ? Math.round((1 - prixNum / valeurTotale) * 100)
    : 0;

  function appliquerRemise(pct: number) {
    const prix = Math.round(valeurTotale * (1 - pct / 100));
    set({ prix: String(prix) });
  }

  return (
    <div className="space-y-5">
      {/* Valeur totale */}
      <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
        <p className="text-xs text-gray-500 mb-1">Valeur cumulée des produits inclus</p>
        <p className="text-2xl font-black text-gray-800">{valeurTotale.toLocaleString("fr-FR")} FCFA</p>
      </div>

      {/* Remises rapides */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">Remise rapide</p>
        <div className="flex gap-2">
          {[10, 20, 30, 40].map((pct) => (
            <button
              key={pct}
              onClick={() => appliquerRemise(pct)}
              className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all ${
                remise === pct
                  ? "bg-[#F5A623] border-[#F5A623] text-white"
                  : "border-gray-200 text-gray-600 hover:border-[#F5A623]/50 hover:text-[#F5A623]"
              }`}
            >
              -{pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Prix manuel */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix du bundle (FCFA) *</label>
        <div className="relative">
          <input
            type="number"
            min="0"
            value={e.prix}
            onChange={(ev) => set({ prix: ev.target.value })}
            placeholder="Saisir un prix…"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5A623]/20 focus:border-[#F5A623]"
          />
        </div>
      </div>

      {/* Résumé remise */}
      {prixNum > 0 && valeurTotale > 0 && (
        <div className={`flex items-center gap-3 p-3 rounded-xl text-sm font-semibold ${
          remise > 0
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-gray-50 text-gray-600 border border-gray-200"
        }`}>
          <Percent size={15} className="flex-shrink-0" />
          {remise > 0
            ? `Économie de ${remise}% par rapport à la valeur cumulée`
            : "Prix égal ou supérieur à la valeur cumulée"
          }
        </div>
      )}
    </div>
  );
}

// ─── Étape 4 — Publication ────────────────────────────────────────────────────

function EtapePublication({ e }: { e: EtatWizard }) {
  const valeurTotale = e.produitsSelectionnes.reduce((s, p) => s + p.prix, 0);
  const prixNum = parseFloat(e.prix) || 0;
  const checks = [
    { ok: e.nom.length >= 2,                   label: "Nom renseigné" },
    { ok: e.produitsSelectionnes.length >= 2,  label: "Au moins 2 produits inclus" },
    { ok: prixNum > 0,                          label: "Prix défini" },
    { ok: e.images.length > 0,                 label: "Au moins 1 visuel" },
  ];

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-1.5 text-sm">
        <h3 className="font-semibold text-gray-800 mb-3">Récapitulatif bundle</h3>
        <div className="flex justify-between"><span className="text-gray-500">Nom</span><span className="font-medium">{e.nom || "—"}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Produits inclus</span><span className="font-medium">{e.produitsSelectionnes.length}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Valeur totale</span><span className="font-medium">{valeurTotale.toLocaleString("fr-FR")} FCFA</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Prix bundle</span><span className="font-bold text-[#F5A623]">{prixNum > 0 ? `${prixNum.toLocaleString("fr-FR")} FCFA` : "—"}</span></div>
        {valeurTotale > 0 && prixNum > 0 && (
          <div className="flex justify-between"><span className="text-gray-500">Économie client</span>
            <span className="text-green-600 font-semibold">{Math.round((1 - prixNum / valeurTotale) * 100)}%</span>
          </div>
        )}
      </div>

      <div className="p-4 rounded-2xl border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
          <Sparkles size={15} className="text-[#F5A623]" /> Prêt à publier ?
        </h3>
        <div className="space-y-2">
          {checks.map((c, i) => (
            <div key={i} className={`flex items-center gap-2 text-sm ${c.ok ? "text-green-600" : "text-amber-600"}`}>
              {c.ok ? <Check size={14} /> : <AlertCircle size={14} />}
              {c.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CreerBundlePage() {
  const router = useRouter();
  const [etape, setEtape] = useState(0);
  const [etat, setEtatRaw] = useState<EtatWizard>(ETAT_INITIAL);
  const [saving, setSaving] = useState(false);
  const [produitId, setProduitId] = useState<string | null>(null);

  function set(patch: Partial<EtatWizard>) {
    setEtatRaw((prev) => ({ ...prev, ...patch }));
  }

  function valider(): string | null {
    if (etape === 0 && etat.nom.length < 2) return "Le nom doit faire au moins 2 caractères.";
    if (etape === 1 && etat.produitsSelectionnes.length < 2) return "Ajoutez au moins 2 produits.";
    if (etape === 2 && (!etat.prix || parseFloat(etat.prix) <= 0)) return "Le prix est requis.";
    return null;
  }

  async function suivant() {
    const err = valider();
    if (err) { toast.error(err); return; }
    if (etape === 2) {
      await creerProduit(false);
    } else {
      setEtape((s) => Math.min(s + 1, 3));
    }
  }

  async function creerProduit(publier: boolean) {
    setSaving(true);
    try {
      // 1. Créer le produit bundle
      const resP = await fetch("/api/produits/digitaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom:         etat.nom,
          slug:        etat.slug || slugify(etat.nom),
          description: etat.description,
          prix:        parseFloat(etat.prix),
          images:      etat.images,
          type:        "bundle",
        }),
      });
      const dataP = await resP.json();
      if (!resP.ok) throw new Error(dataP.error || "Erreur création bundle");

      const id: string = dataP.produit.id;
      setProduitId(id);

      // 2. Ajouter les produits inclus
      if (etat.produitsSelectionnes.length > 0) {
        await fetch(`/api/produits/digitaux/${id}/elements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ produitIds: etat.produitsSelectionnes.map((p) => p.id) }),
        });
      }

      // 3. Publier si demandé
      if (publier) {
        await fetch(`/api/produits/digitaux/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actif: true }),
        });
        toast.success("Bundle publié !");
        router.push(`/dashboard/produits/${id}`);
      } else {
        setEtape(3);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur serveur");
    } finally {
      setSaving(false);
    }
  }

  async function publier() {
    if (produitId) {
      setSaving(true);
      try {
        await fetch(`/api/produits/digitaux/${produitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actif: true }),
        });
        toast.success("Bundle publié !");
        router.push(`/dashboard/produits/${produitId}`);
      } catch { toast.error("Erreur publication"); }
      finally { setSaving(false); }
    } else {
      await creerProduit(true);
    }
  }

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <Link href="/dashboard/produits/digital/nouveau" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft size={14} /> Changer de type
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-[#F5A623]/15 flex items-center justify-center">
            <Package size={14} className="text-[#F5A623]" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 font-poppins">Bundle</h1>
        </div>
        <p className="text-sm text-gray-500">Étape {etape + 1} sur {ETAPES.length} — {ETAPES[etape]}</p>
      </div>

      <div className="flex gap-1.5 mb-8">
        {ETAPES.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= etape ? "bg-[#F5A623]" : "bg-gray-200"}`} />
        ))}
      </div>

      <div className="mb-8">
        {etape === 0 && <EtapeInfos        e={etat} set={set} />}
        {etape === 1 && <EtapeProduits     e={etat} set={set} />}
        {etape === 2 && <EtapeTarification e={etat} set={set} />}
        {etape === 3 && <EtapePublication  e={etat} />}
      </div>

      <div className="flex gap-3">
        {etape > 0 && (
          <button onClick={() => setEtape((s) => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all">
            <ArrowLeft size={14} /> Précédent
          </button>
        )}
        {etape < 3 ? (
          <button onClick={suivant} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-[#F5A623] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#d4820a] transition-all disabled:opacity-60 shadow-lg shadow-[#F5A623]/25">
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {etape === 2 ? "Vérifier avant publication" : "Continuer"}
            {!saving && <ChevronRight size={15} />}
          </button>
        ) : (
          <button onClick={publier} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-[#F5A623] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#d4820a] transition-all disabled:opacity-60 shadow-lg shadow-[#F5A623]/25">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={15} />}
            Publier le bundle
          </button>
        )}
      </div>
    </div>
  );
}
