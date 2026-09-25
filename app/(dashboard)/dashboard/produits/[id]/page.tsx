"use client";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, Trash2, X, Plus, Sparkles, Loader2,
  Package, Image as ImageIcon, Tag, BarChart2, Globe,
  Upload, Video, FileText, Truck, Download, ExternalLink, Info, Zap,
  HelpCircle, ListOrdered, Eye, EyeOff, ShoppingCart, ScanLine, RefreshCw,
} from "lucide-react";
import { VariantesPrixManager } from "@/components/dashboard/VariantesPrixManager";
import ClesLicenceManager from "@/components/dashboard/ClesLicenceManager";
import FormationManager from "@/components/dashboard/FormationManager";
import FaqManager, { type FaqItem } from "@/components/dashboard/FaqManager";
import ChampsCommandeManager, { type ChampCommande } from "@/components/dashboard/ChampsCommandeManager";
import PublicationAssistant from "@/components/dashboard/PublicationAssistant";
import { BarcodeCaptureModal } from "@/components/dashboard/BarcodeCaptureModal";
import { BarcodeLabelPreview } from "@/components/dashboard/produits/BarcodeLabelPreview";
import { genererEAN13 } from "@/lib/barcode";
import Link from "next/link";
import { toast } from "sonner";
import { envoyerImagesCarrees, dimensions, estCarre, MESSAGE_REFUS } from "@/lib/images-carrees";

import { useDevise } from "@/components/dashboard/DeviseProvider";
const CATEGORIES = [
  "Mode & Vêtements", "Beauté & Cosmétiques", "Alimentation & Épicerie",
  "Artisanat & Art", "Électronique", "Maison & Décoration",
  "Santé & Bien-être", "Sport & Loisirs", "Formation & Cours",
  "Logiciel & App", "Musique & Audio", "Photo & Vidéo", "Autre",
];

const TYPES_PRODUIT = [
  { id: "physique",     icon: Package,  label: "Physique",      desc: "Stock, livraison, poids",                 color: "#F5A623" },
  { id: "digital",      icon: Download, label: "Digital",       desc: "PDF, vidéo, logiciel — livré par email",  color: "#1B2A4A" },
  { id: "dropshipping", icon: Truck,    label: "Dropshipping",  desc: "Fournisseur externe, envoi direct",       color: "#34d399" },
] as const;

