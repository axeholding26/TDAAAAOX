"use client";
import { useEffect, useState } from "react";
import {
  Plus, Loader2, Trash2, Copy, Check, ExternalLink, Edit2,
  Calendar, RefreshCw, Tag, Infinity, AlertCircle, X,
} from "lucide-react";
import { toast } from "sonner";

type Variante = {
  id: string; nom: string; slug: string; prix: number; prixPromo: number | null;
  periodeValidite: string | null; renouvAuto: boolean; autorisePromo: boolean;
  actif: boolean; dateDebut: string | null; dateFin: string | null;
};

type FormVariante = {
  nom: string; prix: string; prixPromo: string; periodeValidite: string;
  renouvAuto: boolean; autorisePromo: boolean; dateDebut: string; dateFin: string;
};

const FORM_VIDE: FormVariante = {
  nom: "", prix: "", prixPromo: "", periodeValidite: "",
  renouvAuto: false, autorisePromo: true, dateDebut: "", dateFin: "",
};

const PERIODES = [
  { val: "",     label: "Illimité" },
  { val: "7j",   label: "7 jours" },
  { val: "30j",  label: "30 jours" },
  { val: "90j",  label: "90 jours" },
  { val: "1an",  label: "1 an" },
];

function inputCls(extra = "") {
  return `w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F5A623]/25 focus:border-[#F5A623] ${extra}`;
}

