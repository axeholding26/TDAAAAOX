"use client";
import { useState } from "react";
import {
  X, Check, AlertCircle, Sparkles, Loader2,
  Globe, ImageIcon, HelpCircle, DollarSign, Type,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  produitId: string;
  nom: string;
  description: string;
  images: string[];
  prix: string;
  metaTitle: string;
  faqCount: number;
  onPublier: () => Promise<void>;
  onClose: () => void;
}

export default function PublicationAssistant({
  produitId, nom, description, images, prix, metaTitle, faqCount, onPublier, onClose,
}: Props) {
  const [publishing, setPublishing] = useState(false);
  const [genFaq, setGenFaq] = useState(false);

  const items = [
    { key: "nom",   label: "Nom du produit",  ok: nom.length >= 5,        icon: <Type size={13} />,      conseil: "Un titre précis fait +30% de clics. Minimum 5 caractères." },
    { key: "desc",  label: "Description",     ok: description.length >= 80, icon: <Check size={13} />,   conseil: "Décrivez les bénéfices, pas seulement les caractéristiques (min. 80 car.)." },
    { key: "img",   label: "Image produit",   ok: images.length >= 1,     icon: <ImageIcon size={13} />, conseil: "Les produits avec photo se vendent 4× plus. Ajoutez une image." },
    { key: "prix",  label: "Prix valide",     ok: Number(prix) > 0,       icon: <DollarSign size={13} />,conseil: "Définissez un prix de vente positif." },
    { key: "seo",   label: "Titre SEO",       ok: metaTitle.length >= 5,  icon: <Globe size={13} />,     conseil: "Un titre SEO améliore votre visibilité sur Google." },
    { key: "faq",   label: "FAQ client",      ok: faqCount >= 2,          icon: <HelpCircle size={13} />,conseil: "Une FAQ rassure les acheteurs hésitants et réduit les messages de support." },
  ];

  const score = items.filter(i => i.ok).length;
  const pct   = Math.round((score / items.length) * 100);
  const color  = pct >= 80 ? "#16a34a" : pct >= 50 ? "#F5A623" : "#ef4444";

  const handlePublier = async () => {
    setPublishing(true);
    try {
      await onPublier();
      onClose();
    } finally {
      setPublishing(false);
    }
  };

  const genererFaq = async () => {
    if (!nom) { toast.error("Entrez d'abord le nom du produit"); return; }
    setGenFaq(true);
    try {
      const r = await fetch("/api/ai/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom, description }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await fetch(`/api/produits/${produitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faq: d.faq }),
      });
      toast.success("FAQ générée ! Rechargez la page pour la voir.");
    } catch (e: any) {
      toast.error(e.message ?? "Erreur IA");
    } finally {
      setGenFaq(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-6 h-6 rounded-lg bg-[#F5A623] flex items-center justify-center">
                <Sparkles size={13} className="text-white" />
              </div>
              <h2 className="text-base font-bold text-gray-900">Avant de publier…</h2>
            </div>
            <p className="text-xs text-gray-400 ml-8">Vérifications pour maximiser vos ventes</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Score */}
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500 font-medium">Complétude du produit</span>
            <span className="text-sm font-bold" style={{ color }}>{pct}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
          </div>
          <p className="text-[10px] text-gray-400 mt-1">{score}/{items.length} éléments complétés</p>
        </div>

        {/* Checklist */}
        <div className="px-6 space-y-1.5 max-h-52 overflow-y-auto pb-2">
          {items.map(item => (
            <div
              key={item.key}
              className={`flex items-start gap-3 p-3 rounded-xl ${item.ok ? "bg-green-50" : "bg-amber-50/70"}`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${item.ok ? "bg-[#16a34a]" : "bg-amber-400"}`}>
                {item.ok
                  ? <Check size={10} className="text-white" />
                  : <AlertCircle size={10} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${item.ok ? "text-[#16a34a]" : "text-amber-700"}`}>{item.label}</p>
                {!item.ok && <p className="text-[10.5px] text-amber-600 mt-0.5 leading-relaxed">{item.conseil}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* IA suggestion — FAQ */}
        {faqCount < 2 && (
          <div className="px-6 pt-3">
            <button
              onClick={genererFaq}
              disabled={genFaq}
              className="w-full flex items-center gap-2 p-3 rounded-xl border border-[#F5A623]/30 bg-[#FFFBF0] text-[#d4820a] text-xs font-medium hover:bg-[#FEF3C7] transition-colors disabled:opacity-50"
            >
              {genFaq ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Générer une FAQ avec l'IA
            </button>
          </div>
        )}

        {/* Boutons action */}
        <div className="p-6 pt-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            Continuer d'améliorer
          </button>
          <button
            onClick={handlePublier}
            disabled={publishing}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors"
            style={{ background: "linear-gradient(135deg, #F5A623, #D4911A)" }}
          >
            {publishing
              ? <><Loader2 size={14} className="animate-spin" /> Publication…</>
              : <><Check size={14} /> Publier quand même</>}
          </button>
        </div>
      </div>
    </div>
  );
}
