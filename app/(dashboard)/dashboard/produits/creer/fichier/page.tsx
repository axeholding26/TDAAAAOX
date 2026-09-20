"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Check, Upload, X, Loader2, ImageIcon,
  FileDown, Lock, Droplets, Hash, Info, Eye, EyeOff, Sparkles,
  AlertCircle, GripVertical, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { slugify, formatMontant } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Fichier = { id?: string; nom: string; url: string; taille: number; mimeType: string; ordre: number };

type EtatWizard = {
  // Étape 1 — Infos
  nom: string;
  slug: string;
  description: string;
  prix: string;
  prixCompare: string;
  images: string[];
  categorie: string;
  tags: string;
  metaTitle: string;
  metaDesc: string;
  // Étape 2 — Config
  limitAchats: string;
  motDePasse: string;
  montrerMDP: boolean;
  filigrane: boolean;
  instructionsAchat: string;
  // Étape 3 — Fichiers
  fichiers: Fichier[];
};

const ETAT_INITIAL: EtatWizard = {
  nom: "", slug: "", description: "", prix: "", prixCompare: "",
  images: [], categorie: "", tags: "", metaTitle: "", metaDesc: "",
  limitAchats: "", motDePasse: "", montrerMDP: false, filigrane: false,
  instructionsAchat: "", fichiers: [],
};

const ETAPES = ["Infos & prix", "Configuration", "Fichiers", "Publication"];

const CATEGORIES = [
  "Ebooks & Guides", "Formations & Cours", "Logiciels & Scripts", "Templates & Maquettes",
  "Audio & Musique", "Vidéo", "Photos & Visuels", "Données & Datasets", "Autre",
];

function formatTaille(o: number) {
  if (o < 1024) return `${o} o`;
  if (o < 1024 ** 2) return `${(o / 1024).toFixed(1)} Ko`;
  return `${(o / 1024 ** 2).toFixed(1)} Mo`;
}

// ─── Composant étape 1 ────────────────────────────────────────────────────────

