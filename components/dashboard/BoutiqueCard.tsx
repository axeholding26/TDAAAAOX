"use client";
import { useState } from "react";
import { ExternalLink, Copy, Check, Store, Globe } from "lucide-react";

interface BoutiqueCardProps {
  slug: string;
  nom: string;
}

export function BoutiqueCard({ slug, nom }: BoutiqueCardProps) {
  const [copie, setCopie] = useState(false);

  if (!slug) return null;

  const urlProd = `https://${slug}.axso.com`;

  function copierLien() {
    navigator.clipboard.writeText(urlProd);
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  }

  return (
    <div className="bg-white border border-[#F5A623]/20 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 border border-[#F5A623]/20 flex items-center justify-center">
            <Store size={16} className="text-[#F5A623]" />
          </div>
          <div>
            <h3 className="text-gray-900 font-semibold text-sm">{nom}</h3>
            <p className="text-gray-400 text-xs">Votre boutique en ligne</p>
          </div>
        </div>
        <span className="text-xs bg-green-50 text-green-600 border border-green-200 px-2.5 py-1 rounded-full font-medium">
          Active
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <p className="text-gray-400 text-xs mb-1.5 flex items-center gap-1.5">
            <Globe size={10} /> Accès local
          </p>
          <a
            href={`/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F5A623] text-sm font-mono hover:underline flex items-center gap-1 group"
          >
            /{slug}
            <ExternalLink size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
          <p className="text-gray-400 text-xs mb-1.5 flex items-center gap-1.5">
            <Globe size={10} /> URL de production
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-gray-600 text-sm font-mono truncate">{slug}.axso.com</p>
            <button onClick={copierLien} className="flex-shrink-0 text-gray-400 hover:text-[#F5A623] transition-colors" title="Copier le lien">
              {copie ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <a
          href={`/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 bg-[#F5A623] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#d4820a] transition-colors shadow-sm shadow-[#F5A623]/20"
        >
          <ExternalLink size={14} />
          Voir ma boutique
        </a>
        <a
          href="/dashboard/boutique"
          className="flex items-center justify-center gap-2 border border-gray-200 text-gray-600 text-sm px-4 py-2.5 rounded-xl hover:border-[#F5A623]/30 hover:text-gray-900 transition-all"
        >
          Personnaliser
        </a>
      </div>
    </div>
  );
}
