"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, X, Sparkles, Loader2, Package, Image as ImageIcon,
  Tag, BarChart2, Globe, Upload, Video, FileText, Truck, Download,
  ExternalLink, Info, Zap, ScanLine
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { slugify } from "@/lib/utils";
import { BarcodeCaptureModal } from "@/components/dashboard/BarcodeCaptureModal";

const CATEGORIES = [
  "Mode & Vêtements", "Beauté & Cosmétiques", "Alimentation & Épicerie",
  "Artisanat & Art", "Électronique", "Maison & Décoration",
  "Santé & Bien-être", "Sport & Loisirs", "Formation & Cours",
  "Logiciel & App", "Musique & Audio", "Photo & Vidéo", "Autre",
];

const TYPES_PRODUIT = [
  {
    id: "physique",
    icon: Package,
    label: "Physique",
    desc: "Stock, livraison, poids",
    color: "#F5A623",
  },
  {
    id: "digital",
    icon: Download,
    label: "Digital",
    desc: "Fichier, formation, licence, bundle — assistant dédié",
    color: "#1B2A4A",
  },
  {
    id: "dropshipping",
    icon: Truck,
    label: "Dropshipping",
    desc: "Fournisseur externe, envoi direct",
    color: "#34d399",
  },
];

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

export default function NouveauProduitPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [genIA, setGenIA] = useState(false);
  const [genImage, setGenImage] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [imageInput, setImageInput] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingFichier, setUploadingFichier] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const digitalFileRef = useRef<HTMLInputElement>(null);

  const [variantes, setVariantes] = useState<{ nom: string; valeur: string; sku: string; prix: string; stock: string; image: string }[]>([]);
  const [varianteForm, setVarianteForm] = useState({ nom: "Taille", valeur: "", sku: "", prix: "", stock: "0", image: "" });
  const [scanBarcodeOuvert, setScanBarcodeOuvert] = useState(false);

  const [form, setForm] = useState({
    type: "physique" as "physique" | "digital" | "dropshipping",
    nom: "",
    slug: "",
    description: "",
    prix: "",
    prixCompare: "",
    cout: "",
    stock: "0",
    sku: "",
    codeBarres: "",
    categorie: "",
    tags: [] as string[],
    images: [] as string[],
    videos: [] as string[],
    actif: true,
    featured: false,
    poids: "",
    metaTitle: "",
    metaDesc: "",
    // digital
    fichierUrl: "",
    fichierNom: "",
    fichierTaille: 0,
    instructionsTelechargement: "",
    // dropshipping
    prixFournisseur: "",
    urlFournisseur: "",
    nomFournisseur: "",
  });

  function set(field: string, value: any) {
    setForm(f => {
      const updated = { ...f, [field]: value };
      if (field === "nom") updated.slug = slugify(value);
      return updated;
    });
  }

  const marge = form.prixFournisseur && form.prix
    ? Math.round((1 - parseFloat(form.prixFournisseur) / parseFloat(form.prix)) * 100)
    : null;
  const margeCout = form.cout && form.prix
    ? Math.round((1 - parseFloat(form.cout) / parseFloat(form.prix)) * 100)
    : null;

  // ─── Upload image/vidéo ──────────────────────────────────────────
  async function uploadMedia(file: File, type: "image" | "video") {
    const fd = new FormData();
    fd.append("file", file);
    setUploadingMedia(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur upload");
      if (type === "image") set("images", [...form.images, data.url]);
      else set("videos", [...form.videos, data.url]);
      toast.success(`${type === "image" ? "Image" : "Vidéo"} uploadée`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingMedia(false);
    }
  }

  async function uploadFichierDigital(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    setUploadingFichier(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur upload");
      set("fichierUrl", data.url);
      set("fichierNom", file.name);
      set("fichierTaille", file.size);
      toast.success("Fichier digital uploadé !");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingFichier(false);
    }
  }

  // ─── IA : génération description ────────────────────────────────
  async function genererDescription() {
    if (!form.nom) { toast.error("Entrez d'abord le nom du produit"); return; }
    setGenIA(true);
    try {
      const res = await fetch("/api/ai/description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: form.nom, categorie: form.categorie }),
      });
      const data = await res.json();
      if (data.description) set("description", data.description);
    } catch { toast.error("Erreur IA"); }
    finally { setGenIA(false); }
  }

  // ─── IA : génération image Pollinations ─────────────────────────
  async function genererImageIA() {
    if (!form.nom) { toast.error("Entrez d'abord le nom du produit"); return; }
    setGenImage(true);
    try {
      const prompt = `${form.nom}, ${form.categorie || "produit"}, professional product photo, clean white background, studio lighting, 4K, sharp`;
      const encoded = encodeURIComponent(prompt);
      const seed = Math.floor(Math.random() * 999999);
      const url = `https://image.pollinations.ai/prompt/${encoded}?width=800&height=800&nologo=true&model=flux&enhance=true&seed=${seed}`;
      set("images", [...form.images, url]);
      toast.success("Image IA générée !");
    } catch { toast.error("Erreur génération image"); }
    finally { setGenImage(false); }
  }

  // ─── Sauvegarde ─────────────────────────────────────────────────
  async function sauvegarder() {
    if (!form.nom || !form.prix) { toast.error("Nom et prix obligatoires"); return; }
    if (form.type === "digital" && !form.fichierUrl) {
      toast.error("Uploadez le fichier digital avant de créer le produit");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        nom: form.nom,
        slug: form.slug || slugify(form.nom),
        description: form.description || undefined,
        prix: parseFloat(form.prix),
        prixCompare: form.prixCompare ? parseFloat(form.prixCompare) : undefined,
        stock: form.type === "digital" ? 99999 : parseInt(form.stock) || 0,
        sku: form.sku || undefined,
        codeBarres: form.codeBarres || undefined,
        categorie: form.categorie || undefined,
        tags: form.tags,
        images: form.images,
        videos: form.videos,
        actif: form.actif,
        featured: form.featured,
        type: form.type,
      };

      if (form.type === "physique") {
        payload.poids = form.poids ? parseFloat(form.poids) : undefined;
        payload.cout = form.cout ? parseFloat(form.cout) : undefined;
      }
      if (form.type === "digital") {
        payload.fichierUrl = form.fichierUrl;
        payload.fichierNom = form.fichierNom;
        payload.fichierTaille = form.fichierTaille || undefined;
        payload.instructionsTelechargement = form.instructionsTelechargement || undefined;
      }
      if (form.type === "dropshipping") {
        payload.prixFournisseur = form.prixFournisseur ? parseFloat(form.prixFournisseur) : undefined;
        payload.urlFournisseur = form.urlFournisseur || undefined;
        payload.nomFournisseur = form.nomFournisseur || undefined;
      }
      if (variantes.length > 0) {
        payload.variantes = variantes.map(v => ({
          nom: v.nom, valeur: v.valeur, sku: v.sku || undefined,
          prix: v.prix ? parseFloat(v.prix) : undefined,
          stock: parseInt(v.stock) || 0,
          image: v.image || undefined,
        }));
      }

      const res = await fetch("/api/produits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur");
      toast.success("Produit créé !");
      router.push(`/dashboard/produits/${data.produit.id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full bg-white border border-[#E8E8E8] rounded-2xl px-4 py-3 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 placeholder:text-[#CCCCCC] transition-all";

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/produits" className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:border-[#F5A623]/30 transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 font-poppins">Nouveau produit</h1>
            <p className="text-gray-400 text-xs">Physique, digital ou dropshipping</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => set("actif", !form.actif)}
            className={`px-4 py-2 rounded-xl text-sm border transition-all ${form.actif ? "bg-green-50 border-green-200 text-green-600" : "bg-white border-gray-200 text-gray-500"}`}>
            {form.actif ? "✓ Actif" : "Brouillon"}
          </button>
          <button onClick={sauvegarder} disabled={saving}
            className="flex items-center gap-2 bg-[#F5A623] text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-[#d4820a] transition-all disabled:opacity-50 shadow-lg shadow-[#F5A623]/25">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Créer le produit
          </button>
        </div>
      </div>

      {/* ─── Sélecteur de type ─── */}
      <div className="grid grid-cols-3 gap-3">
        {TYPES_PRODUIT.map((t) => {
          const Icone = t.icon;
          const actif = form.type === t.id;
          const estDigital = t.id === "digital";
          return (
            <button
              key={t.id}
              onClick={() => estDigital ? router.push("/dashboard/produits/digital/nouveau") : set("type", t.id)}
              className="flex items-start gap-3 p-4 rounded-2xl border text-left transition-all"
              style={{
                borderColor: actif ? t.color + "50" : "rgba(229,231,235,1)",
                background: actif ? t.color + "08" : "white",
                boxShadow: actif ? `0 0 20px ${t.color}20` : "none",
              }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: t.color + "15" }}>
                <Icone size={18} style={{ color: t.color }} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{t.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
              </div>
              {estDigital ? (
                <ExternalLink size={13} className="ml-auto text-gray-300 flex-shrink-0 mt-0.5" />
              ) : actif && (
                <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center" style={{ background: t.color }}>
                  <span className="text-white text-[10px] font-bold">✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-5">

          {/* Infos générales */}
          <div className="ax-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Package size={15} className="text-[#F5A623]" />
              <h2 className="text-[13px] font-semibold text-[#111111]">Informations générales</h2>
            </div>
            <div>
              <label className="ax-label block mb-1.5">Nom du produit *</label>
              <input value={form.nom} onChange={e => set("nom", e.target.value)} placeholder="Ex: Robe Wax Premium" maxLength={120} className={inputClass} />
            </div>
            <div>
              <label className="ax-label block mb-1.5">Slug URL</label>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <span className="text-gray-400 text-xs">/produits/</span>
                <input value={form.slug} onChange={e => set("slug", e.target.value)} className="bg-transparent text-sm text-gray-600 outline-none flex-1" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-gray-400 text-xs">Description</label>
                <div className="flex gap-2">
                  <button onClick={genererDescription} disabled={genIA}
                    className="flex items-center gap-1 text-[#F5A623] text-xs hover:text-[#d4820a] transition-colors disabled:opacity-50">
                    {genIA ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Générer avec l'IA
                  </button>
                </div>
              </div>
              <textarea value={form.description} onChange={e => set("description", e.target.value)}
                rows={5} placeholder="Décrivez votre produit..." className={`${inputClass} resize-none`} />
            </div>
          </div>

          {/* Prix & Stock */}
          <div className="ax-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart2 size={15} className="text-[#F5A623]" />
              <h2 className="text-[13px] font-semibold text-[#111111]">Prix & Stock</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="ax-label block mb-1.5">Prix de vente *</label>
                <input type="number" value={form.prix} onChange={e => set("prix", e.target.value)} placeholder="0" min="0" className={inputClass} />
              </div>
              <div>
                <label className="ax-label block mb-1.5">Prix barré (promo)</label>
                <input type="number" value={form.prixCompare} onChange={e => set("prixCompare", e.target.value)} placeholder="0" min="0" className={inputClass} />
              </div>
              {form.type !== "digital" && (
                <>
                  <div>
                    <label className="ax-label block mb-1.5">Stock initial</label>
                    <input type="number" value={form.stock} onChange={e => set("stock", e.target.value)} min="0" className={inputClass} />
                  </div>
                  <div>
                    <label className="ax-label block mb-1.5">SKU / Référence</label>
                    <input value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="SKU-001" className={inputClass} />
                  </div>
                  <div>
                    <label className="ax-label block mb-1.5">Code-barres (EAN/UPC)</label>
                    <div className="flex items-center gap-2">
                      <input value={form.codeBarres} onChange={e => set("codeBarres", e.target.value)} placeholder="ex: 6001234567890" className={`${inputClass} flex-1`} />
                      <button
                        type="button"
                        onClick={() => setScanBarcodeOuvert(true)}
                        title="Scanner le code-barres avec la caméra"
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-[12.5px] text-white shrink-0 transition-all hover:opacity-90"
                        style={{ background: "#F5A623" }}
                      >
                        <ScanLine size={14} /> Scanner
                      </button>
                    </div>
                  </div>
                </>
              )}
              {form.type === "physique" && (
                <div>
                  <label className="ax-label block mb-1.5">Prix d'achat (coût)</label>
                  <input type="number" value={form.cout} onChange={e => set("cout", e.target.value)} placeholder="0" min="0" className={inputClass} />
                  <p className="text-[11px] text-gray-400 mt-1">Pour calculer la vraie rentabilité dans le module Point de vente</p>
                </div>
              )}
            </div>
            {form.type === "digital" && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-2.5 text-purple-700 text-xs flex items-center gap-2">
                <Info size={12} /> Stock automatiquement illimité pour les produits digitaux
              </div>
            )}
            {form.type === "dropshipping" && marge !== null && (
              <div className={`rounded-xl px-4 py-2.5 text-xs flex items-center gap-2 ${marge >= 30 ? "bg-green-50 border border-green-200 text-green-700" : marge >= 10 ? "bg-yellow-50 border border-yellow-200 text-yellow-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
                <BarChart2 size={12} /> Marge : {marge}% {marge >= 30 ? "✓ Bonne marge" : marge >= 10 ? "⚠ Marge faible" : "✗ Marge insuffisante"}
              </div>
            )}
            {form.type === "physique" && margeCout !== null && (
              <div className={`rounded-xl px-4 py-2.5 text-xs flex items-center gap-2 ${margeCout >= 30 ? "bg-green-50 border border-green-200 text-green-700" : margeCout >= 10 ? "bg-yellow-50 border border-yellow-200 text-yellow-700" : "bg-red-50 border border-red-200 text-red-600"}`}>
                <BarChart2 size={12} /> Marge brute : {margeCout}% {margeCout >= 30 ? "✓ Bonne marge" : margeCout >= 10 ? "⚠ Marge faible" : "✗ Marge insuffisante"}
              </div>
            )}
          </div>

          {/* ─── Section DROPSHIPPING ─── */}
          {form.type === "dropshipping" && (
            <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Truck size={15} className="text-emerald-500" />
                <h2 className="text-[13px] font-semibold text-[#111111]">Informations fournisseur</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="ax-label block mb-1.5">Prix fournisseur (coût)</label>
                  <input type="number" value={form.prixFournisseur} onChange={e => set("prixFournisseur", e.target.value)} placeholder="0" min="0" className={inputClass} />
                </div>
                <div>
                  <label className="ax-label block mb-1.5">Nom du fournisseur</label>
                  <input value={form.nomFournisseur} onChange={e => set("nomFournisseur", e.target.value)} placeholder="AliExpress, CJ, ..." className={inputClass} />
                </div>
              </div>
              <div>
                <label className="ax-label block mb-1.5">URL produit source</label>
                <div className="flex gap-2">
                  <input value={form.urlFournisseur} onChange={e => set("urlFournisseur", e.target.value)}
                    placeholder="https://aliexpress.com/item/..." className={`${inputClass} flex-1`} />
                  {form.urlFournisseur && (
                    <a href={form.urlFournisseur} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-400 hover:text-gray-700 transition-colors">
                      <ExternalLink size={15} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── Section DIGITAL ─── */}
          {form.type === "digital" && (
            <div className="bg-white border border-purple-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText size={15} className="text-purple-500" />
                <h2 className="text-[13px] font-semibold text-[#111111]">Fichier digital *</h2>
              </div>

              {!form.fichierUrl ? (
                <div
                  className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-all"
                  onClick={() => digitalFileRef.current?.click()}
                >
                  {uploadingFichier ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 size={28} className="text-purple-400 animate-spin" />
                      <p className="text-sm text-purple-500">Upload en cours…</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload size={28} className="text-purple-300" />
                      <p className="text-sm font-medium text-gray-700">Cliquez pour uploader votre fichier</p>
                      <p className="text-xs text-gray-400">PDF, ZIP, MP3, MP4, DOCX — max 200 Mo</p>
                    </div>
                  )}
                  <input ref={digitalFileRef} type="file" className="hidden"
                    accept=".pdf,.zip,.mp3,.mp4,.docx,.xlsx,.wav,.ogg"
                    onChange={e => e.target.files?.[0] && uploadFichierDigital(e.target.files[0])} />
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{form.fichierNom}</p>
                    <p className="text-xs text-gray-400">{formatTaille(form.fichierTaille)} · Prêt à l'envoi</p>
                  </div>
                  <button onClick={() => { set("fichierUrl", ""); set("fichierNom", ""); set("fichierTaille", 0); }}
                    className="text-red-400 hover:text-red-600 transition-colors"><X size={16} /></button>
                </div>
              )}

              <div>
                <label className="ax-label block mb-1.5">Instructions de téléchargement (optionnel)</label>
                <textarea value={form.instructionsTelechargement} onChange={e => set("instructionsTelechargement", e.target.value)}
                  rows={3} placeholder="Ex: Ouvrez le PDF avec Adobe Reader. Mot de passe: AXSO2024"
                  className={`${inputClass} resize-none`} />
              </div>
            </div>
          )}

          {/* Médias : Images + Vidéos */}
          <div className="ax-card p-6 space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <ImageIcon size={15} className="text-[#F5A623]" />
              <h2 className="text-[13px] font-semibold text-[#111111]">Images & Vidéos</h2>
            </div>

            {/* Images */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-gray-600 text-xs font-medium">Images</label>
                <div className="flex gap-2">
                  <button onClick={genererImageIA} disabled={genImage || !form.nom}
                    className="flex items-center gap-1.5 text-xs bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/20 px-3 py-1.5 rounded-lg hover:bg-[#F5A623]/20 transition-all disabled:opacity-50">
                    {genImage ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />} Générer avec l'IA
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingMedia}
                    className="flex items-center gap-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all">
                    {uploadingMedia ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />} Upload
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*"
                    onChange={e => e.target.files?.[0] && uploadMedia(e.target.files[0], "image")} />
                </div>
              </div>
              <div className="flex gap-2">
                <input value={imageInput} onChange={e => setImageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { const u = imageInput.trim(); if (u) { set("images", [...form.images, u]); setImageInput(""); }}}}
                  placeholder="Ou collez une URL d'image..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50 placeholder:text-gray-400" />
                <button onClick={() => { const u = imageInput.trim(); if (u) { set("images", [...form.images, u]); setImageInput(""); }}}
                  className="px-3 py-2 bg-[#F5A623]/10 border border-[#F5A623]/20 text-[#F5A623] rounded-xl text-sm hover:bg-[#F5A623]/20 transition-all">
                  <Plus size={15} />
                </button>
              </div>
              {form.images.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {form.images.map((img, i) => (
                    <div key={i} className="relative group aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
                      <img src={img} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = "none")} />
                      {i === 0 && <div className="absolute bottom-1 left-1 bg-[#F5A623] text-white text-[9px] px-1.5 py-0.5 rounded font-medium">Principale</div>}
                      <button onClick={() => set("images", form.images.filter((_, j) => j !== i))}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={9} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                  <p className="text-gray-400 text-xs">Uploadez ou collez des URLs d'images ci-dessus</p>
                </div>
              )}
            </div>

            {/* Vidéos */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <label className="text-gray-600 text-xs font-medium">Vidéos produit</label>
                <button onClick={() => videoInputRef.current?.click()} disabled={uploadingMedia}
                  className="flex items-center gap-1.5 text-xs bg-gray-50 text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all">
                  {uploadingMedia ? <Loader2 size={10} className="animate-spin" /> : <Video size={10} />} Upload vidéo MP4
                </button>
                <input ref={videoInputRef} type="file" className="hidden" accept="video/mp4,video/webm"
                  onChange={e => e.target.files?.[0] && uploadMedia(e.target.files[0], "video")} />
              </div>
              {form.videos.length > 0 ? (
                <div className="space-y-2">
                  {form.videos.map((v, i) => (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <Video size={14} className="text-gray-400 flex-shrink-0" />
                      <p className="text-xs text-gray-600 flex-1 truncate">{v}</p>
                      <button onClick={() => set("videos", form.videos.filter((_, j) => j !== i))}
                        className="text-red-400 hover:text-red-600"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-3">Aucune vidéo — max 100 Mo par vidéo</p>
              )}
            </div>
          </div>

          {/* SEO */}
          <div className="ax-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe size={15} className="text-[#F5A623]" />
              <h2 className="text-[13px] font-semibold text-[#111111]">SEO</h2>
            </div>
            <div>
              <label className="ax-label block mb-1.5">Titre méta</label>
              <input value={form.metaTitle} onChange={e => set("metaTitle", e.target.value)} placeholder="Titre pour Google" className={inputClass} />
            </div>
            <div>
              <label className="ax-label block mb-1.5">Méta description</label>
              <textarea value={form.metaDesc} onChange={e => set("metaDesc", e.target.value)} rows={2} placeholder="Description Google..." className={`${inputClass} resize-none`} />
            </div>
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          {/* Catégorie & Tags */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Tag size={14} className="text-[#F5A623]" />
              <h2 className="text-[13px] font-semibold text-[#111111]">Catégorie & Tags</h2>
            </div>
            <select value={form.categorie} onChange={e => set("categorie", e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50">
              <option value="">Sélectionner...</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-2">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const t = tagInput.trim().toLowerCase(); if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]); setTagInput(""); }}}
                placeholder="Ajouter un tag..." className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:border-[#F5A623]/50" />
              <button onClick={() => { const t = tagInput.trim().toLowerCase(); if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]); setTagInput(""); }}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 text-xs">+</button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map(t => (
                  <span key={t} className="flex items-center gap-1 bg-[#F5A623]/10 border border-[#F5A623]/20 text-[#F5A623] text-xs px-2 py-1 rounded-lg">
                    {t}<button onClick={() => set("tags", form.tags.filter(x => x !== t))}><X size={9} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ─── Variantes ─── */}
          {form.type !== "digital" && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-[#111111]">Variantes (taille, couleur, matière…)</h2>
                <span className="text-[11px] bg-[#F5A623]/10 text-[#F5A623] px-2 py-0.5 rounded-full">{variantes.length} variante(s)</span>
              </div>

              {/* Form ajout variante */}
              <div className="bg-[#FAFAFA] rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={varianteForm.nom}
                    onChange={e => setVarianteForm(v => ({ ...v, nom: e.target.value }))}
                    className="border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none bg-white"
                  >
                    {["Taille","Couleur","Matière","Poids","Modèle","Style","Pack"].map(n => <option key={n}>{n}</option>)}
                  </select>
                  <input
                    className="border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none bg-white"
                    placeholder="Valeur (ex: XL, Rouge)"
                    value={varianteForm.valeur}
                    onChange={e => setVarianteForm(v => ({ ...v, valeur: e.target.value }))}
                  />
                  <input
                    className="border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none bg-white"
                    placeholder="SKU (optionnel)"
                    value={varianteForm.sku}
                    onChange={e => setVarianteForm(v => ({ ...v, sku: e.target.value }))}
                  />
                  <input
                    className="border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none bg-white"
                    placeholder={`Prix (défaut: ${form.prix || "0"})`}
                    type="number"
                    value={varianteForm.prix}
                    onChange={e => setVarianteForm(v => ({ ...v, prix: e.target.value }))}
                  />
                  <input
                    className="border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none bg-white"
                    placeholder="Stock"
                    type="number"
                    value={varianteForm.stock}
                    onChange={e => setVarianteForm(v => ({ ...v, stock: e.target.value }))}
                  />
                </div>
                <button
                  onClick={() => {
                    if (!varianteForm.valeur) return;
                    setVariantes(vs => [...vs, { ...varianteForm }]);
                    setVarianteForm(v => ({ ...v, valeur: "", sku: "", prix: "", stock: "0", image: "" }));
                  }}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-[#F5A623]/40 text-[12px] text-[#F5A623] font-semibold hover:bg-[#FFF8EC] transition-all"
                >
                  + Ajouter cette variante
                </button>
              </div>

              {/* Liste variantes ajoutées */}
              {variantes.length > 0 && (
                <div className="space-y-1.5">
                  {variantes.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-[#FAFAFA] rounded-xl px-3 py-2">
                      <span className="text-[11px] bg-[#F5A623]/15 text-[#F5A623] px-2 py-0.5 rounded-full font-medium">{v.nom}</span>
                      <span className="text-[12px] font-semibold text-[#111] flex-1">{v.valeur}</span>
                      {v.sku && <span className="text-[10px] text-[#AAA] font-mono">{v.sku}</span>}
                      <span className="text-[12px] text-[#F5A623] font-bold">{v.prix || form.prix} XAF</span>
                      <span className="text-[11px] text-[#888]">S:{v.stock}</span>
                      <button onClick={() => setVariantes(vs => vs.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 ml-1">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Options */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
            <h2 className="text-[13px] font-semibold text-[#111111] mb-1">Options</h2>
            {[
              { label: "Produit actif", desc: "Visible sur la boutique", key: "actif" },
              { label: "Mis en avant", desc: "Affiché en page d'accueil", key: "featured" },
            ].map(opt => (
              <div key={opt.key} className="flex items-center justify-between">
                <div>
                  <p className="text-gray-800 text-sm">{opt.label}</p>
                  <p className="text-gray-400 text-xs">{opt.desc}</p>
                </div>
                <button onClick={() => set(opt.key, !(form as any)[opt.key])}
                  className={`w-11 h-6 rounded-full transition-all relative ${(form as any)[opt.key] ? "bg-[#F5A623]" : "bg-gray-200"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${(form as any)[opt.key] ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            ))}
            {form.type === "physique" && (
              <div className="pt-2">
                <label className="ax-label block mb-1.5">Poids (kg)</label>
                <input type="number" value={form.poids} onChange={e => set("poids", e.target.value)} placeholder="0.5" min="0" step="0.01"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50" />
              </div>
            )}
          </div>

          {/* Aperçu */}
          {(form.nom || form.images[0]) && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <p className="text-gray-400 text-xs px-4 pt-3 pb-2">Aperçu boutique</p>
              <div className="aspect-square bg-gray-50 overflow-hidden">
                {form.images[0] ? <img src={form.images[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package size={40} className="text-gray-300" /></div>}
              </div>
              <div className="p-4">
                <p className="font-medium text-gray-800 text-sm line-clamp-2">{form.nom || "Nom du produit"}</p>
                {form.prix && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[#F5A623] font-bold text-sm">{form.prix} FCFA</span>
                    {form.prixCompare && <span className="text-gray-400 text-xs line-through">{form.prixCompare}</span>}
                  </div>
                )}
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: form.type === "digital" ? "rgba(124,58,237,0.1)" : form.type === "dropshipping" ? "rgba(52,211,153,0.1)" : "rgba(245,166,35,0.1)",
                    color: form.type === "digital" ? "#1B2A4A" : form.type === "dropshipping" ? "#059669" : "#F5A623",
                  }}>
                  {form.type === "digital" ? <><FileText size={11} className="inline-block mr-1" />Digital</> : form.type === "dropshipping" ? <><Truck size={11} className="inline-block mr-1" />Dropshipping</> : <><Package size={11} className="inline-block mr-1" />Physique</>}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <BarcodeCaptureModal
        open={scanBarcodeOuvert}
        onClose={() => setScanBarcodeOuvert(false)}
        onDetect={code => { set("codeBarres", code); toast.success("Code-barres scanné !"); }}
      />
    </div>
  );
}
