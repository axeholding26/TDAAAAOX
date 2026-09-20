"use client";
import { useState } from "react";
import { Wand2, Sparkles, Package, Download, Check, Loader2, RefreshCw, ChevronRight, Info } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface ProduitGenere {
  nom: string;
  description: string;
  prix: number;
  prixCompare: number;
  categorie: string;
  tags: string[];
  imageUrl: string;
  imagePrompt: string;
  slug: string;
  stock: number;
  devise: string;
  selected: boolean;
}

const EXEMPLES = [
  "Robes africaines wax premium, bazins brodés, boubous et accessoires mode femme",
  "Cosmétiques naturels africains : savons au karité, huiles de baobab, crèmes au cacao",
  "Électronique & accessoires tech : écouteurs, chargeurs, coques, montres connectées",
  "Artisanat togolais : batiks, sculptures bois, bijoux bronze, sacs en raphia",
  "Épicerie fine africaine : épices, thés, tisanes, moringa, spiruline, superaliments",
];

export default function MagicImportPage() {
  const [description, setDescription] = useState("");
  const [nombreProduits, setNombreProduits] = useState(8);
  const [generating, setGenerating] = useState(false);
  const [produits, setProduits] = useState<ProduitGenere[]>([]);
  const [importing, setImporting] = useState(false);
  const [phase, setPhase] = useState<"input" | "review" | "done">("input");
  const [importedCount, setImportedCount] = useState(0);

  async function generer() {
    if (!description.trim()) { toast.error("Décrivez votre boutique ou vos produits"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/magic-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, nombreProduits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setProduits(data.produits.map((p: any) => ({ ...p, selected: true })));
      setPhase("review");
      toast.success(`${data.total} produits générés par Gemini`);
    } catch (err: any) {
      toast.error(err.message || "Erreur de génération");
    } finally {
      setGenerating(false);
    }
  }

  function toggleSelect(i: number) {
    setProduits(prev => prev.map((p, idx) => idx === i ? { ...p, selected: !p.selected } : p));
  }

  async function importer() {
    const selected = produits.filter(p => p.selected);
    if (!selected.length) { toast.error("Sélectionne au moins un produit"); return; }
    setImporting(true);
    try {
      const res = await fetch("/api/magic-import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produits: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setImportedCount(data.created);
      setPhase("done");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setPhase("input");
    setProduits([]);
    setDescription("");
    setImportedCount(0);
  }

  const selectedCount = produits.filter(p => p.selected).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200">
          <Wand2 size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-poppins">Magic Import</h1>
          <p className="text-gray-400 text-sm">Gemini + Flux.1 génère votre catalogue complet avec images ultra HD en quelques secondes</p>
        </div>
        {phase === "review" && (
          <button onClick={reset}
            className="ml-auto flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl transition-all">
            <RefreshCw size={13} /> Nouveau
          </button>
        )}
      </div>

      {/* Phase input */}
      {phase === "input" && (
        <div className="space-y-5">
          {/* Info banner */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <Info size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">Comment ça marche</p>
                <p className="text-sm text-amber-700 leading-relaxed">
                  Décrivez votre boutique en quelques mots → <strong>Gemini</strong> génère un catalogue
                  complet avec descriptions, prix adaptés au marché africain, tags SEO et prompts optimisés pour
                  <strong> Flux.1-dev</strong>. Les images Flux.1 ultra HD se chargent automatiquement.
                  Sélectionnez vos produits et importez en 1 clic.
                </p>
              </div>
            </div>
          </div>

          {/* Input card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">
                Décrivez votre boutique ou votre niche de produits
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value.slice(0, 600))}
                placeholder="Ex: Je vends des robes africaines wax premium, des bazins brodés et des accessoires mode pour femmes au Sénégal. Gamme de prix 15 000 – 85 000 XOF."
                className="w-full h-36 p-4 rounded-xl border border-gray-200 text-sm text-gray-800 resize-none focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 placeholder-gray-300 transition-all"
              />
              <p className="text-xs text-gray-300 mt-1 text-right">{description.length}/600</p>
            </div>

            {/* Nombre de produits */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">Nombre de produits</label>
                <span className="text-xl font-black text-amber-500">{nombreProduits}</span>
              </div>
              <div className="flex items-center gap-4">
                <input type="range" min={3} max={20} value={nombreProduits}
                  onChange={e => setNombreProduits(Number(e.target.value))}
                  className="flex-1 accent-amber-500 h-2" />
                <div className="flex gap-1.5 flex-shrink-0">
                  {[5, 8, 12, 20].map(n => (
                    <button key={n} onClick={() => setNombreProduits(n)}
                      className={`w-8 h-7 rounded-lg text-xs font-bold transition-all ${
                        nombreProduits === n ? "bg-amber-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA */}
            <button onClick={generer} disabled={generating || !description.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-[15px] flex items-center justify-center gap-3 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-200/60">
              {generating ? (
                <><Loader2 size={19} className="animate-spin" /> Gemini génère votre catalogue...</>
              ) : (
                <><Wand2 size={19} /> Générer {nombreProduits} produits avec Flux.1-dev</>
              )}
            </button>
          </div>

          {/* Quick examples */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Exemples rapides</p>
            <div className="space-y-2">
              {EXEMPLES.map(ex => (
                <button key={ex} onClick={() => setDescription(ex)}
                  className="w-full text-left text-xs bg-white border border-gray-100 text-gray-500 px-4 py-2.5 rounded-xl hover:border-amber-300 hover:text-gray-800 hover:bg-amber-50 transition-all flex items-center gap-2">
                  <Sparkles size={11} className="text-amber-400 flex-shrink-0" />
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Phase review */}
      {phase === "review" && produits.length > 0 && (
        <div className="space-y-4">
          {/* Controls bar */}
          <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl px-5 py-3 gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-700">
                <span className="text-amber-500 font-black">{selectedCount}</span> / {produits.length} sélectionnés
              </span>
              <button onClick={() => setProduits(p => p.map(x => ({ ...x, selected: true })))}
                className="text-xs text-amber-500 hover:text-amber-600 font-semibold">Tout</button>
              <button onClick={() => setProduits(p => p.map(x => ({ ...x, selected: false })))}
                className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Aucun</button>
            </div>
            <button onClick={importer} disabled={importing || selectedCount === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 shadow-md shadow-amber-200">
              {importing ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Importer {selectedCount > 0 ? selectedCount : ""} produit{selectedCount > 1 ? "s" : ""}
            </button>
          </div>

          {/* Products grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {produits.map((p, i) => (
              <div key={i} onClick={() => toggleSelect(i)}
                className={`bg-white border-2 rounded-2xl overflow-hidden cursor-pointer transition-all hover:shadow-lg ${
                  p.selected ? "border-amber-400 shadow-md shadow-amber-100" : "border-gray-100 hover:border-gray-200"
                }`}>
                {/* Image */}
                <div className="relative aspect-square overflow-hidden bg-gray-50">
                  <img src={p.imageUrl} alt={p.nom}
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    loading="lazy"
                  />
                  {/* Selection badge */}
                  <div className={`absolute top-2.5 right-2.5 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shadow-sm ${
                    p.selected ? "bg-amber-400 border-amber-400" : "bg-white/90 border-gray-300"
                  }`}>
                    {p.selected && <Check size={13} className="text-white" />}
                  </div>
                  {/* Category badge */}
                  <div className="absolute bottom-2 left-2">
                    <span className="text-[10px] font-semibold bg-black/55 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {p.categorie}
                    </span>
                  </div>
                  {/* Flux badge */}
                  <div className="absolute bottom-2 right-2">
                    <span className="text-[9px] font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white px-1.5 py-0.5 rounded-full">
                      FLUX.1
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3.5">
                  <p className="text-sm font-bold text-gray-900 line-clamp-1 mb-0.5">{p.nom}</p>
                  <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">{p.description}</p>

                  {/* Price */}
                  <div className="flex items-baseline gap-2 mt-2.5">
                    <span className="text-[15px] font-black text-gray-900">{p.prix.toLocaleString()}</span>
                    <span className="text-xs text-gray-400">{p.devise}</span>
                    {p.prixCompare > p.prix && (
                      <span className="text-xs text-gray-300 line-through ml-auto">{p.prixCompare.toLocaleString()}</span>
                    )}
                  </div>

                  {/* Tags */}
                  {p.tags?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {p.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md font-medium">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Sticky bottom CTA */}
          <div className="sticky bottom-4 pt-2">
            <button onClick={importer} disabled={importing || selectedCount === 0}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold text-[15px] flex items-center justify-center gap-3 hover:opacity-90 transition-all disabled:opacity-50 shadow-xl shadow-amber-300/40">
              {importing ? (
                <><Loader2 size={20} className="animate-spin" /> Importation en cours...</>
              ) : (
                <><Package size={20} /> Importer {selectedCount} produit{selectedCount > 1 ? "s" : ""} dans ma boutique <ChevronRight size={17} /></>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Phase done */}
      {phase === "done" && (
        <div className="flex flex-col items-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mb-5 shadow-lg shadow-green-100">
            <Check size={38} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Catalogue importé !</h2>
          <p className="text-gray-400 text-sm mb-8 max-w-md">
            {importedCount} produit{importedCount > 1 ? "s" : ""} ajouté{importedCount > 1 ? "s" : ""} à votre boutique avec des images Flux.1 haute définition.
            Axia peut maintenant les enrichir et les promouvoir.
          </p>
          <div className="flex gap-3">
            <Link href="/dashboard/produits"
              className="px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all">
              Voir les produits
            </Link>
            <Link href="/dashboard"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white font-semibold text-sm hover:opacity-90 transition-all flex items-center gap-2">
              <Sparkles size={14} /> Demander à Axia de promouvoir
            </Link>
            <button onClick={reset}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-semibold text-sm hover:opacity-90 transition-all">
              Nouveau catalogue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
