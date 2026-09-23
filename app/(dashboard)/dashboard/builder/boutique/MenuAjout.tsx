"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { BlockNodeType } from "@/lib/theme-config";
import { BLOCK_LIBRARY_ITEMS, STARTER_TEMPLATES } from "../canvas/blockDefaults";

export type ChoixAjout = { kind: "modele"; id: string } | { kind: "bloc"; type: BlockNodeType };

// Menu « Ajouter une section / un bloc » — s'ouvre à côté du panneau de gauche
// (comme le sélecteur de Shopify). Échap ou clic à l'extérieur pour fermer.
export function MenuAjout({ mode, onChoisir, onFermer }: { mode: "section" | "bloc"; onChoisir: (c: ChoixAjout) => void; onFermer: () => void }) {
  const [recherche, setRecherche] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    const clic = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onFermer(); };
    window.addEventListener("keydown", clavier);
    // Au prochain tour : le clic qui a ouvert le menu ne doit pas le refermer.
    const t = setTimeout(() => window.addEventListener("mousedown", clic));
    return () => { clearTimeout(t); window.removeEventListener("keydown", clavier); window.removeEventListener("mousedown", clic); };
  }, [onFermer]);

  const q = recherche.trim().toLowerCase();
  const filtre = (label: string, desc: string) => !q || label.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
  const modeles = mode === "section" ? STARTER_TEMPLATES.filter((t) => filtre(t.label, t.desc)) : [];
  const blocs = BLOCK_LIBRARY_ITEMS.filter((i) => i.categorie === "widget" && filtre(i.label, i.desc));

  return (
    <div ref={ref} role="dialog" aria-label={mode === "section" ? "Ajouter une section" : "Ajouter un bloc"}
      className="absolute left-[calc(100%+8px)] top-2 bottom-2 z-40 w-[340px] flex flex-col bg-white rounded-xl border border-[#E8E8E8] shadow-[0_12px_40px_rgba(0,0,0,0.14)]">
      <div className="flex items-center justify-between px-4 h-14 border-b border-[#EEEEEE] flex-shrink-0">
        <p className="text-[15px] font-semibold text-[#111111]">{mode === "section" ? "Ajouter une section" : "Ajouter un bloc"}</p>
        <button onClick={onFermer} aria-label="Fermer" className="w-8 h-8 flex items-center justify-center rounded-lg text-[#888888] hover:text-[#111111] hover:bg-[#F5F5F5]"><X size={17} /></button>
      </div>
      <div className="px-3 pt-3 flex-shrink-0">
        <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-[#E0E0E0] focus-within:border-[#F5A623] focus-within:ring-2 focus-within:ring-[#F5A623]/20">
          <Search size={16} className="text-[#999999]" />
          <input autoFocus value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher"
            className="flex-1 text-[14px] text-[#111111] placeholder:text-[#AAAAAA] outline-none bg-transparent" />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {modeles.length > 0 && (
          <Groupe titre="Sections prêtes">
            {modeles.map((t) => <Choix key={t.id} Icon={t.Icon} label={t.label} desc={t.desc} onClick={() => onChoisir({ kind: "modele", id: t.id })} />)}
          </Groupe>
        )}
        {blocs.length > 0 && (
          <Groupe titre={mode === "section" ? "Sections simples" : "Blocs"}>
            {blocs.map((i) => <Choix key={i.type} Icon={i.Icon} label={i.label} desc={i.desc} onClick={() => onChoisir({ kind: "bloc", type: i.type })} />)}
          </Groupe>
        )}
        {!modeles.length && !blocs.length && <p className="text-[14px] text-[#888888] text-center py-8">Aucun résultat pour « {recherche} »</p>}
      </div>
    </div>
  );
}

function Groupe({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-1 pb-1.5 text-[12.5px] font-semibold uppercase tracking-wide text-[#999999]">{titre}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Choix({ Icon, label, desc, onClick }: { Icon: any; label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-2.5 rounded-lg text-left hover:bg-[#FFF7EA] transition-colors group">
      <span className="w-9 h-9 flex-shrink-0 rounded-lg bg-[#F5F5F5] group-hover:bg-[#FFE9C2] flex items-center justify-center text-[#666666] group-hover:text-[#C77C0A] transition-colors">
        <Icon size={17} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-[#111111] truncate">{label}</span>
        <span className="block text-[12.5px] text-[#888888] leading-snug">{desc}</span>
      </span>
    </button>
  );
}
