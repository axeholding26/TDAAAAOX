"use client";
import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Save, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface FaqItem {
  question: string;
  reponse: string;
}

interface Props {
  produitId: string;
  initial: FaqItem[];
  nom?: string;
  description?: string;
}

export default function FaqManager({ produitId, initial, nom = "", description = "" }: Props) {
  const [items, setItems] = useState<FaqItem[]>(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [genIA, setGenIA] = useState(false);

  const save = async (toSave: FaqItem[] = items) => {
    setSaving(true);
    try {
      const r = await fetch(`/api/produits/${produitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faq: toSave }),
      });
      if (!r.ok) throw new Error("Erreur");
      toast.success("FAQ sauvegardée");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const generer = async () => {
    if (!nom) { toast.error("Entrez d'abord le nom du produit"); return; }
    setGenIA(true);
    try {
      const r = await fetch("/api/ai/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, description }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const merged = [...items, ...d.faq];
      setItems(merged);
      await save(merged);
    } catch (e: any) {
      toast.error(e.message ?? "Erreur IA");
    } finally {
      setGenIA(false);
    }
  };

  const ajouter = () => {
    const next = [...items, { question: "", reponse: "" }];
    setItems(next);
    setOpen(items.length);
  };

  const updateItem = (idx: number, field: keyof FaqItem, value: string) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const supprimer = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    setItems(next);
    if (open === idx) setOpen(null);
    save(next);
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">FAQ du produit</h3>
          <p className="text-xs text-gray-400 mt-0.5">Questions fréquentes affichées sur votre page boutique</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={generer}
            disabled={genIA}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-[#F5A623]/10 text-[#F5A623] border border-[#F5A623]/20 hover:bg-[#F5A623]/20 disabled:opacity-50 transition-colors"
          >
            {genIA ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Générer avec l'IA
          </button>
          <button
            onClick={ajouter}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            <Plus size={12} /> Ajouter
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-300 text-sm border-2 border-dashed border-gray-100 rounded-xl">
          Aucune question pour l'instant
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(open === idx ? null : idx)}
                className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-gray-50 transition-colors"
              >
                <GripVertical size={13} className="text-gray-300 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                  {item.question || <span className="text-gray-400 italic font-normal">Nouvelle question…</span>}
                </span>
                {open === idx
                  ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" />
                  : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
              </button>

              {open === idx && (
                <div className="border-t border-gray-100 p-3.5 space-y-3 bg-gray-50/50">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">Question</label>
                    <input
                      value={item.question}
                      onChange={e => updateItem(idx, "question", e.target.value)}
                      placeholder="Ex: Comment accéder au contenu après achat ?"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#F5A623]/50 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">Réponse</label>
                    <textarea
                      value={item.reponse}
                      onChange={e => updateItem(idx, "reponse", e.target.value)}
                      rows={3}
                      placeholder="La réponse complète…"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#F5A623]/50 resize-none bg-white"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => supprimer(idx)}
                      className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={12} /> Supprimer
                    </button>
                    <button
                      type="button"
                      onClick={() => save()}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#F5A623] text-white hover:bg-[#d4820a] disabled:opacity-50 transition-colors"
                    >
                      <Save size={11} /> {saving ? "…" : "Sauvegarder"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && open === null && (
        <button
          type="button"
          onClick={() => save()}
          disabled={saving}
          className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <Save size={12} /> {saving ? "Sauvegarde…" : "Sauvegarder la FAQ"}
        </button>
      )}
    </div>
  );
}