function Toggle({ val, onChange }: { val: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!val)}
      className={`w-10 h-5.5 rounded-full relative transition-colors flex-shrink-0 ${val ? "bg-[#F5A623]" : "bg-gray-200"}`}
      style={{ height: 22 }}
    >
      <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-all ${val ? "left-5" : "left-0.5"}`}
        style={{ width: 18, height: 18 }} />
    </button>
  );
}

export function VariantesPrixManager({
  produitId, boutiqueSlug, produitSlug, devise = "FCFA",
}: {
  produitId: string; boutiqueSlug?: string; produitSlug?: string; devise?: string;
}) {
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormVariante>(FORM_VIDE);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function charger() {
    const res = await fetch(`/api/variantesPrix?produitId=${produitId}`);
    if (res.ok) { const d = await res.json(); setVariantes(d.variantes); }
    setLoading(false);
  }

  useEffect(() => { charger(); }, [produitId]);

  function lienCheckout(v: Variante) {
    if (!boutiqueSlug || !produitSlug) return "#";
    return `/${boutiqueSlug}/produits/${produitSlug}?v=${v.id}`;
  }

  function copierLien(v: Variante) {
    const url = `${window.location.origin}${lienCheckout(v)}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(v.id);
      toast.success("Lien copié !");
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function ouvrirEdition(v: Variante) {
    setEditId(v.id);
    setForm({
      nom:            v.nom,
      prix:           String(v.prix),
      prixPromo:      v.prixPromo ? String(v.prixPromo) : "",
      periodeValidite: v.periodeValidite || "",
      renouvAuto:     v.renouvAuto,
      autorisePromo:  v.autorisePromo,
      dateDebut:      v.dateDebut ? v.dateDebut.slice(0, 10) : "",
      dateFin:        v.dateFin   ? v.dateFin.slice(0, 10)   : "",
    });
    setShowForm(true);
  }

  function annulerForm() {
    setShowForm(false);
    setEditId(null);
    setForm(FORM_VIDE);
  }

  async function sauvegarder() {
    if (!form.nom || !form.prix) { toast.error("Nom et prix requis"); return; }
    setSaving(true);
    try {
      const body = {
        produitId,
        nom:            form.nom,
        prix:           parseFloat(form.prix),
        prixPromo:      form.prixPromo ? parseFloat(form.prixPromo) : null,
        periodeValidite: form.periodeValidite || null,
        renouvAuto:     form.renouvAuto,
        autorisePromo:  form.autorisePromo,
        dateDebut:      form.dateDebut || null,
        dateFin:        form.dateFin   || null,
      };

      if (editId) {
        const res = await fetch(`/api/variantesPrix/${editId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Variante modifiée");
      } else {
        const res = await fetch("/api/variantesPrix", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success("Variante créée !");
      }
      annulerForm();
      charger();
    } catch (err: any) {
      toast.error(err.message || "Erreur serveur");
    } finally {
      setSaving(false);
    }
  }

  async function supprimer(id: string) {
    if (!confirm("Supprimer cette variante de prix ?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/variantesPrix/${id}`, { method: "DELETE" });
      toast.success("Variante supprimée");
      setVariantes((vs) => vs.filter((v) => v.id !== id));
    } catch { toast.error("Erreur"); }
    finally { setDeleting(null); }
  }

  async function toggleActif(v: Variante) {
    await fetch(`/api/variantesPrix/${v.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: !v.actif }),
    });
    setVariantes((vs) => vs.map((x) => x.id === v.id ? { ...x, actif: !x.actif } : x));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
        <Loader2 size={14} className="animate-spin" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Variantes de prix</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Créez plusieurs offres (Standard, Pro, Lifetime…) avec des liens de paiement uniques.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setEditId(null); setForm(FORM_VIDE); setShowForm(true); }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[#F5A623] text-[#111111] rounded-lg hover:bg-[#F5A623]/90 transition-all"
          >
            <Plus size={12} /> Ajouter
          </button>
        )}
      </div>

      {/* Formulaire */}
      {showForm && (
        <div className="border border-[#F5A623]/30 rounded-2xl p-4 bg-[#F5A623]/5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-semibold text-[#111111]">
              {editId ? "Modifier la variante" : "Nouvelle variante"}
            </span>
            <button onClick={annulerForm} className="text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-500 mb-1 block">Nom de l'offre *</label>
              <input
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                placeholder="Ex : Accès Lifetime, Abonnement Pro…"
                className={inputCls()}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prix ({devise}) *</label>
              <input type="number" min="0" value={form.prix}
                onChange={(e) => setForm((f) => ({ ...f, prix: e.target.value }))}
                placeholder="5000" className={inputCls()} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prix barré ({devise})</label>
              <input type="number" min="0" value={form.prixPromo}
                onChange={(e) => setForm((f) => ({ ...f, prixPromo: e.target.value }))}
                placeholder="8000" className={inputCls()} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Période de validité de l'accès</label>
            <select value={form.periodeValidite} onChange={(e) => setForm((f) => ({ ...f, periodeValidite: e.target.value }))}
              className={inputCls("bg-white")}>
              {PERIODES.map((p) => <option key={p.val} value={p.val}>{p.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Disponible à partir du</label>
              <input type="date" value={form.dateDebut}
                onChange={(e) => setForm((f) => ({ ...f, dateDebut: e.target.value }))}
                className={inputCls()} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Expire le</label>
              <input type="date" value={form.dateFin}
                onChange={(e) => setForm((f) => ({ ...f, dateFin: e.target.value }))}
                className={inputCls()} />
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Renouvellement auto</p>
                <p className="text-xs text-gray-400">Recrée la fenêtre temporelle à l'expiration</p>
              </div>
              <Toggle val={form.renouvAuto} onChange={(v) => setForm((f) => ({ ...f, renouvAuto: v }))} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-700">Codes promo acceptés</p>
                <p className="text-xs text-gray-400">Les codes de réduction s'appliquent à cette offre</p>
              </div>
              <Toggle val={form.autorisePromo} onChange={(v) => setForm((f) => ({ ...f, autorisePromo: v }))} />
            </div>
          </div>

          <button
            onClick={sauvegarder}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-[#F5A623] text-[#111111] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#F5A623]/90 transition-all disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {editId ? "Enregistrer les modifications" : "Créer l'offre"}
          </button>
        </div>
      )}

      {/* Liste des variantes */}
      {variantes.length === 0 && !showForm && (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-3">
          <AlertCircle size={13} />
          Aucune variante. Ajoutez-en une pour créer des offres personnalisées avec des liens de paiement uniques.
        </div>
      )}

      <div className="space-y-2">
        {variantes.map((v) => (
          <div key={v.id}
            className={`border rounded-xl p-3.5 transition-all ${v.actif ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800 text-sm">{v.nom}</span>
                  {v.actif
                    ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">Actif</span>
                    : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactif</span>
                  }
                  {v.renouvAuto && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F5A623]/12 text-[#111111] flex items-center gap-0.5">
                      <RefreshCw size={8} /> Auto
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-[#D4911A] font-bold text-sm">{v.prix.toLocaleString("fr-FR")} {devise}</span>
                  {v.prixPromo && (
                    <span className="text-gray-400 text-xs line-through">{v.prixPromo.toLocaleString("fr-FR")} {devise}</span>
                  )}
                  <span className="text-xs text-gray-400 flex items-center gap-0.5">
                    {v.periodeValidite ? <><Calendar size={10} /> {PERIODES.find((p) => p.val === v.periodeValidite)?.label}</> : <><Infinity size={10} /> Illimité</>}
                  </span>
                  {!v.autorisePromo && (
                    <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                      <Tag size={9} /> Sans promo
                    </span>
                  )}
                </div>

                {(v.dateDebut || v.dateFin) && (
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {v.dateDebut && `Début : ${new Date(v.dateDebut).toLocaleDateString("fr-FR")}`}
                    {v.dateDebut && v.dateFin && " · "}
                    {v.dateFin && `Expire : ${new Date(v.dateFin).toLocaleDateString("fr-FR")}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Copier lien */}
                {boutiqueSlug && produitSlug && (
                  <button
                    onClick={() => copierLien(v)}
                    title="Copier le lien de paiement"
                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 hover:border-[#F5A623]/40 text-gray-400 hover:text-[#D4911A] transition-all"
                  >
                    {copied === v.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                  </button>
                )}

                {/* Voir sur la boutique */}
                {boutiqueSlug && produitSlug && (
                  <a
                    href={lienCheckout(v)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Voir sur la boutique"
                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 hover:border-[#F5A623]/40 text-gray-400 hover:text-[#D4911A] transition-all"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}

                {/* Activer/Désactiver */}
                <button
                  onClick={() => toggleActif(v)}
                  title={v.actif ? "Désactiver" : "Activer"}
                  className="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 hover:border-[#F5A623]/40 text-gray-400 hover:text-[#D4911A] transition-all"
                >
                  <div className={`w-2 h-2 rounded-full ${v.actif ? "bg-green-500" : "bg-gray-300"}`} />
                </button>

                {/* Éditer */}
                <button
                  onClick={() => ouvrirEdition(v)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 hover:border-[#F5A623]/40 text-gray-400 hover:text-[#D4911A] transition-all"
                >
                  <Edit2 size={12} />
                </button>

                {/* Supprimer */}
                <button
                  onClick={() => supprimer(v.id)}
                  disabled={deleting === v.id}
                  className="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 hover:border-red-200 text-gray-400 hover:text-red-500 transition-all"
                >
                  {deleting === v.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