function EtapeInfos({ e, set }: { e: EtatWizard; set: (p: Partial<EtatWizard>) => void }) {
  const [uploadImg, setUploadImg] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Fichier image requis"); return; }
    setUploadImg(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set({ images: [...e.images, data.url] });
    } catch (err: any) { toast.error(err.message || "Erreur upload"); }
    finally { setUploadImg(false); }
  }

  return (
    <div className="space-y-5">
      {/* Nom */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom du produit *</label>
        <input
          value={e.nom}
          onChange={(ev) => {
            const nom = ev.target.value;
            set({ nom, slug: slugify(nom) });
          }}
          placeholder="Ex : Guide complet SEO 2025"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Slug URL</label>
        <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
          <span className="px-3 py-2.5 bg-gray-50 text-gray-400 text-xs border-r border-gray-200">boutique.com/p/</span>
          <input
            value={e.slug}
            onChange={(ev) => set({ slug: ev.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
            className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
        <textarea
          value={e.description}
          onChange={(ev) => set({ description: ev.target.value })}
          rows={4}
          placeholder="Décrivez votre produit, ce qu'il contient, à qui il s'adresse…"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
        />
      </div>

      {/* Prix */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix de vente (FCFA) *</label>
          <input
            type="number" min="0" value={e.prix}
            onChange={(ev) => set({ prix: ev.target.value })}
            placeholder="5000"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Prix barré (optionnel)</label>
          <input
            type="number" min="0" value={e.prixCompare}
            onChange={(ev) => set({ prixCompare: ev.target.value })}
            placeholder="8000"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
          />
        </div>
      </div>

      {/* Catégorie */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Catégorie</label>
        <select
          value={e.categorie}
          onChange={(ev) => set({ categorie: ev.target.value })}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white"
        >
          <option value="">— Sélectionner —</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* Images */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Visuels produit</label>
        <div className="flex flex-wrap gap-2">
          {e.images.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => set({ images: e.images.filter((_, j) => j !== i) })}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploadImg}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-[#1B2A4A] hover:text-[#1B2A4A] transition-colors"
          >
            {uploadImg ? <Loader2 size={18} className="animate-spin" /> : <><ImageIcon size={18} /><span className="text-[10px]">Ajouter</span></>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(ev) => { const f = ev.target.files?.[0]; if (f) uploadImage(f); ev.target.value = ""; }} />
        </div>
      </div>
    </div>
  );
}

// ─── Composant étape 2 ────────────────────────────────────────────────────────

function EtapeConfig({ e, set }: { e: EtatWizard; set: (p: Partial<EtatWizard>) => void }) {
  return (
    <div className="space-y-5">
      {/* Limite d'achats */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Limite d'achats globale
        </label>
        <p className="text-xs text-gray-400 mb-2">Laissez vide pour illimité. La vente se bloque automatiquement quand le stock atteint 0.</p>
        <input
          type="number" min="1" value={e.limitAchats}
          onChange={(ev) => set({ limitAchats: ev.target.value })}
          placeholder="Ex : 100 (laisser vide = illimité)"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
        />
      </div>

      {/* Mot de passe */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
          <Lock size={14} /> Mot de passe de téléchargement
        </label>
        <p className="text-xs text-gray-400 mb-2">L'acheteur devra saisir ce mot de passe pour accéder au fichier.</p>
        <div className="relative">
          <input
            type={e.montrerMDP ? "text" : "password"}
            value={e.motDePasse}
            onChange={(ev) => set({ motDePasse: ev.target.value })}
            placeholder="Laisser vide = pas de mot de passe"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
          />
          <button
            type="button"
            onClick={() => set({ montrerMDP: !e.montrerMDP })}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          >
            {e.montrerMDP ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </div>

      {/* Filigrane */}
      <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200">
        <button
          onClick={() => set({ filigrane: !e.filigrane })}
          className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
            e.filigrane ? "bg-[#1B2A4A] border-[#1B2A4A]" : "border-gray-300"
          }`}
        >
          {e.filigrane && <Check size={11} className="text-white" />}
        </button>
        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
            <Droplets size={14} /> Filigrane automatique
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Pour les PDF : injecte le nom, l'email et la date d'achat de l'acheteur dans chaque page livrée.
            Les autres formats ne sont pas supportés pour l'instant.
          </p>
        </div>
      </div>

      {/* Instructions post-achat */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Instructions post-achat</label>
        <p className="text-xs text-gray-400 mb-2">Texte affiché à l'acheteur après paiement (email de confirmation + page de confirmation).</p>
        <textarea
          value={e.instructionsAchat}
          onChange={(ev) => set({ instructionsAchat: ev.target.value })}
          rows={4}
          placeholder="Ex : Merci pour votre achat ! Vous pouvez télécharger votre fichier via le bouton ci-dessous…"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]/20 focus:border-[#1B2A4A]"
        />
      </div>
    </div>
  );
}

// ─── Composant étape 3 ────────────────────────────────────────────────────────

function EtapeFichiers({ e, set }: { e: EtatWizard; set: (p: Partial<EtatWizard>) => void }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    setUploading(true);
    try {
      const results = await Promise.all(
        arr.map(async (file) => {
          const fd = new FormData(); fd.append("file", file);
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const data = await res.json();
          if (!res.ok) throw new Error(`${file.name}: ${data.error}`);
          return {
            nom: file.name,
            url: data.url,
            taille: file.size,
            mimeType: file.type,
            ordre: e.fichiers.length + arr.indexOf(file),
          } as Fichier;
        })
      );
      set({ fichiers: [...e.fichiers, ...results] });
      toast.success(`${results.length} fichier${results.length > 1 ? "s" : ""} ajouté${results.length > 1 ? "s" : ""}`);
    } catch (err: any) {
      toast.error(err.message || "Erreur upload");
    } finally {
      setUploading(false);
    }
  }

  const onDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    setDragOver(false);
    if (ev.dataTransfer.files.length) uploadFiles(ev.dataTransfer.files);
  }, [e.fichiers]);

  function supprimer(i: number) {
    const nv = e.fichiers.filter((_, j) => j !== i).map((f, j) => ({ ...f, ordre: j }));
    set({ fichiers: nv });
  }

  return (
    <div className="space-y-4">
      {/* Zone de dépôt */}
      <div
        ref={dropRef}
        onDragOver={(ev) => { ev.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragOver ? "border-[#1B2A4A] bg-[#1B2A4A]/5" : "border-gray-300 hover:border-[#1B2A4A]/50"
        }`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 size={28} className="animate-spin text-[#1B2A4A]" />
            <p className="text-sm text-gray-500">Upload en cours…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-[#1B2A4A]/10 flex items-center justify-center">
              <Upload size={22} className="text-[#1B2A4A]" />
            </div>
            <p className="text-sm font-medium text-gray-700">Glissez vos fichiers ici ou cliquez pour parcourir</p>
            <p className="text-xs text-gray-400">PDF, ZIP, MP3, MP4, DOCX… — max 200 Mo par fichier</p>
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" multiple className="hidden"
        onChange={(ev) => { if (ev.target.files?.length) uploadFiles(ev.target.files); ev.target.value = ""; }} />

      {/* Liste des fichiers */}
      {e.fichiers.length > 0 && (
        <div className="space-y-2">
          {e.fichiers.map((f, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl bg-white">
              <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
              <div className="w-8 h-8 rounded-lg bg-[#1B2A4A]/10 flex items-center justify-center flex-shrink-0">
                <FileDown size={14} className="text-[#1B2A4A]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{f.nom}</p>
                <p className="text-xs text-gray-400">{formatTaille(f.taille)} • {f.mimeType}</p>
              </div>
              <button onClick={() => supprimer(i)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {e.fichiers.length === 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded-xl p-3">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>Ajoutez au moins un fichier pour pouvoir publier le produit.</span>
        </div>
      )}
    </div>
  );
}

// ─── Composant étape 4 (résumé) ───────────────────────────────────────────────

function EtapePublication({ e }: { e: EtatWizard }) {
  const prixNum = parseFloat(e.prix) || 0;

  const checks = [
    { ok: e.nom.length >= 2,         label: "Nom renseigné" },
    { ok: prixNum > 0,               label: "Prix défini" },
    { ok: e.images.length > 0,       label: "Au moins 1 visuel" },
    { ok: e.fichiers.length > 0,     label: "Au moins 1 fichier uploadé" },
    { ok: e.description.length >= 10, label: "Description renseignée" },
  ];

  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-3">Récapitulatif</h3>
        <div className="space-y-1.5 text-sm">
          <Row label="Nom"       val={e.nom || "—"} />
          <Row label="Prix"      val={prixNum > 0 ? `${prixNum.toLocaleString("fr-FR")} FCFA` : "—"} />
          <Row label="Fichiers"  val={`${e.fichiers.length} fichier${e.fichiers.length > 1 ? "s" : ""}`} />
          <Row label="Filigrane" val={e.filigrane ? "Oui (PDF)" : "Non"} />
          <Row label="Mot de passe" val={e.motDePasse ? "Oui" : "Non"} />
          <Row label="Limite achats" val={e.limitAchats ? `${e.limitAchats} exemplaires` : "Illimité"} />
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
          <Sparkles size={15} className="text-[#F5A623]" /> Prêt à publier ?
        </h3>
        <div className="space-y-2">
          {checks.map((c, i) => (
            <div key={i} className={`flex items-center gap-2 text-sm ${c.ok ? "text-green-600" : "text-amber-600"}`}>
              {c.ok
                ? <Check size={14} className="flex-shrink-0" />
                : <AlertCircle size={14} className="flex-shrink-0" />
              }
              {c.label}
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Le produit sera publié et immédiatement visible sur votre boutique. Vous pourrez le modifier à tout moment.
      </p>
    </div>
  );
}

function Row({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium text-right">{val}</span>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CreerFichierPage() {
  const router = useRouter();
  const [etape, setEtape] = useState(0);
  const [etat, setEtatRaw] = useState<EtatWizard>(ETAT_INITIAL);
  const [saving, setSaving] = useState(false);
  const [produitId, setProduitId] = useState<string | null>(null);

  function set(patch: Partial<EtatWizard>) {
    setEtatRaw((prev) => ({ ...prev, ...patch }));
  }

  function validerEtape(): string | null {
    if (etape === 0) {
      if (!etat.nom || etat.nom.length < 2) return "Le nom doit faire au moins 2 caractères.";
      if (!etat.prix || parseFloat(etat.prix) <= 0) return "Le prix est requis.";
    }
    if (etape === 2 && etat.fichiers.length === 0) return "Ajoutez au moins un fichier.";
    return null;
  }

  async function suivant() {
    const err = validerEtape();
    if (err) { toast.error(err); return; }

    if (etape === 2 && !produitId) {
      // Créer le produit en DB avant la publication
      await creerProduit(false);
    } else {
      setEtape((s) => Math.min(s + 1, 3));
    }
  }

  async function creerProduit(publier: boolean) {
    setSaving(true);
    try {
      // 1. Créer le produit
      const resP = await fetch("/api/produits/digitaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom:         etat.nom,
          slug:        etat.slug || slugify(etat.nom),
          description: etat.description,
          prix:        parseFloat(etat.prix),
          prixCompare: etat.prixCompare ? parseFloat(etat.prixCompare) : undefined,
          images:      etat.images,
          categorie:   etat.categorie,
          tags:        etat.tags ? etat.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
          type:        "fichier",
        }),
      });
      const dataP = await resP.json();
      if (!resP.ok) throw new Error(dataP.error || "Erreur création produit");

      const id: string = dataP.produit.id;
      setProduitId(id);

      // 2. Enregistrer la config fichier
      await fetch(`/api/produits/digitaux/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            limitAchats:       etat.limitAchats ? parseInt(etat.limitAchats) : null,
            motDePasse:        etat.motDePasse || null,
            filigrane:         etat.filigrane,
            instructionsAchat: etat.instructionsAchat || null,
          },
        }),
      });

      // 3. Rattacher les fichiers uploadés
      if (etat.fichiers.length > 0) {
        await fetch(`/api/produits/digitaux/${id}/fichiers`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fichiers: etat.fichiers }),
        });
      }

      // 4. Publier si demandé
      if (publier) {
        await fetch(`/api/produits/digitaux/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actif: true }),
        });
        toast.success("Produit publié avec succès !");
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
      // Produit déjà créé → juste publier
      setSaving(true);
      try {
        await fetch(`/api/produits/digitaux/${produitId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actif: true }),
        });
        toast.success("Produit publié !");
        router.push(`/dashboard/produits/${produitId}`);
      } catch { toast.error("Erreur lors de la publication"); }
      finally { setSaving(false); }
    } else {
      await creerProduit(true);
    }
  }

  const precedent = () => setEtape((s) => Math.max(s - 1, 0));

  return (
    <div className="max-w-xl mx-auto py-8 px-4">
      <Link href="/dashboard/produits/digital/nouveau" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft size={14} /> Changer de type
      </Link>

      {/* En-tête */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-[#1B2A4A]/10 flex items-center justify-center">
            <FileDown size={14} className="text-[#1B2A4A]" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 font-poppins">Fichier digital</h1>
        </div>
        <p className="text-sm text-gray-500">Étape {etape + 1} sur {ETAPES.length} — {ETAPES[etape]}</p>
      </div>

      {/* Barre de progression */}
      <div className="flex gap-1.5 mb-8">
        {ETAPES.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= etape ? "bg-[#1B2A4A]" : "bg-gray-200"}`} />
        ))}
      </div>

      {/* Contenu de l'étape */}
      <div className="mb-8">
        {etape === 0 && <EtapeInfos    e={etat} set={set} />}
        {etape === 1 && <EtapeConfig   e={etat} set={set} />}
        {etape === 2 && <EtapeFichiers e={etat} set={set} />}
        {etape === 3 && <EtapePublication e={etat} />}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {etape > 0 && (
          <button
            onClick={precedent}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
          >
            <ArrowLeft size={14} /> Précédent
          </button>
        )}

        {etape < 3 ? (
          <button
            onClick={suivant}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-[#1B2A4A] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#1B2A4A]/90 transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {etape === 2 ? "Vérifier avant publication" : "Continuer"}
            {!saving && <ChevronRight size={15} />}
          </button>
        ) : (
          <button
            onClick={publier}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-[#F5A623] text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-[#d4820a] transition-all disabled:opacity-60 shadow-lg shadow-[#F5A623]/25"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={15} />}
            Publier le produit
          </button>
        )}
      </div>
    </div>
  );
}