function formatTaille(octets: number) {
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(1)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

type FormState = {
  nom: string; slug: string; description: string;
  prix: string; prixCompare: string; cout: string; stock: string; sku: string; codeBarres: string;
  categorie: string; tags: string[]; images: string[]; videos: string[];
  actif: boolean; featured: boolean; poids: string;
  metaTitle: string; metaDesc: string; ogImage: string;
  masquerVentes: boolean; visibleListage: boolean; texteBoutonAchat: string;
  faq: FaqItem[]; champsCommande: ChampCommande[];
  type: "physique" | "digital" | "dropshipping" | "fichier" | "licence" | "bundle" | "formation";
  fichierUrl: string; fichierNom: string; fichierTaille: number; instructionsTelechargement: string;
  prixFournisseur: string; urlFournisseur: string; nomFournisseur: string;
  affiliationActive: boolean; tauxCommissionAff: string;
};

export default function EditProduitPage() {
  const { devise, fmt } = useDevise();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [genIA, setGenIA] = useState(false);
  const [genImage, setGenImage] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingFichier, setUploadingFichier] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [imageInput, setImageInput] = useState("");
  const [stats, setStats] = useState({ ventes: 0, vues: 0, avis: 0, commandes: 0 });
    const [boutiqueSlug, setBoutiqueSlug] = useState("");
  const [variantes, setVariantes] = useState<{ id?: string; nom: string; valeur: string; sku: string; prix: string; stock: string; image: string; actif: boolean }[]>([]);
  const [varianteForm, setVarianteForm] = useState({ nom: "Taille", valeur: "", sku: "", prix: "", stock: "0", image: "" });
  const [savingVariante, setSavingVariante] = useState(false);
  const [showPubAssistant, setShowPubAssistant] = useState(false);
  const [scanBarcodeOuvert, setScanBarcodeOuvert] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const digitalFileRef = useRef<HTMLInputElement>(null);

  const [form, setFormState] = useState<FormState>({
    nom: "", slug: "", description: "", prix: "", prixCompare: "", cout: "", stock: "0", sku: "", codeBarres: "",
    categorie: "", tags: [], images: [], videos: [],
    actif: true, featured: false, poids: "",
    metaTitle: "", metaDesc: "", ogImage: "",
    masquerVentes: false, visibleListage: true, texteBoutonAchat: "",
    faq: [], champsCommande: [],
    type: "physique",
    fichierUrl: "", fichierNom: "", fichierTaille: 0, instructionsTelechargement: "",
    prixFournisseur: "", urlFournisseur: "", nomFournisseur: "",
    affiliationActive: false, tauxCommissionAff: "",
  });

  useEffect(() => {
    fetch("/api/tenants/moi").then(r => r.json()).then(d => {
      if (d.tenant?.slug) setBoutiqueSlug(d.tenant.slug);
    }).catch(() => {});

    fetch(`/api/produits/${id}`)
      .then(r => r.json())
      .then(d => {
        const p = d.produit;
        setStats({ ventes: p.ventes ?? 0, vues: p.vues ?? 0, avis: p._count?.avis ?? 0, commandes: p._count?.lignesCommande ?? 0 });
        setFormState({
          nom: p.nom ?? "",
          slug: p.slug ?? "",
          description: p.description ?? "",
          prix: p.prix?.toString() ?? "",
          prixCompare: p.prixCompare?.toString() ?? "",
          cout: p.cout?.toString() ?? "",
          stock: p.stock?.toString() ?? "0",
          sku: p.sku ?? "",
          codeBarres: p.codeBarres ?? "",
          categorie: p.categorie ?? "",
          tags: p.tags ?? [],
          images: p.images ?? [],
          videos: p.videos ?? [],
          actif: p.actif ?? true,
          featured: p.featured ?? false,
          poids: p.poids?.toString() ?? "",
          metaTitle: p.metaTitle ?? "",
          metaDesc: p.metaDesc ?? "",
          ogImage: p.ogImage ?? "",
          masquerVentes: p.masquerVentes ?? false,
          visibleListage: p.visibleListage ?? true,
          texteBoutonAchat: p.texteBoutonAchat ?? "",
          faq: Array.isArray(p.faq) ? p.faq : [],
          champsCommande: Array.isArray(p.champsCommande) ? p.champsCommande : [],
          type: p.type ?? "physique",
          fichierUrl: p.fichierUrl ?? "",
          fichierNom: p.fichierNom ?? "",
          fichierTaille: p.fichierTaille ?? 0,
          instructionsTelechargement: p.instructionsTelechargement ?? "",
          prixFournisseur: p.prixFournisseur?.toString() ?? "",
          urlFournisseur: p.urlFournisseur ?? "",
          nomFournisseur: p.nomFournisseur ?? "",
          affiliationActive: p.affiliationActive ?? false,
          tauxCommissionAff: p.tauxCommissionAff ? String(Math.round(p.tauxCommissionAff * 100)) : "",
        });
        // Load variantes
        if (p.variantes?.length) {
          setVariantes(p.variantes.map((v: any) => ({
            id: v.id, nom: v.nom, valeur: v.valeur,
            sku: v.sku ?? "", prix: v.prix?.toString() ?? "", stock: v.stock?.toString() ?? "0",
            image: v.image ?? "", actif: v.actif ?? true,
          })));
        }
        setLoading(false);
      });
  }, [id]);

  async function ajouterVariante() {
    if (!varianteForm.valeur) return;
    setSavingVariante(true);
    try {
      const res = await fetch(`/api/produits/${id}/variantes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: varianteForm.nom, valeur: varianteForm.valeur,
          sku: varianteForm.sku || null,
          prix: varianteForm.prix ? parseFloat(varianteForm.prix) : null,
          stock: parseInt(varianteForm.stock) || 0,
          image: varianteForm.image || null,
        }),
      });
      const d = await res.json();
      setVariantes(vs => [...vs, { ...varianteForm, id: d.variante?.id, actif: true }]);
      setVarianteForm(v => ({ ...v, valeur: "", sku: "", prix: "", stock: "0", image: "" }));
      toast.success("Variante ajoutée");
    } catch { toast.error("Erreur ajout variante"); }
    finally { setSavingVariante(false); }
  }

  async function supprimerVariante(varianteId: string | undefined, idx: number) {
    if (!varianteId) { setVariantes(vs => vs.filter((_, i) => i !== idx)); return; }
    await fetch(`/api/produits/${id}/variantes?varianteId=${varianteId}`, { method: "DELETE" }).catch(() => null);
    setVariantes(vs => vs.filter((_, i) => i !== idx));
    toast.success("Variante supprimée");
  }

  function set(field: string, value: any) {
    setFormState(f => ({ ...f, [field]: value }));
  }

  async function changerType(newType: "physique" | "digital" | "dropshipping") {
    set("type", newType);
    try {
      await fetch(`/api/produits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: newType }),
      });
      toast.success(`Type changé → ${newType === "digital" ? "Digital" : newType === "dropshipping" ? "Dropshipping" : "Physique"}`);
    } catch {
      toast.error("Erreur lors du changement de type");
    }
  }

  const marge = form.prixFournisseur && form.prix
    ? Math.round((1 - parseFloat(form.prixFournisseur) / parseFloat(form.prix)) * 100) : null;
  const margeCout = form.cout && form.prix
    ? Math.round((1 - parseFloat(form.cout) / parseFloat(form.prix)) * 100) : null;

  // Images du produit : plusieurs à la fois, carrées uniquement (lib/images-carrees.ts).
  async function ajouterImages(fichiers: File[]) {
    if (!fichiers.length) return;
    setUploadingMedia(true);
    try {
      const { urls, refusees, erreur } = await envoyerImagesCarrees(fichiers);
      if (erreur) toast.error(erreur);
      if (urls.length) { setFormState(f => ({ ...f, images: [...f.images, ...urls] })); toast.success(`${urls.length} image${urls.length > 1 ? "s" : ""} ajoutée${urls.length > 1 ? "s" : ""}`); }
      if (refusees.length) toast.error(MESSAGE_REFUS(refusees));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function ajouterImageUrl() {
    const u = imageInput.trim();
    if (!u) return;
    const d = await dimensions(u).catch(() => null);
    if (!d) return void toast.error("Image introuvable à cette adresse");
    if (!estCarre(d.l, d.h)) return void toast.error(MESSAGE_REFUS([`${d.l}×${d.h}`]));
    setFormState(f => ({ ...f, images: [...f.images, u] }));
    setImageInput("");
  }

  async function uploadMedia(file: File, type: "image" | "video") {
    const fd = new FormData(); fd.append("file", file);
    setUploadingMedia(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur upload");
      if (type === "image") set("images", [...form.images, data.url]);
      else set("videos", [...form.videos, data.url]);
      toast.success(`${type === "image" ? "Image" : "Vidéo"} uploadée`);
    } catch (e: any) { toast.error(e.message); }
    finally { setUploadingMedia(false); }
  }

  async function uploadFichierDigital(file: File) {
    const fd = new FormData(); fd.append("file", file);
    setUploadingFichier(true);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur upload");
      set("fichierUrl", data.url); set("fichierNom", file.name); set("fichierTaille", file.size);
      toast.success("Fichier digital uploadé !");
    } catch (e: any) { toast.error(e.message); }
    finally { setUploadingFichier(false); }
  }

  async function genererDescription() {
    if (!form.nom) { toast.error("Entrez d'abord le nom du produit"); return; }
    setGenIA(true);
    try {
      const res = await fetch("/api/ai/description", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: form.nom, categorie: form.categorie }),
      });
      const data = await res.json();
      if (data.description) set("description", data.description);
    } catch { toast.error("Erreur IA"); }
    finally { setGenIA(false); }
  }

  async function genererImageIA() {
    if (!form.nom) { toast.error("Entrez d'abord le nom du produit"); return; }
    setGenImage(true);
    try {
      const prompt = `${form.nom}, ${form.categorie || "produit"}, professional product photo, clean white background, studio lighting, 4K, sharp`;
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=800&nologo=true&model=flux&enhance=true&seed=${Math.floor(Math.random() * 999999)}`;
      set("images", [...form.images, url]);
      toast.success("Image IA générée !");
    } catch { toast.error("Erreur génération"); }
    finally { setGenImage(false); }
  }

  async function sauvegarder() {
    if (!form.nom || !form.prix) { toast.error("Nom et prix obligatoires"); return; }
    setSaving(true);
    try {
      const payload: any = {
        nom: form.nom, slug: form.slug, description: form.description || null,
        prix: parseFloat(form.prix),
        prixCompare: form.prixCompare ? parseFloat(form.prixCompare) : null,
        stock: form.type === "digital" ? 99999 : parseInt(form.stock) || 0,
        sku: form.sku || null, codeBarres: form.codeBarres || null, categorie: form.categorie || null,
        tags: form.tags, images: form.images, videos: form.videos,
        actif: form.actif, featured: form.featured, type: form.type,
        metaTitle: form.metaTitle || null, metaDesc: form.metaDesc || null,
        ogImage: form.ogImage || null,
        masquerVentes: form.masquerVentes,
        visibleListage: form.visibleListage,
        texteBoutonAchat: form.texteBoutonAchat || null,
        affiliationActive: form.affiliationActive,
        tauxCommissionAff: form.affiliationActive && form.tauxCommissionAff ? parseFloat(form.tauxCommissionAff) / 100 : null,
      };
      if (form.type === "physique") {
        payload.poids = form.poids ? parseFloat(form.poids) : null;
        payload.cout = form.cout ? parseFloat(form.cout) : null;
      }
      if (form.type === "digital") {
        payload.fichierUrl = form.fichierUrl || null;
        payload.fichierNom = form.fichierNom || null;
        payload.fichierTaille = form.fichierTaille || null;
        payload.instructionsTelechargement = form.instructionsTelechargement || null;
      }
      if (form.type === "dropshipping") {
        payload.prixFournisseur = form.prixFournisseur ? parseFloat(form.prixFournisseur) : null;
        payload.urlFournisseur = form.urlFournisseur || null;
        payload.nomFournisseur = form.nomFournisseur || null;
      }
      const res = await fetch(`/api/produits/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      toast.success("Produit mis à jour !");
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function supprimer() {
    if (!confirm("Supprimer ce produit définitivement ?")) return;
    setDeleting(true);
    const res = await fetch(`/api/produits/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Produit supprimé"); router.push("/dashboard/produits"); }
    else { toast.error("Erreur lors de la suppression"); setDeleting(false); }
  }

  const inputClass = "w-full bg-white border border-[#E8E8E8] rounded-2xl px-4 py-3 text-[#111111] text-[13px] outline-none focus:border-[#F5A623]/50 focus:ring-2 focus:ring-[#F5A623]/8 placeholder:text-[#CCCCCC] transition-all";

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <Loader2 size={24} className="animate-spin text-[#F5A623]" />
    </div>
  );

  return (
    <>
    <div className="max-w-4xl space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/produits"
            className="w-9 h-9 rounded-xl bg-white border border-[#E8E8E8] flex items-center justify-center text-[#888] hover:text-[#111] hover:border-[#CCC] transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-[18px] font-bold text-[#111111] tracking-tight line-clamp-1">{form.nom || "Éditer le produit"}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-[#AAAAAA]">{stats.ventes} ventes</span>
              <span className="text-[#DDDDDD]">·</span>
              <span className="text-[11px] text-[#AAAAAA]">{stats.vues} vues</span>
              <span className="text-[#DDDDDD]">·</span>
              <span className="text-[11px] text-[#AAAAAA]">{stats.avis} avis</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={supprimer} disabled={deleting}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-2 rounded-2xl border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2] transition-all disabled:opacity-50">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Supprimer
          </button>
          <button
            onClick={() => {
              if (!form.actif) { setShowPubAssistant(true); }
              else { set("actif", false); }
            }}
            className="text-[12px] font-semibold px-3.5 py-2 rounded-2xl border transition-all"
            style={form.actif
              ? { background: "#F0FDF4", borderColor: "#BBF7D0", color: "#16A34A" }
              : { background: "#F9F9F9", borderColor: "#E8E8E8", color: "#888888" }}>
            {form.actif ? "✓ Actif" : "Publier"}
          </button>
          <button onClick={sauvegarder} disabled={saving}
            className="flex items-center gap-1.5 text-[12px] font-semibold px-4 py-2 rounded-2xl text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #F5A623, #D4911A)", boxShadow: "0 4px 12px rgba(245,166,35,0.25)" }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Enregistrer
          </button>
        </div>
      </div>

      {/* ── Sélecteur de type ── */}
      <div className="grid grid-cols-3 gap-3">
        {TYPES_PRODUIT.map(t => {
          const Icone = t.icon;
          const actif = form.type === t.id;
          return (
            <button key={t.id} onClick={() => changerType(t.id)}
              className="flex items-start gap-3 p-4 rounded-2xl border text-left transition-all"
              style={{
                borderColor: actif ? `${t.color}50` : "#e5e7eb",
                background: actif ? `${t.color}08` : "white",
                boxShadow: actif ? `0 0 20px ${t.color}20` : "none",
              }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${t.color}15` }}>
                <Icone size={18} style={{ color: t.color }} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{t.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
              </div>
              {actif && (
                <div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: t.color }}>
                  <span className="text-white text-[10px] font-bold">✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Colonne principale ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Infos générales */}
          <div className="ax-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Package size={15} className="text-[#F5A623]" />
              <h2 className="text-[13px] font-semibold text-[#111111]">Informations générales</h2>
            </div>
            <div>
              <label className="ax-label block mb-1.5">Nom du produit *</label>
              <input value={form.nom} onChange={e => set("nom", e.target.value)} maxLength={120} className={inputClass} />
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
                <button onClick={genererDescription} disabled={genIA}
                  className="flex items-center gap-1 text-[#F5A623] text-xs hover:text-[#d4820a] transition-colors disabled:opacity-50">
                  {genIA ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} Régénérer avec l'IA
                </button>
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
                <input type="number" value={form.prix} onChange={e => set("prix", e.target.value)} min="0" className={inputClass} />
              </div>
              <div>
                <label className="ax-label block mb-1.5">Prix barré (promo)</label>
                <input type="number" value={form.prixCompare} onChange={e => set("prixCompare", e.target.value)} min="0" className={inputClass} />
              </div>
              {form.type !== "digital" && (
                <>
                  <div>
                    <label className="ax-label block mb-1.5">Stock</label>
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
                      <button
                        type="button"
                        onClick={() => { set("codeBarres", genererEAN13()); toast.success("Code-barres généré — pense à enregistrer, puis imprime l'étiquette ci-dessous"); }}
                        title="Générer un code-barres pour ce produit"
                        className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-semibold text-[12.5px] text-gray-700 border border-gray-200 shrink-0 transition-all hover:bg-gray-50"
                      >
                        <RefreshCw size={14} /> Générer
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1.5">Pas de code d'origine ? Génère-en un, imprime l'étiquette et colle-la sur le produit.</p>
                    <BarcodeLabelPreview value={form.codeBarres} nom={form.nom || "Produit"} prix={form.prix ? `${fmt(Number(form.prix) || 0)}` : undefined} />
                  </div>
                </>
              )}
              {form.type === "physique" && (
                <div>
                  <label className="ax-label block mb-1.5">Prix d'achat (coût)</label>
                  <input type="number" value={form.cout} onChange={e => set("cout", e.target.value)} min="0" placeholder="0" className={inputClass} />
                  <p className="text-[11px] text-gray-400 mt-1">Utilisé pour calculer la vraie rentabilité (marge, bénéfices) dans le module Point de vente</p>
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

          {/* Programme d'affiliation */}
          <div className="ax-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-[#F5A623]" />
                <h2 className="text-[13px] font-semibold text-[#111111]">Programme d'affiliation</h2>
              </div>
              <button type="button" onClick={() => set("affiliationActive", !form.affiliationActive)}
                className="w-9 h-5 rounded-full relative transition-all flex-shrink-0"
                style={{ background: form.affiliationActive ? "#10b981" : "#E5E5E5" }}>
                <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: form.affiliationActive ? "18px" : "2px" }} />
              </button>
            </div>
            <p className="text-[11.5px] text-gray-400">
              Activer une commission spécifique pour ce produit — remplace le taux par défaut du programme d'affiliation pour vos affiliés.
            </p>
            {form.affiliationActive && (
              <div>
                <label className="ax-label block mb-1.5">Taux de commission affilié (%)</label>
                <input type="number" value={form.tauxCommissionAff} onChange={e => set("tauxCommissionAff", e.target.value)} min="0" max="100" placeholder="20" className={inputClass} />
                <p className="text-[10.5px] text-gray-400 mt-1.5">Ex : 20 = 20% du montant de la ligne reversés à l'affilié sur chaque vente de ce produit.</p>
              </div>
            )}
          </div>

          {/* Section DROPSHIPPING */}
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

          {/* Section DIGITAL */}
          {form.type === "digital" && (
            <div className="bg-white border border-purple-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText size={15} className="text-purple-500" />
                <h2 className="text-[13px] font-semibold text-[#111111]">Fichier digital</h2>
              </div>
              {!form.fichierUrl ? (
                <div
                  className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-all"
                  onClick={() => digitalFileRef.current?.click()}>
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
                    <p className="text-sm font-semibold text-gray-800 truncate">{form.fichierNom || "Fichier uploadé"}</p>
                    <p className="text-xs text-gray-400">{form.fichierTaille ? formatTaille(form.fichierTaille) : "Taille inconnue"} · Prêt à l'envoi</p>
                  </div>
                  <button onClick={() => { set("fichierUrl", ""); set("fichierNom", ""); set("fichierTaille", 0); }}
                    className="text-red-400 hover:text-red-600 transition-colors"><X size={16} /></button>
                </div>
              )}
              <div>
                <label className="ax-label block mb-1.5">Instructions de téléchargement (optionnel)</label>
                <textarea value={form.instructionsTelechargement} onChange={e => set("instructionsTelechargement", e.target.value)}
                  rows={3} placeholder="Ex: Ouvrez le PDF avec Adobe Reader." className={`${inputClass} resize-none`} />
              </div>
            </div>
          )}

          {/* Médias */}
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
                    {uploadingMedia ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />} Importer (images carrées)
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*" multiple
                    onChange={e => ajouterImages(Array.from(e.target.files ?? []))} />
                </div>
              </div>
              <div className="flex gap-2">
                <input value={imageInput} onChange={e => setImageInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") ajouterImageUrl(); }}
                  placeholder="Ou collez une URL d'image..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50 placeholder:text-gray-400" />
                <button onClick={ajouterImageUrl}
                  className="px-3 py-2 bg-[#F5A623]/10 border border-[#F5A623]/20 text-[#F5A623] rounded-xl hover:bg-[#F5A623]/20 transition-all">
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
                  {uploadingMedia ? <Loader2 size={10} className="animate-spin" /> : <Video size={10} />} Upload vidéo
                </button>
                <input ref={videoInputRef} type="file" className="hidden" accept="video/mp4,video/webm"
                  onChange={e => e.target.files?.[0] && uploadMedia(e.target.files[0], "video")} />
              </div>
              {(form.videos ?? []).length > 0 ? (
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
                <p className="text-xs text-gray-400 text-center py-3">Aucune vidéo</p>
              )}
            </div>
          </div>

          {/* SEO & Open Graph */}
          <div className="ax-card p-6 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Globe size={15} className="text-[#F5A623]" />
              <h2 className="text-[13px] font-semibold text-[#111111]">SEO & Open Graph</h2>
            </div>
            <div>
              <label className="ax-label block mb-1.5">Titre méta</label>
              <input value={form.metaTitle} onChange={e => set("metaTitle", e.target.value)} placeholder="Titre pour Google (max 60 car.)" className={inputClass} />
              {form.metaTitle && <p className={`text-[10px] mt-1 ${form.metaTitle.length > 60 ? "text-red-400" : "text-gray-400"}`}>{form.metaTitle.length}/60</p>}
            </div>
            <div>
              <label className="ax-label block mb-1.5">Méta description</label>
              <textarea value={form.metaDesc} onChange={e => set("metaDesc", e.target.value)} rows={2} placeholder="Description Google (max 155 car.)…" className={`${inputClass} resize-none`} />
              {form.metaDesc && <p className={`text-[10px] mt-1 ${form.metaDesc.length > 155 ? "text-red-400" : "text-gray-400"}`}>{form.metaDesc.length}/155</p>}
            </div>
            <div>
              <label className="ax-label block mb-1.5">Image Open Graph (partage réseaux sociaux)</label>
              <input value={form.ogImage} onChange={e => set("ogImage", e.target.value)} placeholder="URL de l'image (1200×630px recommandé)" className={inputClass} />
              {form.ogImage && (
                <div className="mt-2 rounded-xl overflow-hidden border border-gray-200 h-20">
                  <img src={form.ogImage} alt="OG" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = "none"; }} />
                </div>
              )}
              <p className="text-[10px] text-gray-400 mt-1">Si vide, la première image produit est utilisée.</p>
            </div>
          </div>

          {/* Tarification avancée (variantes de prix) */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <VariantesPrixManager
              produitId={id}
              boutiqueSlug={boutiqueSlug}
              produitSlug={form.slug}
              devise={devise}
            />
          </div>

          {/* Clés de licence */}
          {form.type === "licence" && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <ClesLicenceManager produitId={id} />
            </div>
          )}

          {/* Formation — chapitres et leçons */}
          {form.type === "formation" && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <FormationManager produitId={id} />
            </div>
          )}

          {/* FAQ */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-5 pb-1">
              <HelpCircle size={15} className="text-[#F5A623]" />
              <h2 className="text-[13px] font-semibold text-[#111111]">FAQ</h2>
            </div>
            <FaqManager
              produitId={id}
              initial={form.faq}
              nom={form.nom}
              description={form.description}
            />
          </div>

          {/* Champs à la commande */}
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 pt-5 pb-1">
              <ListOrdered size={15} className="text-[#F5A623]" />
              <h2 className="text-[13px] font-semibold text-[#111111]">Champs personnalisés à la commande</h2>
            </div>
            <ChampsCommandeManager
              produitId={id}
              initial={form.champsCommande}
            />
          </div>
        </div>

        {/* ── Colonne latérale ── */}
        <div className="space-y-5">

          {/* Stats */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-[13px] font-semibold text-[#111111] mb-3">Statistiques</h2>
            <div className="space-y-3">
              {[
                { label: "Ventes totales", value: stats.ventes, color: "text-[#F5A623]" },
                { label: "Vues totales", value: stats.vues, color: "text-[#D4911A]" },
                { label: "Avis reçus", value: stats.avis, color: "text-yellow-500" },
                { label: "Dans commandes", value: stats.commandes, color: "text-emerald-500" },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">{s.label}</span>
                  <span className={`font-bold text-sm ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

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
                placeholder="Ajouter un tag..."
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:border-[#F5A623]/50 placeholder:text-gray-400" />
              <button onClick={() => { const t = tagInput.trim().toLowerCase(); if (t && !form.tags.includes(t)) set("tags", [...form.tags, t]); setTagInput(""); }}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 text-xs">+</button>
            </div>
            {(form.tags ?? []).length > 0 && (
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
                <h2 className="text-[13px] font-semibold text-[#111111]">Variantes</h2>
                <span className="text-[11px] bg-[#F5A623]/10 text-[#F5A623] px-2 py-0.5 rounded-full">{variantes.length} variante(s)</span>
              </div>
              {/* Existantes */}
              {variantes.length > 0 && (
                <div className="space-y-1.5">
                  {variantes.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#FAFAFA] rounded-xl px-3 py-2">
                      <span className="text-[11px] bg-[#F5A623]/15 text-[#F5A623] px-2 py-0.5 rounded-full font-medium">{v.nom}</span>
                      <span className="text-[12px] font-semibold text-[#111] flex-1">{v.valeur}</span>
                      {v.sku && <span className="text-[10px] text-[#AAA] font-mono">{v.sku}</span>}
                      <span className="text-[12px] text-[#F5A623] font-bold">{v.prix || form.prix} XAF</span>
                      <span className="text-[11px] text-[#888]">S:{v.stock}</span>
                      <button onClick={() => supprimerVariante(v.id, idx)} className="text-red-400 hover:text-red-600 ml-1 text-xs">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {/* Formulaire ajout */}
              <div className="bg-[#FAFAFA] rounded-xl p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select value={varianteForm.nom} onChange={e => setVarianteForm(v => ({ ...v, nom: e.target.value }))}
                    className="border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none bg-white">
                    {["Taille","Couleur","Matière","Poids","Modèle","Style","Pack"].map(n => <option key={n}>{n}</option>)}
                  </select>
                  <input className="border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none bg-white" placeholder="Valeur (ex: XL, Rouge)"
                    value={varianteForm.valeur} onChange={e => setVarianteForm(v => ({ ...v, valeur: e.target.value }))} />
                  <input className="border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none bg-white" placeholder="SKU (optionnel)"
                    value={varianteForm.sku} onChange={e => setVarianteForm(v => ({ ...v, sku: e.target.value }))} />
                  <input className="border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none bg-white" placeholder={`Prix (défaut: ${form.prix})`} type="number"
                    value={varianteForm.prix} onChange={e => setVarianteForm(v => ({ ...v, prix: e.target.value }))} />
                  <input className="border border-[#E8E8E8] rounded-xl px-3 py-2 text-[12px] outline-none bg-white" placeholder="Stock" type="number"
                    value={varianteForm.stock} onChange={e => setVarianteForm(v => ({ ...v, stock: e.target.value }))} />
                </div>
                <button onClick={ajouterVariante} disabled={!varianteForm.valeur || savingVariante}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-[#F5A623]/40 text-[12px] text-[#F5A623] font-semibold hover:bg-[#FFF8EC] transition-all disabled:opacity-40">
                  {savingVariante ? "..." : "+ Ajouter cette variante"}
                </button>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
            <h2 className="text-[13px] font-semibold text-[#111111] mb-1">Options</h2>
            {[
              { label: "Produit actif", desc: "Accessible et visible sur la boutique", key: "actif", icon: <Eye size={12} /> },
              { label: "Mis en avant", desc: "Affiché en page d'accueil", key: "featured", icon: null },
              { label: "Visible dans le catalogue", desc: "Masqué de la liste, accessible par lien direct", key: "visibleListage", icon: <EyeOff size={12} /> },
              { label: "Masquer le compteur de ventes", desc: "Le nombre d'achats ne s'affiche pas", key: "masquerVentes", icon: null },
            ].map(opt => (
              <div key={opt.key} className="flex items-center justify-between">
                <div>
                  <p className="text-gray-800 text-sm">{opt.label}</p>
                  <p className="text-gray-400 text-xs">{opt.desc}</p>
                </div>
                <button onClick={() => set(opt.key, !(form as any)[opt.key])}
                  className={`w-11 h-6 rounded-full transition-all relative flex-shrink-0 ${(form as any)[opt.key] ? "bg-[#F5A623]" : "bg-gray-200"}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${(form as any)[opt.key] ? "left-5" : "left-0.5"}`} />
                </button>
              </div>
            ))}

            {/* Texte bouton achat */}
            <div className="pt-2 border-t border-gray-100">
              <label className="ax-label block mb-1.5 flex items-center gap-1.5">
                <ShoppingCart size={12} className="text-gray-400" /> Texte du bouton d'achat
              </label>
              <input
                value={form.texteBoutonAchat}
                onChange={e => set("texteBoutonAchat", e.target.value)}
                placeholder="Acheter maintenant"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50"
              />
            </div>

            {form.type === "physique" && (
              <div className="pt-2 border-t border-gray-100">
                <label className="ax-label block mb-1.5">Poids (kg)</label>
                <input type="number" value={form.poids} onChange={e => set("poids", e.target.value)} placeholder="0.5" min="0" step="0.01"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-[#F5A623]/50" />
              </div>
            )}
          </div>

          {/* Aperçu */}
          {(form.nom || (form.images ?? []).length > 0) && (
            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              <p className="text-gray-400 text-xs px-4 pt-3 pb-2">Aperçu boutique</p>
              <div className="aspect-square bg-gray-50 overflow-hidden">
                {form.images?.[0]
                  ? <img src={form.images[0]} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center">{form.type === "digital" ? <Download size={40} className="text-gray-300" /> : <Package size={40} className="text-gray-300" />}</div>}
              </div>
              <div className="p-4">
                <p className="font-medium text-gray-800 text-sm line-clamp-2">{form.nom || "Nom du produit"}</p>
                {form.prix && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[#F5A623] font-bold text-sm">{form.prix} {devise}</span>
                    {form.prixCompare && <span className="text-gray-400 text-xs line-through">{form.prixCompare}</span>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Publication assistant modal */}
    {showPubAssistant && (
      <PublicationAssistant
        produitId={id}
        nom={form.nom}
        description={form.description}
        images={form.images}
        prix={form.prix}
        metaTitle={form.metaTitle}
        faqCount={form.faq.length}
        onClose={() => setShowPubAssistant(false)}
        onPublier={async () => {
          set("actif", true);
          await sauvegarder();
        }}
      />
    )}

    <BarcodeCaptureModal
      open={scanBarcodeOuvert}
      onClose={() => setScanBarcodeOuvert(false)}
      onDetect={code => { set("codeBarres", code); toast.success("Code-barres scanné !"); }}
    />
    </>
  );
}
